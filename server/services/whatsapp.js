/**
 * whatsapp.js
 * Meta Cloud API (WhatsApp Business Platform) service.
 * Each school has their own Phone Number ID + Access Token stored in their School record.
 *
 * Meta API docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

const axios = require('axios');
const { WHATSAPP_TEMPLATES } = require('../config/whatsappTemplates');

const META_API_VERSION = 'v19.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Plain-English follow-ups for the Meta error codes people actually hit. Codes per Meta's
// Cloud API error reference; anything not listed just shows Meta's own message.
const META_ERROR_HINTS = {
  131047: 'Outside the 24-hour reply window: business-initiated messages must use an approved template',
  132000: 'The number of template variables sent does not match the template',
  132001: 'No approved template with that name and language exists on this WhatsApp Business Account',
  132012: 'A template variable has the wrong format',
  132015: 'This template is paused by Meta',
  132016: 'This template has been disabled by Meta',
};

// "message (code 131047, subcode 2494007) - hint" from Meta's { error: { message, code, error_subcode } }.
function formatMetaError(e) {
  if (!e) return '';
  const codes = [e.code != null && `code ${e.code}`, e.error_subcode != null && `subcode ${e.error_subcode}`].filter(Boolean).join(', ');
  const hint = META_ERROR_HINTS[e.code];
  return `${e.message || 'Unknown Meta error'}${codes ? ` (${codes})` : ''}${hint ? ` - ${hint}` : ''}`;
}

// Strip anything Meta refuses inside a template variable: line breaks, tabs and runs of 4+
// spaces, plus surrounding whitespace. Returns '' for null/undefined.
function sanitizeTemplateValue(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim();
}

// Normalize a phone number to digits only (no leading +). Returns null if it can't be valid.
function normalizePhone(toPhone) {
  const normalized = String(toPhone || '').replace(/\D/g, '');
  return normalized.length >= 10 ? normalized : null;
}

// POST one message payload to Meta's /messages endpoint and turn the outcome into
// { success, messageId?, error? }. Shared by every message type so logging and failure
// handling behave identically for text and template sends.
async function postMessage(config, normalized, payload) {
  const { phoneNumberId, accessToken } = config;
  try {
    const response = await axios.post(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', to: normalized, ...payload },
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
 * Send a plain text WhatsApp message.
 * Only valid inside the 24-hour window after the recipient last messaged the school (e.g. a
 * reply to a parent who wrote first). Business-initiated messages must use sendTemplateMessage.
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

  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    return { success: false, error: `Invalid phone number: ${toPhone}` };
  }

  return postMessage(config, normalized, {
    type: 'text',
    text: { preview_url: false, body: message },
  });
}

/**
 * Send an approved template message - required for any business-initiated contact.
 * @param {Object} config - { phoneNumberId, accessToken }
 * @param {string} toPhone - Recipient phone number
 * @param {string} templateKey - Key in config/whatsappTemplates.js (e.g. 'examNotice')
 * @param {Object} values - Named values for the template's variables, e.g.
 *   { schoolName, studentName, assessment, scheduledFor } (their order is set in the template config)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendTemplateMessage(config, toPhone, templateKey, values = {}) {
  const { phoneNumberId, accessToken } = config;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'WhatsApp not configured for this school' };
  }

  const template = WHATSAPP_TEMPLATES[templateKey];
  if (!template) {
    return { success: false, error: `No WhatsApp template configured for "${templateKey}"` };
  }

  const normalized = normalizePhone(toPhone);
  if (!normalized) {
    return { success: false, error: `Invalid phone number: ${toPhone}` };
  }

  // Fill {{1}}, {{2}}... in the configured order. Meta rejects empty variables, so catch a
  // missing value here with a clear message instead of a vague Meta error after the round trip.
  const parameters = [];
  for (const name of template.params) {
    const text = sanitizeTemplateValue(values[name]);
    if (!text) {
      return { success: false, error: `Missing value "${name}" for WhatsApp template "${template.name}"` };
    }
    parameters.push({ type: 'text', text });
  }

  return postMessage(config, normalized, {
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      components: [{ type: 'body', parameters }],
    },
  });
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

module.exports = { sendTextMessage, sendTemplateMessage, templates };
