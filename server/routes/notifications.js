const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const School = require('../models/School');
const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendTextMessage, templates } = require('../services/whatsapp');
const { sendSMS, sendBulkSMS, sendWhatsAppViaTermii, sendBulkWhatsAppViaTermii, smsTemplates } = require('../services/sms');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Get WhatsApp config for a tenant
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

// Get SMS config for a tenant
async function getSMSConfig(tenantId) {
  const school = await School.findOne({ tenantId });
  if (!school || !school.smsEnabled || !school.smsApiKey || !school.smsSenderId) {
    return null;
  }
  return {
    apiKey: school.smsApiKey,
    senderId: school.smsSenderId,
    schoolName: school.name,
  };
}

// Get Termii WhatsApp config — reuses the same Termii key, just checks termiiWhatsappEnabled
async function getTermiiWhatsAppConfig(tenantId) {
  const school = await School.findOne({ tenantId });
  if (!school || !school.termiiWhatsappEnabled || !school.smsApiKey || !school.smsSenderId) {
    return null;
  }
  return {
    apiKey: school.smsApiKey,
    senderId: school.smsSenderId,
    schoolName: school.name,
  };
}

// Log notification to DB
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
// Body: { parentId, message, channel? }
// channel: 'whatsapp' | 'termii-whatsapp' | 'sms' | 'both' | 'all'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { parentId, message, channel = 'whatsapp' } = req.body;
    if (!parentId || !message) {
      return res.status(400).json({ error: 'parentId and message are required' });
    }

    const parent = await Parent.findOne({ _id: parentId, tenantId: req.user.tenantId });
    if (!parent) return res.status(404).json({ error: 'Parent not found' });
    if (!parent.phone) return res.status(400).json({ error: 'Parent has no phone number on record' });

    const results = { whatsapp: null, termiiWhatsapp: null, sms: null };
    const useWhatsapp = channel === 'whatsapp' || channel === 'both' || channel === 'all';
    const useTermiiWA = channel === 'termii-whatsapp' || channel === 'all';
    const useSMS = channel === 'sms' || channel === 'both' || channel === 'all';

    // ── Meta WhatsApp ──
    if (useWhatsapp) {
      if (!parent.whatsappOptIn) {
        results.whatsapp = { success: false, error: 'Parent has opted out of WhatsApp messages' };
      } else {
        const config = await getWhatsAppConfig(req.user.tenantId);
        if (!config) {
          results.whatsapp = { success: false, error: 'WhatsApp (Meta) not configured. Go to Settings.' };
        } else {
          const fullMessage = templates.custom(message, config.schoolName);
          const result = await sendTextMessage(config, parent.phone, fullMessage);
          results.whatsapp = result;
          await logNotification(req.user.tenantId, {
            type: 'custom_individual', channel: 'whatsapp',
            recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
            message: fullMessage, status: result.success ? 'sent' : 'failed',
            metaMessageId: result.messageId || '', errorMessage: result.error || '',
            sentAt: result.success ? new Date() : null, sentBy: req.user.id,
          });
        }
      }
    }

    // ── WhatsApp via Termii ──
    if (useTermiiWA) {
      const twConfig = await getTermiiWhatsAppConfig(req.user.tenantId);
      if (!twConfig) {
        results.termiiWhatsapp = { success: false, error: 'WhatsApp via Termii not configured/enabled. Go to Settings.' };
      } else {
        const twMessage = smsTemplates.custom(message, twConfig.schoolName);
        const result = await sendWhatsAppViaTermii(twConfig, parent.phone, twMessage);
        results.termiiWhatsapp = result;
        await logNotification(req.user.tenantId, {
          type: 'custom_individual', channel: 'termii-whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
          message: twMessage, status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: req.user.id,
        });
      }
    }

    // ── SMS ──
    if (useSMS) {
      const smsConfig = await getSMSConfig(req.user.tenantId);
      if (!smsConfig) {
        results.sms = { success: false, error: 'SMS not configured. Go to Settings.' };
      } else {
        const smsMessage = smsTemplates.custom(message, smsConfig.schoolName);
        const result = await sendSMS(smsConfig, parent.phone, smsMessage);
        results.sms = result;
        await logNotification(req.user.tenantId, {
          type: 'custom_individual', channel: 'sms',
          recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
          message: smsMessage, status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: req.user.id,
        });
      }
    }

    const anySuccess = results.whatsapp?.success || results.termiiWhatsapp?.success || results.sms?.success;
    if (!anySuccess) {
      const errors = [results.whatsapp?.error, results.termiiWhatsapp?.error, results.sms?.error].filter(Boolean).join('; ');
      return res.status(502).json({ error: errors || 'Failed to send message' });
    }

    res.json({ message: 'Message sent successfully', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/broadcast
// Send a message to all parents in a class, or all school parents
// Body: { message, classId?, channel? }
// channel: 'whatsapp' | 'termii-whatsapp' | 'sms' | 'both' | 'all'
// ─────────────────────────────────────────────────────────────────────────────
router.post('/broadcast', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { message, classId, channel = 'whatsapp' } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const studentQuery = { tenantId: req.user.tenantId, status: 'Active' };
    if (classId) studentQuery.classId = classId;
    const students = await Student.find(studentQuery).select('_id');
    const studentIds = students.map((s) => s._id);

    const parents = await Parent.find({
      tenantId: req.user.tenantId,
      children: { $in: studentIds },
      phone: { $ne: '' },
    }).select('_id name phone whatsappOptIn');

    if (parents.length === 0) {
      return res.status(400).json({ error: 'No eligible parents found (must have phone number)' });
    }

    const useWhatsapp = channel === 'whatsapp' || channel === 'both' || channel === 'all';
    const useTermiiWA = channel === 'termii-whatsapp' || channel === 'all';
    const useSMS = channel === 'sms' || channel === 'both' || channel === 'all';

    let waSent = 0, waFailed = 0, twSent = 0, twFailed = 0, smsSent = 0, smsFailed = 0;

    // ── Meta WhatsApp broadcast ──
    if (useWhatsapp) {
      const waConfig = await getWhatsAppConfig(req.user.tenantId);
      if (!waConfig) {
        waFailed = parents.length;
      } else {
        const fullMessage = templates.custom(message, waConfig.schoolName);
        const eligible = parents.filter((p) => p.whatsappOptIn !== false);
        for (const parent of eligible) {
          const result = await sendTextMessage(waConfig, parent.phone, fullMessage);
          await logNotification(req.user.tenantId, {
            type: 'custom_broadcast', channel: 'whatsapp',
            recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
            message: fullMessage, status: result.success ? 'sent' : 'failed',
            metaMessageId: result.messageId || '', errorMessage: result.error || '',
            sentAt: result.success ? new Date() : null, sentBy: req.user.id,
          });
          if (result.success) waSent++; else waFailed++;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    // ── WhatsApp via Termii broadcast ──
    if (useTermiiWA) {
      const twConfig = await getTermiiWhatsAppConfig(req.user.tenantId);
      if (!twConfig) {
        twFailed = parents.length;
      } else {
        const twMessage = smsTemplates.custom(message, twConfig.schoolName);
        const phones = parents.map((p) => p.phone).filter(Boolean);
        const bulkResult = await sendBulkWhatsAppViaTermii(twConfig, phones, twMessage);
        twSent = bulkResult.sent;
        twFailed = bulkResult.failed;
        for (const parent of parents) {
          await logNotification(req.user.tenantId, {
            type: 'custom_broadcast', channel: 'termii-whatsapp',
            recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
            message: twMessage, status: 'sent', sentAt: new Date(), sentBy: req.user.id,
          });
        }
      }
    }

    // ── SMS broadcast ──
    if (useSMS) {
      const smsConfig = await getSMSConfig(req.user.tenantId);
      if (!smsConfig) {
        smsFailed = parents.length;
      } else {
        const smsMessage = smsTemplates.custom(message, smsConfig.schoolName);
        const phones = parents.map((p) => p.phone).filter(Boolean);
        const bulkResult = await sendBulkSMS(smsConfig, phones, smsMessage);
        smsSent = bulkResult.sent;
        smsFailed = bulkResult.failed;
        for (const parent of parents) {
          await logNotification(req.user.tenantId, {
            type: 'custom_broadcast', channel: 'sms',
            recipientPhone: parent.phone, recipientName: parent.name, parentId: parent._id,
            message: smsMessage, status: 'sent', sentAt: new Date(), sentBy: req.user.id,
          });
        }
      }
    }

    const totalSent = waSent + twSent + smsSent;
    const totalFailed = waFailed + twFailed + smsFailed;
    res.json({
      message: `Broadcast complete. Sent: ${totalSent}, Failed: ${totalFailed}`,
      sent: totalSent, failed: totalFailed,
      whatsapp: { sent: waSent, failed: waFailed },
      termiiWhatsapp: { sent: twSent, failed: twFailed },
      sms: { sent: smsSent, failed: smsFailed },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/test-whatsapp
// Send a test WhatsApp message
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-whatsapp', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
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

    res.json({ message: 'Test WhatsApp message sent successfully!', messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/test-termii-whatsapp
// Send a test WhatsApp message via Termii
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-termii-whatsapp', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const config = await getTermiiWhatsAppConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp via Termii is not configured or disabled. Go to Settings.' });
    }

    const testMessage = `${config.schoolName}: WhatsApp via Termii test successful! Your Termii WhatsApp integration is working.`;
    const result = await sendWhatsAppViaTermii(config, phone, testMessage);

    if (!result.success) {
      return res.status(502).json({ error: `Test failed: ${result.error}` });
    }

    res.json({ message: 'Test WhatsApp (Termii) message sent successfully!', messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/test-sms
// Send a test SMS via Termii
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-sms', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const config = await getSMSConfig(req.user.tenantId);
    if (!config) {
      return res.status(400).json({ error: 'SMS is not configured or disabled for this school.' });
    }

    const testMessage = `${config.schoolName}: SMS test successful! Your Termii SMS integration is working.`;
    const result = await sendSMS(config, phone, testMessage);

    if (!result.success) {
      return res.status(502).json({ error: `SMS test failed: ${result.error}` });
    }

    res.json({ message: 'Test SMS sent successfully!', messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy: POST /notifications/test → redirect to test-whatsapp
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
// GET /notifications/history?limit=50&type=&channel=
// View notification history for this school
// ─────────────────────────────────────────────────────────────────────────────
router.get('/history', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const query = { tenantId: req.user.tenantId };
    if (req.query.type) query.type = req.query.type;
    if (req.query.channel) query.channel = req.query.channel;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('parentId', 'name')
      .populate('studentId', 'name')
      .populate('sentBy', 'name');

    const totalSent = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'sent' });
    const totalFailed = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'failed' });
    const waSent = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'sent', channel: 'whatsapp' });
    const twSent = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'sent', channel: 'termii-whatsapp' });
    const smsSent = await Notification.countDocuments({ tenantId: req.user.tenantId, status: 'sent', channel: 'sms' });

    res.json({ totalSent, totalFailed, waSent, twSent, smsSent, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — used by attendance route to fire absence alerts
// Sends via WhatsApp and/or SMS depending on what's configured
// ─────────────────────────────────────────────────────────────────────────────
async function sendAbsenceAlert(tenantId, studentId, date) {
  try {
    const waConfig = await getWhatsAppConfig(tenantId);
    const twConfig = await getTermiiWhatsAppConfig(tenantId);
    const smsConfig = await getSMSConfig(tenantId);
    if (!waConfig && !twConfig && !smsConfig) return;

    const student = await Student.findById(studentId).populate('classId', 'name');
    if (!student) return;

    const parents = await Parent.find({
      tenantId,
      children: studentId,
      phone: { $ne: '' },
    }).select('_id name phone whatsappOptIn');

    for (const parent of parents) {
      // Meta WhatsApp alert
      if (waConfig && parent.whatsappOptIn !== false) {
        const message = templates.absenceAlert(student.name, date, waConfig.schoolName);
        const result = await sendTextMessage(waConfig, parent.phone, message);
        await logNotification(tenantId, {
          type: 'absence_alert', channel: 'whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }

      // WhatsApp via Termii alert
      if (twConfig) {
        const message = smsTemplates.absenceAlert(student.name, date, twConfig.schoolName);
        const result = await sendWhatsAppViaTermii(twConfig, parent.phone, message);
        await logNotification(tenantId, {
          type: 'absence_alert', channel: 'termii-whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }

      // SMS alert
      if (smsConfig) {
        const message = smsTemplates.absenceAlert(student.name, date, smsConfig.schoolName);
        const result = await sendSMS(smsConfig, parent.phone, message);
        await logNotification(tenantId, {
          type: 'absence_alert', channel: 'sms',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }
    }
  } catch (err) {
    console.error('[sendAbsenceAlert error]', err.message);
  }
}

module.exports = router;
module.exports.sendAbsenceAlert = sendAbsenceAlert;
