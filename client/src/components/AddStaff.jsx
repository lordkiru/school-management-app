import { useState } from 'react';

function AddStaff({ onStaffAdded, currentUserRole }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorDetails([]);
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add staff');
        // Show field-level validation errors if present
        if (data.details && data.details.length > 0) {
          setErrorDetails(data.details.map((d) => d.msg));
        }
        return;
      }

      setSuccess(`${data.name} added successfully`);
      setName('');
      setEmail('');
      setPassword('');
      onStaffAdded();
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
      <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Add Staff</h2>

      {error && (
        <div className="bg-rose-50 dark:bg-red-900/40 text-rose-600 dark:text-red-200 text-sm p-3 rounded-lg mb-3">
          <p className="font-semibold mb-1">{error}</p>
          {errorDetails.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5">
              {errorDetails.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-green-900 text-emerald-600 dark:text-green-200 text-sm p-2 rounded-lg mb-3">
          {success}
        </div>
      )}

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Temporary Password</label>
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        placeholder="e.g. Welcome@123"
        className={inputClass}
      />
      <p className="text-xs text-slate-400 dark:text-gray-500 -mt-2 mb-3">
        Min 8 chars · uppercase · lowercase · number · special character (@$!%*?&)
      </p>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)} required className={`${inputClass} mb-4`}>
        <option value="teacher">Teacher</option>
        {currentUserRole === 'proprietor' && (
          <>
            <option value="admin">Admin</option>
            <option value="bursar">Bursar</option>
          </>
        )}
      </select>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition"
      >
        {loading ? 'Adding...' : 'Add Staff'}
      </button>
    </form>
  );
}

export default AddStaff;
