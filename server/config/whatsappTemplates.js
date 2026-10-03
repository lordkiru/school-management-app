// Approved WhatsApp message templates (Meta Cloud API).
//
// Business-initiated WhatsApp messages (anything sent outside a parent's 24-hour reply
// window) MUST use an approved template, never free text. This file is the single source
// of truth for each template's name, language and the order its {{1}}, {{2}}... variables
// are filled in - `params` lists the value names in that exact order, so params[0] is {{1}},
// params[1] is {{2}}, and so on (NOT the order they appear in the sentence).
//
// `body` is the approved text, used only to render a readable copy for the notification
// history - Meta sends its own approved text, not this string.
//
// Every school sends from its own WhatsApp Business Account, so each school's account must
// have a template with the same `name` and `language` approved, or Meta rejects the send
// with "template does not exist" (error 132001).
const WHATSAPP_TEMPLATES = {
  absenceAlert: {
    name: 'attendance_absence_alert',
    language: 'en', // "English" in WhatsApp Manager; en_US / en_GB are different codes
    params: ['schoolName', 'studentName', 'date'],
    body: 'Attendance Alert from {{1}}: Your child {{2}} was absent today, {{3}}. Contact the school office if this seems incorrect.',
  },

  feeReminder: {
    name: 'fee_payment_reminder',
    language: 'en',
    // The sentence reads "{{1}} ... {{3}} in fees for {{2}} ... as of {{4}}": the amount is {{3}}.
    params: ['schoolName', 'studentName', 'amount', 'asOfDate'],
    body: 'Fee Notice from {{1}}: Our records show {{3}} in fees for {{2}} is outstanding as of {{4}}. View and pay via the parent portal.',
  },

  resultPublished: {
    name: 'results_published',
    language: 'en',
    params: ['schoolName', 'studentName', 'term'],
    body: "Academic Update from {{1}}: {{2}}'s {{3}} results are now available. Please visit the parent portal to view them.",
  },

  // Not wired to a screen yet (the app has no exam dates / closure notices to send).
  examNotice: {
    name: 'examtest_schedule_reminder',
    language: 'en',
    params: ['schoolName', 'studentName', 'assessment', 'scheduledFor'],
    body: 'Exam Notice from {{1}}: {{2}} has a {{3}} scheduled for {{4}}. Please ensure preparedness.',
  },

  // NOTE: the name below is exactly as supplied - "anouncement" (one n) with a trailing
  // underscore. Confirm it character-for-character against WhatsApp Manager before using it.
  schoolClosure: {
    name: 'school_closure_anouncement_',
    language: 'en',
    params: ['schoolName', 'closedOn', 'reason', 'resumeOn'],
    body: 'Notice from {{1}}: School will be closed {{2}} due to {{3}}. Classes will resume on {{4}} as scheduled.',
  },
};

// Also not wired yet. pat_meeting_reminder is exactly as supplied ("pat", not "pta") and its
// language was not stated, so en is assumed - confirm both against WhatsApp Manager.
WHATSAPP_TEMPLATES.parentTeacherMeeting = {
  name: 'pat_meeting_reminder',
  language: 'en',
  params: ['schoolName', 'meetingDate'],
  body: 'Reminder from {{1}}: A Parent-Teacher meeting has been scheduled for {{2}}. Your attendance would be appreciated.',
};

// Not wired yet: the attendance register records no arrival time for {{4}}.
WHATSAPP_TEMPLATES.lateAlert = {
  name: 'attendance_late_alert',
  language: 'en',
  params: ['schoolName', 'studentName', 'date', 'arrivalTime'],
  body: 'Attendance Alert from {{1}}: {{2}} was marked late for school today, {{3}}, arriving at {{4}}. Please ensure timely arrival going forward.',
};

module.exports = { WHATSAPP_TEMPLATES };
