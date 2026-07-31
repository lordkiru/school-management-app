import { useState, useEffect, useRef } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AddFee({ onFeeAdded }) {
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [amountExpected, setAmountExpected] = useState('');
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('${import.meta.env.VITE_API_URL}/students', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStudents(await res.json());
      } catch (err) {
        console.error('Failed to load students', err);
      }
    };
    fetchStudents();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchingStudents = studentQuery
    ? students.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()))
    : students.slice(0, 20);

  const handleSelectStudent = (student) => {
    setStudentId(student._id);
    setStudentQuery(student.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${import.meta.env.VITE_API_URL}/fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId,
          term,
          session,
          amountExpected: Number(amountExpected),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add fee record');
      }

      setSuccess('Fee record added successfully');
      setAmountExpected('');
      onFeeAdded();
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
      <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Add Fee Record</h2>

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

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Student</label>
      <div className="relative mb-3" ref={wrapperRef}>
        <input
          type="text"
          value={studentQuery}
          onChange={(e) => {
            setStudentQuery(e.target.value);
            setStudentId('');
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type a student's name..."
          required
          className={inputClass}
        />
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {matchingStudents.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">No matching students</p>
            ) : (
              matchingStudents.map((s) => (
                <button
                  type="button"
                  key={s._id}
                  onClick={() => handleSelectStudent(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-gray-600 transition text-slate-800 dark:text-white"
                >
                  {s.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Term</label>
      <select value={term} onChange={(e) => setTerm(e.target.value)} required className={inputClass}>
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Session</label>
      <input
        type="text"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2025/2026"
        required
        className={inputClass}
      />

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Amount Expected (₦)</label>
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
        {loading ? 'Adding...' : 'Add Fee Record'}
      </button>
    </form>
  );
}

export default AddFee;