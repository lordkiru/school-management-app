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

// Send an approved template to one parent, one message per chosen child. `valuesFor(student)`
// builds that child's template values from real records (or returns null to skip the child).
// Only the parent's own children are accepted, so a request cannot message about another family.
async function sendTemplatePerChild({ tenantId, config, parent, studentIds, sentBy, templateKey, logType, valuesFor, nothingToSendError }) {
  const ownChildren = new Set((parent.children || []).map(String));
  const ids = [...new Set(studentIds.map(String))].filter((id) => ownChildren.has(id));
  const students = await Student.find({ _id: { $in: ids }, tenantId });

  let sent = 0, failed = 0;
  const errors = [];
  for (const student of students) {
    const values = await valuesFor(student);
    if (!values) continue;

    const result = await sendTemplateMessage(config, parent.phone, templateKey, values);
    await logNotification(tenantId, {
      type: logType, channel: 'whatsapp',
      recipientPhone: parent.phone, recipientName: parent.name,
      parentId: parent._id, studentId: student._id,
      message: renderTemplateBody(templateKey, values),
      status: result.success ? 'sent' : 'failed',
      metaMessageId: result.messageId || '', errorMessage: result.error || '',
      sentAt: result.success ? new Date() : null, sentBy,
    });
    if (result.success) sent++;
    else { failed++; errors.push(`${student.name}: ${result.error}`); }
  }

  if (sent + failed === 0) return { success: false, sent, failed, error: nothingToSendError };
  return { success: sent > 0, sent, failed, ...(errors.length ? { error: errors.join('; ') } : {}) };
}

// Fee reminder: amounts come from the real Fee records (largest outstanding balance, matching
// template-preview), never from text typed into the message box. Fully-paid children are skipped.
function sendFeeReminderViaWhatsApp({ tenantId, config, ...rest }) {
  return sendTemplatePerChild({
    tenantId, config, ...rest,
    templateKey: 'feeReminder', logType: 'fee_reminder',
    nothingToSendError: 'None of the selected children have outstanding fees',
    valuesFor: async (student) => {
      const fees = await Fee.find({ tenantId, studentId: student._id });
      const outstanding = fees.filter((f) => f.balance > 0).sort((a, b) => b.balance - a.balance);
      if (outstanding.length === 0) return null; // nothing owed - nothing to remind
      return {
        schoolName: config.schoolName,
        studentName: student.name,
        amount: formatNaira(outstanding[0].balance),
        asOfDate: formatDate(new Date()),
      };
    },
  });
}

