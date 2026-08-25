import { useState, useEffect, useCallback } from 'react';
import { Trash2, Pencil, X, Check, GraduationCap } from 'lucide-react';

function StaffList({ refreshKey }) {
  const [staff, setStaff] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [resetInfo, setResetInfo] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editAssignedClassId, setEditAssignedClassId] = useState('');
  const [editError, setEditError] = useState('');
  const [savingId, setSavingId] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [staffRes, classesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/staff`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
        fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const staffData = await staffRes.json();
      const classesData = await classesRes.json();
      if (!staffRes.ok) throw new Error(staffData.error || 'Failed to load staff');
      setStaff(staffData);
      if (classesRes.ok) setClasses(classesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff, refreshKey]);

  const startEdit = (member) => {
    setEditingId(member._id);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditAssignedClassId(member.assignedClassId || '');
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const handleSave = async (staffId) => {
    setEditError('');
    setSavingId(staffId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/staff/${staffId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
          assignedClassId: editAssignedClassId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update staff');
        return;
      }

      // Update local state immediately (no full refetch needed)
      setStaff((prev) =>
        prev.map((m) =>
          m._id === staffId
            ? { ...m, name: data.name, email: data.email, role: data.role, assignedClassId: data.assignedClassId }
            : m
        )
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingId(null);
    }
  };

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

  const inputClass =
    'p-1.5 text-sm rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full';

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
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Email</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Role</th>
                <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Form Class</th>
                <th className="py-3 px-4"></th>
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
                staff.map((member) =>
                  editingId === member._id ? (
                    // ── Edit row ──────────────────────────────────────────
                    <tr key={member._id} className="border-b border-indigo-50 dark:border-indigo-900/30 bg-indigo-50/40 dark:bg-indigo-900/10">
                      <td className="py-2 px-4">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={inputClass}
                          placeholder="Name"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          type="email"
                          className={inputClass}
                          placeholder="Email"
                        />
                      </td>
                      <td className="py-2 px-4">
                        {currentUser.role === 'proprietor' ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className={inputClass}
                          >
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                            <option value="bursar">Bursar</option>
                          </select>
                        ) : (
                          <span className="text-sm text-slate-600 dark:text-gray-300 capitalize">{editRole}</span>
                        )}
                      </td>
                      {/* Class assignment — only shown for teachers */}
                      <td className="py-2 px-4">
                        {(editRole === 'teacher') ? (
                          <select
                            value={editAssignedClassId}
                            onChange={(e) => setEditAssignedClassId(e.target.value)}
                            className={inputClass}
                          >
                            <option value="">-- No class --</option>
                            {classes.map((cls) => (
                              <option key={cls._id} value={cls._id}>{cls.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-gray-500 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex flex-col gap-1">
                          {editError && (
                            <p className="text-xs text-rose-500 dark:text-rose-400">{editError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(member._id)}
                              disabled={savingId === member._id}
                              className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium px-3 py-1.5 rounded-lg transition"
                            >
                              <Check size={12} />
                              {savingId === member._id ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-600 dark:text-gray-300 font-medium px-3 py-1.5 rounded-lg transition"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // ── Normal row ────────────────────────────────────────
                    <tr key={member._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                      <td className="py-3 px-4 text-slate-800 dark:text-white">{member.name}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{member.email}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300 capitalize">{member.role}</td>
                      <td className="py-3 px-4">
                        {member.role === 'teacher' && member.assignedClassId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                            <GraduationCap size={11} />
                            {classes.find((c) => c._id === member.assignedClassId)?.name || 'Assigned'}
                          </span>
                        ) : member.role === 'teacher' ? (
                          <span className="text-xs text-slate-400 dark:text-gray-500 italic">Not assigned</span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Edit */}
                          <button
                            onClick={() => startEdit(member)}
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="Edit staff"
                          >
                            <Pencil size={15} />
                          </button>
                          {/* Reset password */}
                          <button
                            onClick={() => handleGenerateReset(member._id)}
                            disabled={resettingId === member._id}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-xs font-medium disabled:opacity-50 transition whitespace-nowrap"
                          >
                            {resettingId === member._id ? '...' : 'Reset pwd'}
                          </button>
                          {/* Delete — proprietor only */}
                          {currentUser.role === 'proprietor' && (
                            <button
                              onClick={() => handleDelete(member._id, member.name)}
                              disabled={deletingId === member._id}
                              className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                              title="Remove staff"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset token modal */}
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
