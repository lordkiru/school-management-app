import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Printer } from 'lucide-react';
import printArea from '../utils/printArea';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function TimetableView() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [school, setSchool] = useState(null);

  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const printRef = useRef(null);

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

    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/subjects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSubjects(await res.json());
      } catch (err) {
        console.error('Failed to load subjects', err);
      }
    };
    fetchSubjects();
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!selectedClass) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/timetable?classId=${selectedClass}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load timetable');
      setEntries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const classSubjects = subjects.filter((s) => s.classId?._id === selectedClass);
  const selectedClassName = classes.find((c) => c._id === selectedClass)?.name || '';

  const handleAddEntry = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/timetable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          classId: selectedClass,
          subjectId,
          dayOfWeek,
          startTime,
          endTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add timetable entry');

      setSubjectId('');
      setStartTime('');
      setEndTime('');
      fetchEntries();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId) => {
    const confirmed = window.confirm('Remove this timetable entry?');
    if (!confirmed) return;

    setDeletingId(entryId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/timetable/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete entry');
      fetchEntries();
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
      {/* Class selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Timetable</h2>

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Select Class</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className={`${inputClass} w-full max-w-xs`}
        >
          <option value="">Select a class</option>
          {classes.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <>
          {/* Add entry form */}
          <form
            onSubmit={handleAddEntry}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6"
          >
            <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3">Add Timetable Entry</h3>

            {formError && (
              <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
                {formError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Subject</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select a subject</option>
                  {classSubjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Day</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  required
                  className={inputClass}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          {/* Timetable grid */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
            {/* Table toolbar */}
            {entries.length > 0 && (
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} — {selectedClassName}
                </p>
                <button
                  onClick={() => printArea(printRef)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  <Printer size={15} /> Print Timetable
                </button>
              </div>
            )}

            {loading ? (
              <p className="p-5 text-slate-500 dark:text-gray-400">Loading timetable...</p>
            ) : error ? (
              <p className="p-5 text-rose-600 dark:text-red-400">{error}</p>
            ) : (
              /* Printable area — only this is sent to printer */
              <div ref={printRef} className="overflow-x-auto">
                {/* Print header — hidden on screen via .screen-hidden CSS, shown in isolated print popup */}
                <div className="screen-hidden hidden" style={{ textAlign: 'center', paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                  {school?.logoUrl && (
                    <img src={school.logoUrl} alt="" style={{ height: 48, margin: '0 auto 8px' }} />
                  )}
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{school?.name || 'School'}</div>
                  {school?.address && <div style={{ fontSize: 12, color: '#64748b' }}>{school.address}</div>}
                  <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600 }}>
                    Timetable — {selectedClassName}
                  </div>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700">
                      <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Day</th>
                      <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Time</th>
                      <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Subject</th>
                      <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Teacher</th>
                      <th className="py-3 px-5 no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                          No timetable entries for this class yet.
                        </td>
                      </tr>
                    ) : (
                      DAYS.flatMap((day) =>
                        entries
                          .filter((e) => e.dayOfWeek === day)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((entry) => (
                            <tr key={entry._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                              <td className="py-3 px-5 text-slate-800 dark:text-white">{entry.dayOfWeek}</td>
                              <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                                {entry.startTime} – {entry.endTime}
                              </td>
                              <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                                {entry.subjectId?.name || '—'}
                              </td>
                              <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                                {entry.subjectId?.teacherId?.name || 'Unassigned'}
                              </td>
                              <td className="py-3 px-5 no-print">
                                <button
                                  onClick={() => handleDelete(entry._id)}
                                  disabled={deletingId === entry._id}
                                  className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TimetableView;
