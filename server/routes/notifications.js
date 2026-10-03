const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const School = require('../models/School');
const Parent = require('../models/Parent');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const Notification = require('../models/Notification');
const { sendTemplateMessage, renderTemplateBody } = require('../services/whatsapp');
const { sendSMS, sendBulkSMS, sendWhatsAppViaTermii, sendBulkWhatsAppViaTermii, smsTemplates, smsTemplateBodies } = require('../services/sms');

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

// Meta WhatsApp rule: anything the school starts (rather than a reply inside the 24-hour
// window after a parent messages first) must be an approved template. The app does not track
// inbound messages, so free text over Meta is refused up front with an explanation instead of
// being sent and silently failing later (Meta error 131047).
const WHATSAPP_FREE_TEXT_ERROR =
  'WhatsApp (Meta) cannot send free-text messages to parents who have not messaged the school in the last 24 hours. Use an approved template message (such as Fee Reminder) or SMS.';
const whatsappNoTemplateError = (template) =>
  `No approved WhatsApp template is set up for "${template}" yet. Use SMS for this message.`;

const formatLongDate = (d) =>
  new Date(d).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (d) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
const formatNaira = (amount) => `₦${Number(amount).toLocaleString()}`;

// Send the approved fee-reminder template, one message per child, for the chosen children of
// one parent. Amounts come from the real Fee records (largest outstanding balance, matching
// template-preview), never from text typed into the message box. Fully-paid children are
// skipped. Only the parent's own children are accepted.
async function sendFeeReminderViaWhatsApp({ tenantId, config, parent, studentIds, sentBy }) {
  const ownChildren = new Set((parent.children || []).map(String));
  const ids = [...new Set(studentIds.map(String))].filter((id) => ownChildren.has(id));
  const students = await Student.find({ _id: { $in: ids }, tenantId });

  let sent = 0, failed = 0;
  const errors = [];
  for (const student of students) {
    const fees = await Fee.find({ tenantId, studentId: student._id });
    const outstanding = fees.filter((f) => f.balance > 0).sort((a, b) => b.balance - a.balance);
    if (outstanding.length === 0) continue; // nothing owed - nothing to remind

    const values = {
      schoolName: config.schoolName,
      studentName: student.name,
      amount: formatNaira(outstanding[0].balance),
      asOfDate: formatDate(new Date()),
    };
    const result = await sendTemplateMessage(config, parent.phone, 'feeReminder', values);
    await logNotification(tenantId, {
      type: 'fee_reminder', channel: 'whatsapp',
      recipientPhone: parent.phone, recipientName: parent.name,
      parentId: parent._id, studentId: student._id,
      message: renderTemplateBody('feeReminder', values),
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.messageId || '', errorMessage: result.error || '',
      sentAt: result.success ? new Date() : null, sentBy,
    });
    if (result.success) sent++;
    else { failed++; errors.push(`${student.name}: ${result.error}`); }
  }

  if (sent + failed === 0) return { success: false, sent, failed, error: 'None of the selected children have outstanding fees' };
  return { success: sent > 0, sent, failed, ...(errors.length ? { error: errors.join('; ') } : {}) };
}

