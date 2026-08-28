import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const EMPTY_QUESTION = () => ({ text: '', options: ['', ''], correctIndex: 0, marks: 1 });

function CbtBuilder({ onTestCreated }) {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [caSlot, setCaSlot] = useState('ca1');
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const token = localStorage.getItem('token');
        const [subjectsRes, sessionsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/subjects`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setSubjects(await subjectsRes.json());
        const sessionData = await sessionsRes.json();
        setSessions(sessionData);
        const current = sessionData.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    fetchOptions();
  }, []);

  const selectedSubject = subjects.find((s) => s._id === subjectId);

  const updateQuestion = (index, patch) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIndex, oIndex, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options];
        options[oIndex] = value;
        return { ...q, options };
      })
    );
  };

  const addOption = (qIndex) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q))
    );
  };

  const removeOption = (qIndex, oIndex) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q;
        const options = q.options.filter((_, idx) => idx !== oIndex);
        const correctIndex = q.correctIndex >= options.length ? 0 : q.correctIndex;
        return { ...q, options, correctIndex };
      })
    );
  };

  const addQuestion = () => setQuestions((prev) => [...prev, EMPTY_QUESTION()]);
  const removeQuestion = (index) => setQuestions((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!subjectId) {
      setError('Choose a subject');
      return;
    }
    for (const [i, q] of questions.entries()) {
      if (!q.text.trim()) {
        setError(`Question ${i + 1} needs text`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`Question ${i + 1} has an empty option`);
        return;
      }
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          subjectId,
          classId: selectedSubject?.classId?._id || selectedSubject?.classId,
          term,
          session,
          durationMinutes: Number(durationMinutes),
          caSlot,
          questions: questions.map((q) => ({ ...q, marks: Number(q.marks) || 1 })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create test');

      setSuccess('Test created as a draft. Publish it when ready.');
      setTitle('');
      setQuestions([EMPTY_QUESTION()]);
      onTestCreated?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full mb-3 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 max-w-2xl"
    >
      <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">New CBT Test</h2>

      {error && (
        <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-green-900 text-emerald-600 dark:text-green-200 text-sm p-2 rounded-lg mb-3">
          {success}
        </div>
      )}

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="e.g. Mid-term CBT — Basic Science"
        className={inputClass}
      />

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Subject</label>
      <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className={inputClass}>
        <option value="">Select subject</option>
        {subjects.map((subj) => (
          <option key={subj._id} value={subj._id}>
            {subj.name} — {subj.classId?.name || ''}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
            {TERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Session</label>
          <select value={session} onChange={(e) => setSession(e.target.value)} required className={inputClass}>
            <option value="">Select session</option>
            {sessions.map((s) => (
              <option key={s._id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Duration (minutes)</label>
          <input
            type="number"
            min={1}
            max={300}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Feeds into</label>
          <select value={caSlot} onChange={(e) => setCaSlot(e.target.value)} className={inputClass}>
            <option value="ca1">CA1</option>
            <option value="ca2">CA2</option>
          </select>
        </div>
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 dark:text-white">Questions</h3>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Plus size={16} /> Add question
        </button>
      </div>

      {questions.map((q, qIndex) => (
        <div
          key={qIndex}
          className="mb-4 p-4 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/50"
        >
          <div className="flex items-start gap-2 mb-2">
            <span className="mt-2 text-sm font-medium text-slate-500 dark:text-gray-400">{qIndex + 1}.</span>
            <input
              type="text"
              value={q.text}
              onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
              placeholder="Question text"
              className={inputClass + ' mb-0'}
            />
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => removeQuestion(qIndex)}
                className="mt-2 text-rose-500 hover:text-rose-700"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {q.options.map((opt, oIndex) => (
            <div key={oIndex} className="flex items-center gap-2 mb-2 pl-6">
              <input
                type="radio"
                name={`correct-${qIndex}`}
                checked={q.correctIndex === oIndex}
                onChange={() => updateQuestion(qIndex, { correctIndex: oIndex })}
                title="Mark as correct answer"
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                placeholder={`Option ${oIndex + 1}`}
                className={inputClass + ' mb-0'}
              />
              {q.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(qIndex, oIndex)}
                  className="text-rose-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          <div className="pl-6 flex items-center gap-4 mt-2">
            {q.options.length < 6 && (
              <button
                type="button"
                onClick={() => addOption(qIndex)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + Add option
              </button>
            )}
            <label className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1">
              Marks:
              <input
                type="number"
                min={1}
                value={q.marks}
                onChange={(e) => updateQuestion(qIndex, { marks: e.target.value })}
                className="w-14 p-1 rounded border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white"
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-lg transition"
      >
        {loading ? 'Saving...' : 'Save as draft'}
      </button>
    </form>
  );
}

export default CbtBuilder;
