import { useState } from 'react';

function AddClass({ onClassAdded }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, level }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add class');
      }

      setSuccess(`${data.name} added successfully`);
      setName('');
      setLevel('');
      onClassAdded();
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
      <h2 className="text-lg font-bold mb-4">Add Class</h2>

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
        placeholder="e.g. JSS1 Gold"
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <label className="block text-sm mb-1">Level</label>
      <input
        type="text"
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        placeholder="e.g. JSS1"
        required
        className="w-full mb-4 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded transition"
      >
        {loading ? 'Adding...' : 'Add Class'}
      </button>
    </form>
  );
}

export default AddClass;