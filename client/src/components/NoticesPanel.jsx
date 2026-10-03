import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

// Each notice is a fixed, pre-approved WhatsApp (Meta) template, so every field is required and
// the wording can't be edited. Field names must match the template's params on the server
// (server/config/whatsappTemplates.js).
const NOTICE_TYPES = [
  {
    value: 'parentTeacherMeeting',
    label: '🤝 Parent-Teacher Meeting',
    requiresClass: false,
    fields: [
      { name: 'meetingDate', label: 'Meeting date and time', placeholder: 'e.g. Saturday 11 October, 10:00 AM' },
    ],
  },
  {
    value: 'schoolClosure',
    label: '🏫 School Closure',
    requiresClass: false,
    fields: [
      { name: 'closedOn', label: 'Closed on', placeholder: 'e.g. Monday 13 October' },
      { name: 'reason', label: 'Reason', placeholder: 'e.g. a public holiday' },
      { name: 'resumeOn', label: 'Classes resume on', placeholder: 'e.g. Tuesday 14 October' },
    ],
  },
  {
    value: 'examNotice',
    label: '📝 Exam / Test Notice',
    requiresClass: true,
    fields: [
      { name: 'assessment', label: 'Exam or test', placeholder: 'e.g. Mathematics test' },
      { name: 'scheduledFor', label: 'Date and time', placeholder: 'e.g. Monday 6 October, 9:00 AM' },
    ],
  },
];

const inputClass = 'w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

function NoticesPanel({ classes }) {
  const [type, setType] = useState(NOTICE_TYPES[0].value);
  const [classId, setClassId] = useState('');
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const notice = NOTICE_TYPES.find((n) => n.value === type);
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };

  const changeType = (value) => {
    setType(value);
    setFields({});
    setStatus('');
    setError('');
  };

  const post = (dryRun) =>
    fetch(`${import.meta.env.VITE_API_URL}/notifications/notice`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, classId: classId || undefined, fields, dryRun }),
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');
    setBusy(true);
    try {
      // First ask the server what would be sent (recipient count + the exact wording), then confirm.
      const previewRes = await post(true);
      const preview = await previewRes.json();
      if (!previewRes.ok) { setError(preview.error); return; }

      const confirmed = window.confirm(
        `Send this WhatsApp notice to ${preview.recipients} parent(s) (${preview.messages} message${preview.messages === 1 ? '' : 's'})?\n\n` +
        `Preview:\n${preview.sample}\n\nThis cannot be undone.`
      );
      if (!confirmed) return;

      const res = await post(false);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      const problems = (data.errors || []).map((x) => `${x.error} (${x.count})`).join('; ');
      setStatus(data.failed > 0 ? `⚠️ ${data.message}. ${problems}` : `✅ ${data.message}`);
      setFields({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-800 dark:text-white">Send a Notice</h3>
        <p className="text-xs text-slate-500 dark:text-gray-400">
          Sent over WhatsApp (Meta) using an approved template, so the wording is fixed and every field is required.
          Parents without a phone number, or who opted out of WhatsApp, are skipped.
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {status && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg text-sm font-medium">
            {status}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Notice</label>
          <select value={type} onChange={(e) => changeType(e.target.value)} className={inputClass}>
            {NOTICE_TYPES.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">
            {notice.requiresClass ? 'Class' : 'Send to'}
          </label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            required={notice.requiresClass}
            className={inputClass}
          >
            <option value="">{notice.requiresClass ? '-- Choose a class --' : 'All parents in the school'}</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>{cls.name}{cls.section ? ` (${cls.section})` : ''}</option>
            ))}
          </select>
          {notice.requiresClass && (
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
              Each parent gets one message per child in this class, naming the child.
            </p>
          )}
        </div>

        {notice.fields.map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">{f.label}</label>
            <input
              type="text"
              value={fields[f.name] || ''}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
              placeholder={f.placeholder}
              maxLength={100}
              required
              className={inputClass}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 rounded-lg transition"
        >
          {busy ? 'Checking...' : 'Review & Send'}
        </button>
      </form>
    </div>
  );
}

export default NoticesPanel;
