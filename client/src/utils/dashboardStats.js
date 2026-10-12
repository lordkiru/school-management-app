// Pure data logic for the school admin dashboard - no React, no fetching - so it can be tested on
// its own. Dashboard.jsx fetches the raw API data and hands it to these functions.
import { SCHOOL_LEVELS } from '../constants/schoolLevels';

const GROUP_WINDOW_MS = 10 * 60 * 1000; // rows created within 10 minutes of each other are one "event"

const MESSAGE_TITLES = {
  absence_alert: 'Absence alert',
  late_alert: 'Late alert',
  fee_reminder: 'Fee reminder',
  result_published: 'Results notice',
  meeting_notice: 'PTA meeting notice',
  school_closure: 'School closure notice',
  exam_notice: 'Exam notice',
  custom_broadcast: 'Broadcast',
  custom_individual: 'Message',
};
const CHANNEL_LABELS = { whatsapp: 'WhatsApp', 'termii-whatsapp': 'WhatsApp (Termii)', sms: 'SMS' };
const CHANNEL_ORDER = ['whatsapp', 'termii-whatsapp', 'sms'];

export const formatNaira = (amount) => `₦${Number(amount || 0).toLocaleString()}`;

// "Just now" / "5m ago" / "3h ago" / "2d ago", then a plain date once it is over a week old.
export function relativeTime(date, now = Date.now()) {
  const diff = now - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

// The app has no "current term" setting - only a current *session* - and a term exists only on
// each fee record. So the term is inferred: the term whose fee records were created most
// recently inside the current session. Returns { term, session }, or term: null when it can't
// be told (no fee records yet).
export function resolveCurrentTerm({ fees, sessions }) {
  const currentSession = (sessions || []).find((s) => s.isCurrent)?.name || null;
  const pool = currentSession ? fees.filter((f) => f.session === currentSession) : fees;
  if (pool.length === 0) return { term: null, session: currentSession };
  const latest = pool.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
  return { term: latest.term, session: latest.session };
}

// Headline numbers and the two section breakdowns. `fees` is only used when canSeeFees.
export function buildDashboardModel({ students, classes, fees, school, sessions, canSeeFees }) {
  const enabledSections = Array.isArray(school?.schoolLevels) && school.schoolLevels.length > 0
    ? SCHOOL_LEVELS.filter((s) => school.schoolLevels.includes(s))
    : SCHOOL_LEVELS;

  const classSection = {};
  classes.forEach((cls) => { classSection[cls._id] = cls.section; });

  const studentSection = {};
  students.forEach((student) => {
    const classId = student.classId?._id || student.classId;
    studentSection[student._id] = classSection[classId];
  });

  // A record with no section at all (not yet linked to a class) is kept in the totals - it is
  // unclassified, not deselected. Only records in a section the school has since turned OFF drop out.
  const isVisibleSection = (section) => !section || enabledSections.includes(section);

  const visibleClasses = classes.filter((cls) => isVisibleSection(cls.section));
  const visibleStudents = students.filter((s) => isVisibleSection(studentSection[s._id]));

  const studentCounts = Object.fromEntries(SCHOOL_LEVELS.map((s) => [s, 0]));
  let unassignedStudents = 0;
  students.forEach((student) => {
    const section = studentSection[student._id];
    if (section && studentCounts[section] !== undefined) studentCounts[section]++;
    else unassignedStudents++;
  });

  const model = {
    enabledSections,
    totalStudents: visibleStudents.length,
    totalClasses: visibleClasses.length,
    unassignedStudents,
    studentsBySection: enabledSections.map((section) => ({ section, count: studentCounts[section] })),
    session: (sessions || []).find((s) => s.isCurrent)?.name || null,
    term: null,
    fees: null,
  };

  if (!canSeeFees) return model;

  const { term, session } = resolveCurrentTerm({ fees, sessions });
  model.term = term ? { term, session } : null;

  // Only this term's fees (when a term could be worked out), and only visible sections.
  const termFees = fees.filter((fee) => {
    const studentId = fee.studentId?._id || fee.studentId;
    if (!isVisibleSection(studentSection[studentId])) return false;
    return term ? fee.term === term && fee.session === session : true;
  });

  // Per-fee outstanding is clamped at 0 so an overpaid record can't cancel out someone else's debt.
  const outstandingOf = (fee) => Math.max(0, fee.amountExpected - fee.amountPaid);
  const expected = termFees.reduce((sum, f) => sum + f.amountExpected, 0);
  const collected = termFees.reduce((sum, f) => sum + f.amountPaid, 0);
  const outstanding = termFees.reduce((sum, f) => sum + outstandingOf(f), 0);

  const outstandingBySection = Object.fromEntries(SCHOOL_LEVELS.map((s) => [s, 0]));
  termFees.forEach((fee) => {
    const studentId = fee.studentId?._id || fee.studentId;
    const section = studentSection[studentId];
    if (section && outstandingBySection[section] !== undefined) outstandingBySection[section] += outstandingOf(fee);
  });

  model.fees = {
    expected,
    collected,
    outstanding,
    percentCollected: expected > 0 ? (collected / expected) * 100 : 0,
    bySection: enabledSections.map((section) => ({ section, outstanding: outstandingBySection[section] })),
  };
  return model;
}

// Rows for a breakdown card: each bar is scaled against the largest value in the list, so the
// biggest section always fills the bar (as in the design).
export function toBreakdownRows(items, getValue, formatValue) {
  const max = Math.max(0, ...items.map(getValue));
  return items.map((item) => ({
    key: item.section,
    label: item.section,
    valueLabel: formatValue(getValue(item)),
    pct: max > 0 ? (getValue(item) / max) * 100 : 0,
  }));
}

// Recent activity, built only from data that already exists: fee payments, new enrolments and
// messages the school sent. Bulk rows (an import of 200 students, a broadcast to 300 parents)
// collapse into one event instead of flooding the feed.
export function buildActivity({ students = [], fees = [], notifications = [], limit = 6 }) {
  const events = [];

  fees.forEach((fee) => {
    (fee.payments || []).forEach((payment, i) => {
      const when = payment.paymentDate || fee.updatedAt || fee.createdAt;
      if (!when) return;
      const className = fee.studentId?.classId?.name;
      events.push({
        id: `pay-${fee._id}-${i}`,
        ts: new Date(when).getTime(),
        tone: 'green',
        title: `Fee payment received — ${formatNaira(payment.amount)}`,
        meta: [fee.studentId?.name || 'Student', className].filter(Boolean).join(' · '),
      });
    });
  });

  const byNewest = [...students]
    .filter((s) => s.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const enrolGroups = [];
  byNewest.forEach((student) => {
    const ts = new Date(student.createdAt).getTime();
    const group = enrolGroups[enrolGroups.length - 1];
    if (group && group.oldest - ts <= GROUP_WINDOW_MS) { group.items.push(student); group.oldest = ts; }
    else enrolGroups.push({ ts, oldest: ts, items: [student] });
  });
  enrolGroups.forEach((group) => {
    const first = group.items[0];
    const className = first.classId?.name;
    events.push(group.items.length === 1
      ? {
        id: `enrol-${first._id}`, ts: group.ts, tone: 'brand',
        title: `New student enrolled${className ? ` — ${className}` : ''}`,
        meta: `${first.name} · ${first.admissionNumber}`,
      }
      : {
        id: `enrol-${first._id}`, ts: group.ts, tone: 'brand',
        title: `${group.items.length} students enrolled`,
        meta: `Latest: ${first.name}`,
      });
  });

  // Messages arrive newest-first, one row per recipient per channel. Same type within 10 minutes = one send.
  const msgGroups = [];
  notifications.forEach((n) => {
    const ts = new Date(n.createdAt).getTime();
    const group = msgGroups.find((g) => g.type === n.type && g.oldest - ts <= GROUP_WINDOW_MS && ts <= g.ts);
    if (group) { group.rows.push(n); group.oldest = ts; }
    else msgGroups.push({ type: n.type, ts, oldest: ts, rows: [n] });
  });
  msgGroups.forEach((group) => {
    const recipients = new Set(group.rows.map((r) => String(r.parentId?._id || r.parentId || r.recipientPhone)));
    const failed = group.rows.filter((r) => r.status === 'failed').length;
    const sent = group.rows.length - failed;
    // Fixed order so the same send always reads the same ("WhatsApp & SMS"), whatever row came first
    const used = new Set(group.rows.map((r) => r.channel));
    const channels = [...CHANNEL_ORDER.filter((c) => used.has(c)), ...[...used].filter((c) => !CHANNEL_ORDER.includes(c))]
      .map((c) => CHANNEL_LABELS[c] || c)
      .join(' & ');
    const label = MESSAGE_TITLES[group.type] || 'Message';
    const single = recipients.size === 1;
    const name = group.rows[0].parentId?.name || group.rows[0].recipientName;
    events.push({
      id: `msg-${group.rows[0]._id}`,
      ts: group.ts,
      tone: sent === 0 ? 'red' : failed > 0 ? 'amber' : 'brand',
      title: single && name ? `${label} sent to ${name}` : `${label} sent to ${recipients.size} parent${recipients.size === 1 ? '' : 's'}`,
      meta: `Via ${channels}${failed > 0 ? ` · ${failed} failed` : ''}`,
    });
  });

  return events.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
