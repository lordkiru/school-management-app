// Approved WhatsApp message templates (Meta Cloud API).
//
// Business-initiated WhatsApp messages (anything sent outside a parent's 24-hour reply
// window) MUST use an approved template, never free text. This file is the single source
// of truth for each template's name, language and the order its {{1}}, {{2}}... variables
// are filled in - `params` lists the value names in that exact order.
//
// Every school sends from its own WhatsApp Business Account, so each school's account must
// have a template with the same `name` and `language` approved, or Meta rejects the send
// with "template does not exist" (error 132001).
const WHATSAPP_TEMPLATES = {
  examNotice: {
    name: 'examtest_schedule_reminder',
    language: 'en', // "English" in WhatsApp Manager; en_US / en_GB are different codes
    // Body: "Exam Notice from {{1}}: {{2}} has a {{3}} scheduled for {{4}}. Please ensure preparedness."
    params: ['schoolName', 'studentName', 'assessment', 'scheduledFor'],
  },
};

module.exports = { WHATSAPP_TEMPLATES };
