import { useState, useEffect } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AddFee({ onFeeAdded }) {
  const [studentId, setStudentId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [amountExpected, setAmountExpected] = useState('');
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/students', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStudents(await res.json());
      } catch (err) {
        console.error('Failed to load students', err);
      }
    };
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/fees', {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-md"
    >
      <h2 className="text-lg font-bold mb-4">Add Fee Record</h2>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-sm p-2 rounded mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm p-2 rounded mb-3">
          {success}
        </div>
      )}

      <label className="block text-sm mb-1">Student</label>
      <select
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      >
        <option value="">Select a student</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1">Term</label>
      <select
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      >
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1">Session</label>
      <input
        type="text"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2025/2026"
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <label className="block text-sm mb-1">Amount Expected (₦)</label>
      <input
        type="number"
        value={amountExpected}
        onChange={(e) => setAmountExpected(e.target.value)}
        required
        className="w-full mb-4 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded transition"
      >
        {loading ? 'Adding...' : 'Add Fee Record'}
      </button>
    </form>
  );
}

export default AddFee;