// A test send is business-initiated too, so it also needs an approved template. The fee
// template is used with an unmistakable test child so nobody mistakes it for a real notice.
function sendWhatsAppTest(config, phone) {
  return sendTemplateMessage(config, phone, 'feeReminder', {
    schoolName: config.schoolName,
    studentName: 'TEST ONLY - please ignore this message',
    amount: formatNaira(0),
    asOfDate: formatDate(new Date()),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications/template-preview?template=feeReminder|resultPublished&studentIds=id1,id2&term=
// Builds the message body (no school name prefix — the send routes add that)
// for one or more real children (a parent may have several), combining them
// into one message. Fully-paid children are silently left out of a Fee
// Reminder rather than erroring. Does not send anything itself.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/template-preview', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { template, studentIds, term } = req.query;

    if (!['feeReminder', 'resultPublished'].includes(template)) {
      return res.status(400).json({ error: 'Unknown template' });
    }

    const ids = String(studentIds || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ error: 'At least one child is required' });

    const students = await Student.find({ _id: { $in: ids }, tenantId: req.user.tenantId });
    if (students.length === 0) return res.status(404).json({ error: 'Student(s) not found' });
    const studentById = new Map(students.map((s) => [String(s._id), s]));

    if (template === 'feeReminder') {
      const entries = [];
      for (const id of ids) {
        const student = studentById.get(id);
        if (!student) continue;
        const fees = await Fee.find({ tenantId: req.user.tenantId, studentId: id });
        const outstanding = fees.filter((f) => f.balance > 0).sort((a, b) => b.balance - a.balance);
        // Fully-paid children are silently skipped — no point reminding about a debt that doesn't exist
        if (outstanding.length > 0) entries.push({ name: student.name, amount: outstanding[0].balance });
      }
      if (entries.length === 0) {
        return res.status(404).json({ error: 'None of the selected children have outstanding fees' });
      }
      const portalUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/portal?tenantId=${req.user.tenantId}` : null;
      return res.json({ message: smsTemplateBodies.feeReminderMultiple(entries, portalUrl) });
    }

    // resultPublished
    if (!term) return res.status(400).json({ error: 'term is required for this template' });
    const names = ids.map((id) => studentById.get(id)?.name).filter(Boolean);
    const message = smsTemplateBodies.resultPublishedMultiple(names, term);
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /notifications/send
// Send a custom message to a single parent
// Body: { parentId, message, channel?, template?, studentIds? }
// channel: 'whatsapp' | 'termii-whatsapp' | 'sms' | 'both' | 'all'
// template: 'custom' (default) | 'feeReminder' | 'resultPublished' - which Messaging template the
//   message came from. Meta WhatsApp needs it (plus studentIds) to pick an approved template;
//   SMS and Termii keep sending `message` as written.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { parentId, message, channel = 'whatsapp', template = 'custom', studentIds = [] } = req.body;
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
        } else if (template === 'feeReminder') {
          results.whatsapp = await sendFeeReminderViaWhatsApp({
            tenantId: req.user.tenantId, config, parent,
            studentIds: Array.isArray(studentIds) ? studentIds : [], sentBy: req.user.id,
          });
        } else if (template === 'custom') {
          results.whatsapp = { success: false, error: WHATSAPP_FREE_TEXT_ERROR };
        } else {
          results.whatsapp = { success: false, error: whatsappNoTemplateError(template) };
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
    let waNote = '';

    // ── Meta WhatsApp broadcast ──
    if (useWhatsapp) {
      const waConfig = await getWhatsAppConfig(req.user.tenantId);
      if (!waConfig) {
        waFailed = parents.length;
      } else {
        // A broadcast is free text, which Meta only accepts inside a 24-hour reply window.
        // Not sent - say so rather than letting every message fail at Meta.
        waFailed = parents.filter((p) => p.whatsappOptIn !== false).length;
        waNote = WHATSAPP_FREE_TEXT_ERROR;
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
      message: `Broadcast complete. Sent: ${totalSent}, Failed: ${totalFailed}${waNote ? `. WhatsApp (Meta) was not sent: ${waNote}` : ''}`,
      sent: totalSent, failed: totalFailed,
      whatsapp: { sent: waSent, failed: waFailed, ...(waNote ? { error: waNote } : {}) },
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

    const result = await sendWhatsAppTest(config, phone);

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

    const result = await sendWhatsAppTest(config, phone);

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
        const values = { schoolName: waConfig.schoolName, studentName: student.name, date: formatLongDate(date) };
        const result = await sendTemplateMessage(waConfig, parent.phone, 'absenceAlert', values);
        const message = renderTemplateBody('absenceAlert', values);
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
