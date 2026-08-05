import { useState, useEffect } from 'react';

function PromoteClass() {
  const [classes, setClasses] = useState([]);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

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
    const fetchStudents = async () => {
      if (!fromClassId) {
        setStudents([]);
        setSelectedIds(new Set());
        return;
      }
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/students`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load students');

        const classStudents = data.filter((s) => (s.classId?._id || s.classId) === fromClassId);
        setStudents(classStudents);
        // default: everyone selected (promoted), uncheck anyone repeating
        setSelectedIds(new Set(classStudents.map((s) => s._id)));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [fromClassId]);

  const toggleStudent = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s._id)));
    }
  };

  const handlePromote = async () => {
    setError('');
    setSuccess('');

    if (!toClassId) {
      setError('Select a destination class');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Select at least one student to promote');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/students/promote-class`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toClassId,
          studentIds: Array.from(selectedIds),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to promote students');

      setSuccess(data.message);
      setFromClassId('');
      setToClassId('');
      setStudents([]);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  const repeatingCount = students.length - selectedIds.size;

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Promote Class</h2>
        <p className="text-xs text-slate-400 mb-4">
          Select a class, choose the destination, then uncheck any student who is repeating —
          everyone else will be moved.
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

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">From Class</label>
            <select value={fromClassId} onChange={(e) => setFromClassId(e.target.value)} className={inputClass}>
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">To Class</label>
            <select value={toClassId} onChange={(e) => setToClassId(e.target.value)} className={inputClass}>
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePromote}
            disabled={saving || !fromClassId || !toClassId}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {saving ? 'Promoting...' : 'Promote Selected'}
          </button>
        </div>
      </div>

      {fromClassId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">
              {students.length} student(s) in this class
              {repeatingCount > 0 && (
                <span className="text-amber-600 font-normal"> — {repeatingCount} marked to repeat</span>
              )}
            </h3>
            {students.length > 0 && (
              <button
                onClick={toggleAll}
                className="text-xs text-indigo-600 hover:underline"
              >
                {selectedIds.size === students.length ? 'Unselect all' : 'Select all'}
              </button>
            )}
          </div>

          {loading ? (
            <p className="p-5 text-slate-500 dark:text-gray-400">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="p-5 text-slate-500 dark:text-gray-400">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-2 px-5"></th>
                    <th className="py-2 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                    <th className="py-2 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Admission No.</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student._id}
                      className="border-b border-slate-50 dark:border-gray-700 last:border-0"
                    >
                      <td className="py-2 px-5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student._id)}
                          onChange={() => toggleStudent(student._id)}
                        />
                      </td>
                      <td className="py-2 px-5 text-slate-800 dark:text-white">{student.name}</td>
                      <td className="py-2 px-5 text-slate-600 dark:text-gray-300">{student.admissionNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PromoteClass;