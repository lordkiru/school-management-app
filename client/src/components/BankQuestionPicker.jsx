import { useState, useEffect } from 'react';

const DIFFICULTIES = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// "Add questions from Lemida question bank": pulls random approved questions for a subject (and
// optionally some topics) into the test being built. The questions are copied into the form, where the
// teacher can still edit them; saving the test copies them again, so later bank edits never change it.
function BankQuestionPicker({ onAdd, inputClass }) {
  const [subjects, setSubjects] = useState(null); // null while loading
  const [loadError, setLoadError] = useState('');
  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/bank/subjects`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load the question bank');
        setSubjects(data);
      } catch (err) {
        setLoadError(err.message);
        setSubjects([]);
      }
    };
    load();
  }, []);

  const selected = (subjects || []).find((s) => s.subject === subject);

  const chooseSubject = (value) => {
    setSubject(value);
    setTopics([]);
    setMessage(null);
  };

  const toggleTopic = (topic) =>
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));

  const handleAdd = async () => {
    setMessage(null);
    const wanted = Number(count);
    if (!subject) return setMessage({ ok: false, text: 'Choose a subject first.' });
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > 60) {
      return setMessage({ ok: false, text: 'Choose a number of questions between 1 and 60.' });
    }

    setAdding(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/bank/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ subject, topics: topics.length ? topics : undefined, count: wanted, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add questions');

      if (data.questions.length === 0) {
        setMessage({ ok: false, text: 'No approved questions match those choices. Try other topics or a mixed difficulty.' });
      } else {
        onAdd(data.questions);
        setMessage({
          ok: true,
          text:
            data.returned < data.requested
              ? `Added ${data.returned} questions. Only ${data.returned} approved questions match, fewer than the ${data.requested} you asked for.`
              : `Added ${data.returned} questions. You can edit them below.`,
        });
      }
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mb-4 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20">
      <h3 className="font-semibold text-slate-800 dark:text-white mb-1">Add questions from Lemida question bank</h3>
      <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
        Random approved questions, with their topic and explanation filled in. You can edit them before saving.
      </p>

      {subjects === null ? (
        <p className="text-sm text-slate-500 dark:text-gray-400">Loading the question bank...</p>
      ) : loadError ? (
        <p className="text-sm text-rose-700 dark:text-rose-400">{loadError}</p>
      ) : subjects.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-gray-400">The question bank has no approved questions yet.</p>
      ) : (
        <>
          <label htmlFor="bank-subject" className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
            Bank subject
          </label>
          <select id="bank-subject" value={subject} onChange={(e) => chooseSubject(e.target.value)} className={inputClass}>
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject} ({s.total} questions)
              </option>
            ))}
          </select>

          {selected && (
            <fieldset className="mb-3">
              <legend className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
                Topics <span className="text-xs text-slate-500 dark:text-gray-400">(none ticked = all topics)</span>
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {selected.topics.map((t) => (
                  <label key={t.topic} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={topics.includes(t.topic)} onChange={() => toggleTopic(t.topic)} />
                    {t.topic} <span className="text-xs text-slate-500 dark:text-gray-400">({t.count})</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bank-count" className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
                Number of questions
              </label>
              <input
                id="bank-count"
                type="number"
                min={1}
                max={60}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bank-difficulty" className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
                Difficulty
              </label>
              <select id="bank-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClass}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 px-3 rounded-lg transition"
          >
            {adding ? 'Adding...' : 'Add questions'}
          </button>
        </>
      )}

      {message && (
        <p
          role="status"
          className={`mt-2 text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-400'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export default BankQuestionPicker;
