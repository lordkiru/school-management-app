const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const School = require('../models/School');
const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendTextMessage, templates } = require('../services/whatsapp');

// Helper: get WhatsApp config for a tenant
async function getWhatsAppConfig(tenantId) {
  const school = await School.findOne({ tenantId });
  if (!school || !school.whatsappEnabled || !school.whatsappPhoneNumberId || !school.whatsappAccessToken) {
    return null;
  }
  return {
    phoneNumberId: school.whatsappPhoneNumberId,
    accessToken: school.whatsappAccessToken,
    schoolName: school.name,
  };
}

// Helper: log notification to DB
async function logNotification(tenantId, data) {
  try {
    await Notification.create({ tenantId, ...data });
  } catch (err) {
    console.error('[Notification log error]', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/send
// Send a custom message to a single parent
// Body: { parentId, message }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { parentId, message } = req.body;
    if (!parentId || !message) {
      return res.status(400).json({ error: 'parentId and message are required' });
    }

    const config = await getWhatsAppConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp is not configured or disabled for this school. Go to Settings to set it up.' });
    }

    const parent = await Parent.findOne({ _id: parentId, tenantId: req.user.tenantId });
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    if (!parent.phone) return res.status(400).json({ error: 'Parent has no phone number on record' });
    if (!parent.whatsappOptIn) return res.status(400).json({ error: 'Parent has opted out of WhatsApp messages' });

    const fullMessage = templates.custom(message, config.schoolName);
    const result = await sendTextMessage(config, parent.phone, fullMessage);

    await logNotification(req.user.tenantId, {
      type: 'custom_individual',
      recipientPhone: parent.phone,
      recipientName: parent.name,
      parentId: parent._id,
      message: fullMessage,
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.messageId || '',
      errorMessage: result.error || '',
      sentAt: result.success ? new Date() : null,
      sentBy: req.user.id,
    });

    if (!result.success) {
      return res.status(502).json({ error: `Failed to send: ${result.error}` });
    }

    res.json({ message: 'WhatsApp message sent successfully', messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/broadcast
// Send a message to all parents in a class, or all school parents
// Body: { message, classId? (omit for school-wide) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/broadcast', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { message, classId } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const config = await getWhatsAppConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp is not configured or disabled for this school.' });
    }

    // Find target students
    const studentQuery = { tenantId: req.user.tenantId, status: 'Active' };
    if (classId) studentQuery.classId = classId;
    const students = await Student.find(studentQuery).select('_id');
    const studentIds = students.map((s) => s._id);

    // Find parents linked to those students who have opted in and have a phone
    const parents = await Parent.find({
      tenantId: req.user.tenantId,
      children: { $in: studentIds },
      phone: { $ne: '' },
      whatsappOptIn: true,
    }).select('_id name phone');

    if (parents.length === 0) {
      return res.status(400).json({ error: 'No eligible parents found (must have phone number and WhatsApp opt-in)' });
    }

    const fullMessage = templates.custom(message, config.schoolName);
    let sent = 0;
    let failed = 0;

    // Send to all parents (with small delay to respect Meta rate limits)
    for (const parent of parents) {
      const result = await sendTextMessage(config, parent.phone, fullMessage);
      await logNotification(req.user.tenantId, {
        type: 'custom_broadcast',
        recipientPhone: parent.phone,
        recipientName: parent.name,
        parentId: parent._id,
        message: fullMessage,
        status: result.success ? 'sent' : 'failed',
        metaMessageId: result.messageId || '',
        errorMessage: result.error || '',
        sentAt: result.success ? new Date() : null,
        sentBy: req.user.id,
      });
      if (result.success) sent++;
      else failed++;

      // Small delay to avoid Meta rate limits (100ms between messages)
      await new Promise((r) => setTimeout(r, 100));
    }

    res.json({ message: `Broadcast complete. Sent: ${sent}, Failed: ${failed}`, sent, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/test
// Send a test message to verify WhatsApp configuration
// Body: { phone }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const config = await getWhatsAppConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp is not configured or disabled for this school.' });
    }

    const testMessage = `✅ WhatsApp test from *${config.schoolName}*.\n\nYour WhatsApp integration is working correctly! 🎉`;
    const result = await sendTextMessage(config, phone, testMessage);

    if (!result.success) {
      return res.status(502).json({ error: `Test failed: ${result.error}` });
    }

    res.json({ message: 'Test message sent successfully!', messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/history?limit=50&type=
// View notification history for this school
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const query = { tenantId: req.user.tenantId };
    if (req.query.type) query.type = req.query.type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('parentId', 'name')
      .populate('studentId', 'name')
      .populate('sentBy', 'name');

    const totalSent = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'sent' });
    const totalFailed = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'failed' });

    res.json({ totalSent, totalFailed, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — used by attendance route to fire absence alerts
// Not a HTTP route — exported as a function
// ─────────────────────────────────────────────────────────────────────────────
async function sendAbsenceAlert(tenantId, studentId, date) {
  try {
    const config = await getWhatsAppConfig(tenantId);
    if (!config) return; // WhatsApp not configured, silently skip

    const student = await Student.findById(studentId).populate('classId', 'name');
    if (!student) return;

    // Find parent(s) linked to this student
    const parents = await Parent.find({
      tenantId,
      children: studentId,
      phone: { $ne: '' },
      whatsappOptIn: true,
    }).select('_id name phone');

    for (const parent of parents) {
      const message = templates.absenceAlert(student.name, date, config.schoolName);
      const result = await sendTextMessage(config, parent.phone, message);

      await logNotification(tenantId, {
        type: 'absence_alert',
        recipientPhone: parent.phone,
        recipientName: parent.name,
        parentId: parent._id,
        studentId: student._id,
        message,
        status: result.success ? 'sent' : 'failed',
        metaMessageId: result.messageId || '',
        errorMessage: result.error || '',
        sentAt: result.success ? new Date() : null,
        sentBy: null, // system-triggered
      });
    }
  } catch (err) {
    console.error('[sendAbsenceAlert error]', err.message);
  }
}

module.exports = router;
module.exports.sendAbsenceAlert = sendAbsenceAlert;
