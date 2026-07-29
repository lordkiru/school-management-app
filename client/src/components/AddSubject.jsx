import { useState, useEffect } from 'react';

function AddSubject({ onSubjectAdded }) {
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/classes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setClasses(data);
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    };
    fetchClasses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, classId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add subject');
      }

      setSuccess(`${data.name} added successfully`);
      setName('');
      setClassId('');
      onSubjectAdded();
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
      <h2 className="text-lg font-bold mb-4">Add Subject</h2>

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

      <label className="block text-sm mb-1">Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Mathematics"
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <label className="block text-sm mb-1">Class</label>
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        required
        className="w-full mb-4 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      >
        <option value="">Select a class</option>
        {classes.map((cls) => (
          <option key={cls._id} value={cls._id}>
            {cls.name}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded transition"
      >
        {loading ? 'Adding...' : 'Add Subject'}
      </button>
    </form>
  );
}

export default AddSubject;