// Results published: one message per chosen child for the chosen term.
function sendResultsViaWhatsApp({ config, term, ...rest }) {
  return sendTemplatePerChild({
    config, ...rest,
    templateKey: 'resultPublished', logType: 'result_published',
    nothingToSendError: 'None of the selected children could be found for this parent',
    valuesFor: async (student) => ({ schoolName: config.schoolName, studentName: student.name, term }),
  });
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
// Body: { parentId, message, channel?, template?, studentIds?, term? }
// channel: 'whatsapp' | 'termii-whatsapp' | 'sms' | 'both' | 'all'
// template: 'custom' (default) | 'feeReminder' | 'resultPublished' - which Messaging template the
//   message came from. Meta WhatsApp needs it (plus studentIds) to pick an approved template;
//   SMS and Termii keep sending `message` as written.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { parentId, message, channel = 'whatsapp', template = 'custom', studentIds = [], term } = req.body;
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
        } else if (template === 'resultPublished') {
          results.whatsapp = term
            ? await sendResultsViaWhatsApp({
                tenantId: req.user.tenantId, config, parent, term,
                studentIds: Array.isArray(studentIds) ? studentIds : [], sentBy: req.user.id,
              })
            : { success: false, error: 'A term is required to send results' };
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
// POST /notifications/notice
// Template-only announcements over Meta WhatsApp: PTA meeting, school closure, exam notice.
// Body: { type, classId?, fields, dryRun? }
//   type:   'parentTeacherMeeting' | 'schoolClosure' | 'examNotice'
//   fields: the template's own values (named exactly like its params in whatsappTemplates.js)
//   dryRun: true returns the recipient count and a rendered sample without sending anything
// Meeting and closure notices send one message per parent. An exam notice names a child, so
// it sends one message per child in the chosen class (a parent with two children in the class
// gets two). Parents without a phone, or who opted out of WhatsApp, are left out.
// ─────────────────────────────────────────────────────────────────────────────
const NOTICE_TYPES = {
  parentTeacherMeeting: { logType: 'meeting_notice', perChild: false, requiresClass: false, fields: ['meetingDate'] },
  schoolClosure: { logType: 'school_closure', perChild: false, requiresClass: false, fields: ['closedOn', 'reason', 'resumeOn'] },
  examNotice: { logType: 'exam_notice', perChild: true, requiresClass: true, fields: ['assessment', 'scheduledFor'] },
};
const NOTICE_FIELD_LABELS = {
  meetingDate: 'Meeting date and time',
  closedOn: 'Closure date',
  reason: 'Reason',
  resumeOn: 'Resume date',
  assessment: 'Exam or test',
  scheduledFor: 'Date and time',
};
const NOTICE_MAX_FIELD_LENGTH = 100;
const NOTICE_BATCH_SIZE = 5; // messages sent at once - keeps a whole-school send well inside request time limits

router.post('/notice', requireAuth, requireRole('proprietor', 'admin'), async (req, res) => {
  try {
    const { type, classId, fields = {}, dryRun = false } = req.body;
    const def = NOTICE_TYPES[type];
    if (!def) return res.status(400).json({ error: 'Unknown notice type' });

    const values = {};
    for (const name of def.fields) {
      // One line, single spaces: Meta rejects line breaks and long space runs inside variables
      const value = String(fields[name] ?? '').replace(/\s+/g, ' ').trim();
      if (!value) return res.status(400).json({ error: `${NOTICE_FIELD_LABELS[name]} is required` });
      if (value.length > NOTICE_MAX_FIELD_LENGTH) {
        return res.status(400).json({ error: `${NOTICE_FIELD_LABELS[name]} must be ${NOTICE_MAX_FIELD_LENGTH} characters or fewer` });
      }
      values[name] = value;
    }
    if (def.requiresClass && !classId) return res.status(400).json({ error: 'Choose a class for this notice' });

    const tenantId = req.user.tenantId;
    const config = await getWhatsAppConfig(tenantId);
    if (!config) {
      return res.status(400).json({ error: 'WhatsApp (Meta) is not configured or is disabled for this school. Go to Settings.' });
    }

    const studentQuery = { tenantId, status: 'Active' };
    if (classId) studentQuery.classId = classId;
    const students = await Student.find(studentQuery).select('_id name');
    const studentById = new Map(students.map((s) => [String(s._id), s]));

    const parents = await Parent.find({
      tenantId,
      children: { $in: students.map((s) => s._id) },
      phone: { $nin: ['', null] },
    }).select('_id name phone whatsappOptIn children');
    const eligible = parents.filter((p) => p.whatsappOptIn !== false);

    const messages = [];
    for (const parent of eligible) {
      if (def.perChild) {
        for (const childId of parent.children.map(String)) {
          const student = studentById.get(childId);
          if (student) messages.push({ parent, student, values: { schoolName: config.schoolName, studentName: student.name, ...values } });
        }
      } else {
        messages.push({ parent, values: { schoolName: config.schoolName, ...values } });
      }
    }
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No eligible parents found (they need a phone number and must not have opted out of WhatsApp)' });
    }

    if (dryRun) {
      return res.json({ recipients: eligible.length, messages: messages.length, sample: renderTemplateBody(type, messages[0].values) });
    }

    let sent = 0, failed = 0;
    const errorCounts = new Map();
    for (let i = 0; i < messages.length; i += NOTICE_BATCH_SIZE) {
      await Promise.all(messages.slice(i, i + NOTICE_BATCH_SIZE).map(async ({ parent, student, values: v }) => {
        const result = await sendTemplateMessage(config, parent.phone, type, v);
        await logNotification(tenantId, {
          type: def.logType, channel: 'whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student?._id || null,
          message: renderTemplateBody(type, v),
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: req.user.id,
        });
        if (result.success) sent++;
        else { failed++; errorCounts.set(result.error, (errorCounts.get(result.error) || 0) + 1); }
      }));
    }

    const errors = [...errorCounts.entries()].slice(0, 3).map(([error, count]) => ({ error, count }));
    if (sent === 0) {
      return res.status(502).json({ error: `Nothing was sent. ${errors[0]?.error || 'Unknown error'}`, sent, failed, errors });
    }
    res.json({ message: `Notice sent. Delivered to Meta: ${sent}, Failed: ${failed}`, sent, failed, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper - used by the attendance route to alert parents about a student's
// attendance (absent / late). Sends via whichever channels the school has configured:
// the approved WhatsApp template (Meta), WhatsApp via Termii, and SMS.
//   logType          - Notification type to record ('absence_alert' | 'late_alert')
//   whatsappTemplate - key in config/whatsappTemplates.js
//   whatsappValues   - (student, schoolName) => template values for the Meta message
//   smsText          - (student, schoolName) => plain text for Termii WhatsApp / SMS
// ─────────────────────────────────────────────────────────────────────────────
async function sendAttendanceAlert(tenantId, studentId, { logType, whatsappTemplate, whatsappValues, smsText }) {
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
        const values = whatsappValues(student, waConfig.schoolName);
        const result = await sendTemplateMessage(waConfig, parent.phone, whatsappTemplate, values);
        const message = renderTemplateBody(whatsappTemplate, values);
        await logNotification(tenantId, {
          type: logType, channel: 'whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }

      // WhatsApp via Termii alert
      if (twConfig) {
        const message = smsText(student, twConfig.schoolName);
        const result = await sendWhatsAppViaTermii(twConfig, parent.phone, message);
        await logNotification(tenantId, {
          type: logType, channel: 'termii-whatsapp',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }

      // SMS alert
      if (smsConfig) {
        const message = smsText(student, smsConfig.schoolName);
        const result = await sendSMS(smsConfig, parent.phone, message);
        await logNotification(tenantId, {
          type: logType, channel: 'sms',
          recipientPhone: parent.phone, recipientName: parent.name,
          parentId: parent._id, studentId: student._id, message,
          status: result.success ? 'sent' : 'failed',
          metaMessageId: result.messageId || '', errorMessage: result.error || '',
          sentAt: result.success ? new Date() : null, sentBy: null,
        });
      }
    }
  } catch (err) {
    console.error(`[${logType} error]`, err.message);
  }
}

function sendAbsenceAlert(tenantId, studentId, date) {
  return sendAttendanceAlert(tenantId, studentId, {
    logType: 'absence_alert',
    whatsappTemplate: 'absenceAlert',
    whatsappValues: (student, schoolName) => ({ schoolName, studentName: student.name, date: formatLongDate(date) }),
    smsText: (student, schoolName) => smsTemplates.absenceAlert(student.name, date, schoolName),
  });
}

// "08:15" -> "8:15 AM" (the register stores 24-hour HH:MM)
function formatClockTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Only sent when the teacher recorded an arrival time - the template needs one and the app
// will not guess it.
function sendLateAlert(tenantId, studentId, date, arrivalTime) {
  const arrival = formatClockTime(arrivalTime);
  return sendAttendanceAlert(tenantId, studentId, {
    logType: 'late_alert',
    whatsappTemplate: 'lateAlert',
    whatsappValues: (student, schoolName) => ({ schoolName, studentName: student.name, date: formatLongDate(date), arrivalTime: arrival }),
    smsText: (student, schoolName) => smsTemplates.lateAlert(student.name, date, arrival, schoolName),
  });
}

module.exports = router;
module.exports.sendAbsenceAlert = sendAbsenceAlert;
module.exports.sendLateAlert = sendLateAlert;
