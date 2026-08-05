import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

function StaffList({ refreshKey }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load staff');
      }

      setStaff(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff, refreshKey]);

  const handleDelete = async (staffId, staffName) => {
    const confirmed = window.confirm(`Remove ${staffName}'s account? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(staffId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/staff/${staffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove staff');

      fetchStaff();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGenerateReset = async (staffId) => {
    setResettingId(staffId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/generate-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: staffId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate reset token');

      setResetInfo({ token: data.resetToken, expiresAt: data.expiresAt });
    } catch (err) {
      alert(err.message);
    } finally {
      setResettingId(null);
    }
  };

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading staff...</p>;
  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Staff</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Email</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Role</th>
                <th className="py-3 px-5"></th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                    No staff members yet.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                    <td className="py-3 px-5 text-slate-800 dark:text-white">{member.name}</td>
                    <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{member.email}</td>
                    <td className="py-3 px-5 text-slate-600 dark:text-gray-300 capitalize">{member.role}</td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => handleGenerateReset(member._id)}
                        disabled={resettingId === member._id}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium disabled:opacity-50 transition"
                      >
                        {resettingId === member._id ? '...' : 'Reset Password'}
                      </button>
                    </td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => handleDelete(member._id, member.name)}
                        disabled={deletingId === member._id}
                        className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                        title="Remove staff"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetInfo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-6">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Password Reset Token</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
              Share this token with the staff member directly (WhatsApp, in person, etc). It expires in 1 hour.
            </p>
            <div className="bg-slate-50 dark:bg-gray-900 p-3 rounded-lg text-xs font-mono break-all mb-4 text-slate-800 dark:text-gray-200">
              {resetInfo.token}
            </div>
            <button
              onClick={() => setResetInfo(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffList;