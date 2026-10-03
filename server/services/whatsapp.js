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

// "message (code 131047, subcode 2494007)" from Meta's { error: { message, code, error_subcode } }.
function formatMetaError(e) {
  if (!e) return '';
  const codes = [e.code != null && `code ${e.code}`, e.error_subcode != null && `subcode ${e.error_subcode}`].filter(Boolean).join(', ');
  return `${e.message || 'Unknown Meta error'}${codes ? ` (${codes})` : ''}`;
}

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

    // Log Meta's raw answer every time. (The access token is never logged: only the
    // response body is printed, not the request config/headers.)
    const body = response.data;
    console.log(`[WhatsApp] Meta responded HTTP ${response.status} for to=${normalized} phoneNumberId=${phoneNumberId}: ${JSON.stringify(body)}`);

    // A 2xx only means Meta accepted the request. Treat a body carrying an error object, or
    // one with no message id, as a failure rather than reporting success.
    const messageId = body?.messages?.[0]?.id;
    if (body?.error || !messageId) {
      const error = formatMetaError(body?.error) || 'Meta returned a success status but no message id';
      console.error(`[WhatsApp] Treating send to ${normalized} as FAILED: ${error}`);
      return { success: false, error };
    }
    return { success: true, messageId };
  } catch (err) {
    if (err.response) {
      // Meta answered with an error status: print the whole error body (code, subcode, fbtrace_id...).
      console.error(`[WhatsApp] Meta rejected send to ${normalized} (HTTP ${err.response.status}): ${JSON.stringify(err.response.data)}`);
      const error = formatMetaError(err.response.data?.error) || err.message;
      return { success: false, error };
    }
    // No response at all (timeout, DNS, connection reset).
    console.error(`[WhatsApp] Request to Meta failed before any response (${err.code || 'no code'}): ${err.message}`);
    return { success: false, error: err.message };
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
