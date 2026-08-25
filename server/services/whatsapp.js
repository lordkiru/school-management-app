/**
 * whatsapp.js
 * Meta Cloud API (WhatsApp Business Platform) service.
 * Each school has their own Phone Number ID + Access Token stored in their School record.
 *
 * Meta API docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

const axios = require('axios');

const META_API_VERSION = 'v19.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Send a plain text WhatsApp message.
 * @param {Object} config - { phoneNumberId, accessToken }
 * @param {string} toPhone - Recipient phone number (international format, no +, e.g. "2348012345678")
 * @param {string} message - Text message body
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendTextMessage(config, toPhone, message) {
  const { phoneNumberId, accessToken } = config;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp not configured for this school' };
  }

  // Normalize phone number — strip non-digits, ensure no leading +
  const normalized = toPhone.replace(/\D/g, '');
  if (!normalized || normalized.length < 10) {
    return { success: false, error: `Invalid phone number: ${toPhone}` };
  }

  try {
    const response = await axios.post(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalized,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const messageId = response.data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    console.error(`[WhatsApp] Failed to send to ${normalized}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Build message templates for common school events.
 */
const templates = {
  absenceAlert: (studentName, date, schoolName) =>
    `Hello! 👋\n\nThis is a message from *${schoolName}*.\n\n` +
    `Your child *${studentName}* was marked *absent* today, ${new Date(date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.\n\n` +
    `If this is incorrect, please contact the school.\n\nThank you.`,

  feeReminder: (studentName, amount, dueDate, schoolName, portalUrl) =>
    `Hello! 👋\n\nThis is a reminder from *${schoolName}*.\n\n` +
    `School fees for *${studentName}* of *₦${Number(amount).toLocaleString()}* ` +
    `${dueDate ? `are due on *${new Date(dueDate).toLocaleDateString('en-NG')}*` : 'are currently outstanding'}.\n\n` +
    `Pay online: ${portalUrl || 'Contact school for payment details'}\n\nThank you.`,

  resultPublished: (studentName, term, schoolName, portalUrl) =>
    `Hello! 👋\n\nGood news from *${schoolName}*!\n\n` +
    `*${studentName}*'s ${term} results are now available.\n\n` +
    `View results here: ${portalUrl || 'Contact school for result details'}\n\nThank you.`,

  custom: (message, schoolName) =>
    `📢 *${schoolName}*\n\n${message}`,
};

module.exports = { sendTextMessage, templates };
