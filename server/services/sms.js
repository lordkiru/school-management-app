/**
 * sms.js - Termii messaging service (https://termii.com)
 * Supports both SMS and WhatsApp delivery via the same API key + sender ID.
 *
 * channel: 'dnd'       → regular SMS (works on DND numbers in Nigeria)
 * channel: 'whatsapp'  → WhatsApp message routed via Termii
 */

const axios = require('axios');

const TERMII_SEND_URL = 'https://v3.api.termii.com/api/sms/send';
const TERMII_BULK_URL = 'https://v3.api.termii.com/api/sms/send/bulk';

/**
 * Normalize a Nigerian phone number to international format (234XXXXXXXXXX)
 * Handles: 08012345678, +2348012345678, 2348012345678
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);
  if (digits.length === 10) return '234' + digits;
  if (digits.length >= 13) return digits;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — shared by SMS and WhatsApp via Termii
// ─────────────────────────────────────────────────────────────────────────────

async function _termiiSend(config, toPhone, message, channel) {
  const { apiKey, senderId } = config;
  if (!apiKey || !senderId) {
    return { success: false, error: 'Termii not configured for this school' };
  }
  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    return { success: false, error: 'Invalid phone number: ' + toPhone };
  }
  try {
    const response = await axios.post(
      TERMII_SEND_URL,
      { to: normalized, from: senderId, sms: message, type: 'plain', channel, api_key: apiKey },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    const messageId = response.data?.message_id || response.data?.message?.message_id || '';
    return { success: true, messageId: String(messageId) };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error('[Termii/' + channel + '] Failed to send to ' + normalized + ':', errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function _termiiSendBulk(config, phones, message, channel) {
  const results = [];
  let sent = 0;
  let failed = 0;
  const chunks = [];
  for (let i = 0; i < phones.length; i += 100) {
    chunks.push(phones.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    const normalized = chunk.map(normalizePhone).filter(Boolean);
    if (!normalized.length) continue;
    try {
      const response = await axios.post(
        TERMII_BULK_URL,
        { to: normalized, from: config.senderId, sms: message, type: 'plain', channel, api_key: config.apiKey },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      sent += normalized.length;
      results.push({ phones: normalized, success: true, messageId: response.data?.message_id || '' });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      failed += normalized.length;
      results.push({ phones: normalized, success: false, error: errorMsg });
      console.error('[Termii/' + channel + ' Bulk] Error:', errorMsg);
    }
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 200));
  }
  return { sent, failed, results };
}

// ── SMS (channel: dnd) ────────────────────────────────────────────────────────
async function sendSMS(config, toPhone, message) {
  return _termiiSend(config, toPhone, message, 'dnd');
}
async function sendBulkSMS(config, phones, message) {
  return _termiiSendBulk(config, phones, message, 'dnd');
}

// ── WhatsApp via Termii (channel: whatsapp) ───────────────────────────────────
// Reuses the same API key + sender ID — no extra credentials needed.
async function sendWhatsAppViaTermii(config, toPhone, message) {
  return _termiiSend(config, toPhone, message, 'whatsapp');
}
async function sendBulkWhatsAppViaTermii(config, phones, message) {
  return _termiiSendBulk(config, phones, message, 'whatsapp');
}

// ── Message templates (plain text — no markdown) ──────────────────────────────
const smsTemplates = {
  absenceAlert: (studentName, date, schoolName) =>
    `${schoolName}: Your child ${studentName} was absent today, ` +
    `${new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}. ` +
    `Contact school if incorrect.`,

  feeReminder: (studentName, amount, dueDate, schoolName) =>
    `${schoolName}: Fees for ${studentName} of N${Number(amount).toLocaleString()} ` +
    `${dueDate ? `are due ${new Date(dueDate).toLocaleDateString('en-NG')}` : 'are outstanding'}. ` +
    `Contact school to pay.`,

  resultPublished: (studentName, term, schoolName) =>
    `${schoolName}: ${studentName}'s ${term} results are now available. Visit the parent portal to view.`,

  custom: (message, schoolName) => `${schoolName}: ${message}`,
};

module.exports = {
  sendSMS,
  sendBulkSMS,
  sendWhatsAppViaTermii,
  sendBulkWhatsAppViaTermii,
  smsTemplates,
  normalizePhone,
};

