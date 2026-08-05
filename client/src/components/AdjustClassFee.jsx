import { useState, useEffect } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AdjustClassFee({ onAdjusted }) {
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [sessions, setSessions] = useState([]);
  const [amountExpected, setAmountExpected] = useState('');
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClasses(await res.json());
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSessions(data);
        const current = data.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) {
        console.error('Failed to load sessions', err);
      }
    };
    fetchSessions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/adjust-by-class`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId,
          term,
          session,
          amountExpected: Number(amountExpected),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust fees');

      setSuccess(data.message);
      setAmountExpected('');
      onAdjusted();
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
      className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 max-w-md"
    >
      <h2 className="text-lg font-bold mb-1 text-slate-800 dark:text-white">Adjust Fee for a Class</h2>
      <p className="text-xs text-slate-400 mb-4">
        Overwrites the expected fee for every student in this class who already has a record for
        this term — use this to correct a mistaken amount, not to add extra fees.
      </p>

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

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Class</label>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} required className={inputClass}>
        <option value="">Select a class</option>
        {classes.map((cls) => (
          <option key={cls._id} value={cls._id}>
            {cls.name}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Term</label>
      <select value={term} onChange={(e) => setTerm(e.target.value)} required className={inputClass}>
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Session</label>
      <select
        value={session}
        onChange={(e) => setSession(e.target.value)}
        required
        className={inputClass}
      >
        <option value="">Select a session</option>
        {sessions.map((s) => (
          <option key={s._id} value={s.name}>
            {s.name} {s.isCurrent ? '(current)' : ''}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">New Expected Amount (₦)</label>
      <input
        type="number"
        value={amountExpected}
        onChange={(e) => setAmountExpected(e.target.value)}
        required
        className={`${inputClass} mb-4`}
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition"
      >
        {loading ? 'Adjusting...' : 'Adjust Fee for Class'}
      </button>
    </form>
  );
}

export default AdjustClassFee;