import { useState, useEffect, useCallback } from 'react';
import { Trash2, CheckCircle } from 'lucide-react';

function SessionManager() {
  const [sessions, setSessions] = useState([]);
  const [newSession, setNewSession] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingId, setSettingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
      setSessions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newSession }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add session');

      setNewSession('');
      setSuccess(`${data.name} added`);
      fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (id) => {
    setSettingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${id}/set-current`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set current session');
      fetchSessions();
    } catch (err) {
      alert(err.message);
    } finally {
      setSettingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = window.confirm(`Delete session ${name}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete session');
      fetchSessions();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Academic Sessions</h2>
        <p className="text-xs text-slate-400 mb-4">
          Manage sessions here instead of typing them freely — this prevents typos like "2026" vs
          "2025/2026" from silently splitting your data.
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

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newSession}
            onChange={(e) => setNewSession(e.target.value)}
            placeholder="e.g. 2026/2027"
            required
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {saving ? 'Adding...' : 'Add Session'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">No sessions yet.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Session</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Status</th>
                <th className="py-3 px-5"></th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                  <td className="py-3 px-5 text-slate-800 dark:text-white">{s.name}</td>
                  <td className="py-3 px-5">
                    {s.isCurrent ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        <CheckCircle size={14} /> Current
                      </span>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    {!s.isCurrent && (
                      <button
                        onClick={() => handleSetCurrent(s._id)}
                        disabled={settingId === s._id}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium transition"
                      >
                        {settingId === s._id ? '...' : 'Set as current'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <button
                      onClick={() => handleDelete(s._id, s.name)}
                      disabled={deletingId === s._id}
                      className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default SessionManager;