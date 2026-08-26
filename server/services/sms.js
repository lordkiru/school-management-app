/**
 * sms.js
 * Termii SMS service (https://termii.com)
 * Each school stores their own Termii API key + sender ID in their School record.
 *
 * Termii API docs: https://developers.termii.com/messaging
 */

const axios = require('axios');

const TERMII_BASE_URL = 'https://v3.api.termii.com/api/sms/send';

/**
 * Normalize a Nigerian phone number to international format (234XXXXXXXXXX)
 * Handles: 08012345678, +2348012345678, 2348012345678
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);
  if (digits.length === 10) return '234' + digits; // e.g. 8012345678
  if (digits.length >= 13) return digits; // already international
  return null;
}

/**
 * Send a single SMS via Termii.
 * @param {Object} config - { apiKey, senderId }
 * @param {string} toPhone - Recipient phone number
 * @param {string} message - SMS text body
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendSMS(config, toPhone, message) {
  const { apiKey, senderId } = config;

  if (!apiKey || !senderId) {
    return { success: false, error: 'SMS not configured for this school' };
  }

  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    return { success: false, error: `Invalid phone number: ${toPhone}` };
  }

  try {
    const response = await axios.post(
      TERMII_BASE_URL,
      {
        to: normalized,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'dnd', // tries DND channel first (handles Do-Not-Disturb numbers in Nigeria)
        api_key: apiKey,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const messageId = response.data?.message_id || response.data?.message?.message_id || '';
    return { success: true, messageId: String(messageId) };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
    console.error(`[SMS] Failed to send to ${normalized}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send bulk SMS to multiple recipients via Termii.
 * Termii supports up to 100 numbers per bulk request.
 * @param {Object} config - { apiKey, senderId }
 * @param {string[]} phones - Array of phone numbers
 * @param {string} message - SMS text body
 * @returns {Promise<{sent: number, failed: number, results: Array}>}
 */
async function sendBulkSMS(config, phones, message) {
  const results = [];
  let sent = 0;
  let failed = 0;

  // Process in chunks of 100 (Termii bulk limit)
  const chunks = [];
  for (let i = 0; i < phones.length; i += 100) {
    chunks.push(phones.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const normalized = chunk.map(normalizePhone).filter(Boolean);
    if (!normalized.length) continue;

    try {
      const response = await axios.post(
        'https://v3.api.termii.com/api/sms/send/bulk',
        {
          to: normalized,
          from: config.senderId,
          sms: message,
          type: 'plain',
          channel: 'dnd',
          api_key: config.apiKey,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
      sent += normalized.length;
      results.push({ phones: normalized, success: true, messageId: response.data?.message_id || '' });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      failed += normalized.length;
      results.push({ phones: normalized, success: false, error: errorMsg });
      console.error('[SMS Bulk] Error:', errorMsg);
    }

    // Small delay between chunks
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 200));
  }

  return { sent, failed, results };
}

/**
 * SMS message templates (plain text, no markdown — SMS doesn't support it)
 */
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
    `${schoolName}: ${studentName}'s ${term} results are now available. Contact school or visit the parent portal to view.`,

  custom: (message, schoolName) =>
    `${schoolName}: ${message}`,
};

module.exports = { sendSMS, sendBulkSMS, smsTemplates, normalizePhone };
