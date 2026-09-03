import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader, Search } from 'lucide-react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

// Predefined remark shortcuts for quick selection
const QUICK_REMARKS = [
  'Excellent performance! Keep it up.',
  'Very good effort this term.',
  'Good work, but can do better.',
  'Average performance. More effort needed.',
  'Below average. Needs to pay more attention in class.',
  'Satisfactory performance this term.',
  'Outstanding student — a pleasure to teach.',
  'Hardworking and dedicated. Well done!',
  'Needs to improve on homework submission.',
  'Shows great improvement. Keep it up.',
];

function TeacherRemarks({ userRole }) {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [remarks, setRemarks] = useState({}); // { studentId: { remark, principalRemark } }
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({}); // { studentId: true/false }
  const [saved, setSaved] = useState({}); // { studentId: true } for green tick flash
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const isAdmin = ['proprietor', 'admin'].includes(userRole);
  const isTeacher = userRole === 'teacher';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const assignedClassId = user.assignedClassId || '';

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/classes`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/sessions`, { headers }),
        ]);
        const classData = await classRes.json();
        const sessionData = await sessionRes.json();
        // Teachers can only pick their own assigned class
        setClasses(isTeacher ? classData.filter((c) => c._id === assignedClassId) : classData);
        setSessions(sessionData);
        const current = sessionData.find((s) => s.isCurrent);
        if (current) setSession(current.name);
        if (isTeacher && assignedClassId) setClassId(assignedClassId);
      } catch (err) {
        setError('Failed to load classes/sessions');
      }
    };
    loadMeta();
  }, []);

  const handleLoad = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setRemarks({});
    setStudents([]);
    setSearchQuery('');
    try {
      // Load all students and filter by classId client-side
      const studentsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/students`,
        { headers }
      );
      const studentsData = await studentsRes.json();
      const allStudents = studentsData.students || studentsData;
      const activeStudents = allStudents.filter(
        (s) => s.status !== 'Inactive' &&
          (s.classId?._id === classId || s.classId === classId)
      );
      setStudents(activeStudents);

      // Load existing remarks
      const remarksRes = await fetch(
        `${import.meta.env.VITE_API_URL}/remarks?classId=${classId}&term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`,
        { headers }
      );
      const remarksData = await remarksRes.json();
      const remarkMap = {};
      (remarksData || []).forEach((r) => {
        remarkMap[r.studentId?._id || r.studentId] = {
          remark: r.remark || '',
          principalRemark: r.principalRemark || '',
        };
      });
      setRemarks(remarkMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (studentId) => {
    setSaving((prev) => ({ ...prev, [studentId]: true }));
    try {
      const body = {
        studentId,
        classId,
        term,
        session,
        remark: remarks[studentId]?.remark || '',
      };
      if (isAdmin) {
        body.principalRemark = remarks[studentId]?.principalRemark || '';
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/remarks`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setSaved((prev) => ({ ...prev, [studentId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [studentId]: false })), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const updateRemark = (studentId, field, value) => {
    setRemarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Class Teacher Remarks</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          Enter remarks for each student. These will appear on their printed report cards.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm mb-4">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {isTeacher && !assignedClassId && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 p-3 rounded-lg text-sm mb-4">
          <AlertCircle size={15} /> You have not been assigned to a class. Contact your admin to get a class assigned before you can add remarks.
        </div>
      )}

      {/* Filter form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <form onSubmit={handleLoad} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
              disabled={isTeacher}
              className={inputClass}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name} {c.section && `(${c.section})`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} required className={inputClass}>
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>{s.name} {s.isCurrent ? '(current)' : ''}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Load Students'}
          </button>
        </form>
      </div>

      {/* Student remark list */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400 text-sm">
          <Loader size={15} className="animate-spin" /> Loading students...
        </div>
      )}

      {!loading && students.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
        </div>
      )}

      {!loading && students.length > 0 && (
        <div className="space-y-4">
          {filteredStudents.map((student) => (
            <div
              key={student._id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">{student.name}</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">{student.admissionNumber}</p>
                </div>
                <button
                  onClick={() => handleSave(student._id)}
                  disabled={saving[student._id]}
                  className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg transition ${
                    saved[student._id]
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
                  }`}
                >
                  {saving[student._id] ? (
                    <><Loader size={13} className="animate-spin" /> Saving...</>
                  ) : saved[student._id] ? (
                    <><CheckCircle size={13} /> Saved!</>
                  ) : (
                    <><Save size={13} /> Save</>
                  )}
                </button>
              </div>

              {/* Class Teacher Remark */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-gray-300 mb-1">
                  Class Teacher's Remark
                </label>
                {/* Quick pick */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {QUICK_REMARKS.slice(0, 5).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateRemark(student._id, 'remark', r)}
                      className="text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-gray-600 text-slate-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-400 transition"
                    >
                      {r.length > 30 ? r.slice(0, 30) + '…' : r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={remarks[student._id]?.remark || ''}
                  onChange={(e) => updateRemark(student._id, 'remark', e.target.value)}
                  placeholder="Type a remark or click a suggestion above..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition resize-none"
                />
                <p className="text-xs text-slate-400 mt-0.5 text-right">
                  {(remarks[student._id]?.remark || '').length}/500
                </p>
              </div>

              {/* Principal Remark — admin/proprietor only */}
              {isAdmin && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-gray-300 mb-1">
                    Principal's Remark
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={remarks[student._id]?.principalRemark || ''}
                    onChange={(e) => updateRemark(student._id, 'principalRemark', e.target.value)}
                    placeholder="Principal's comment (optional)..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition resize-none"
                  />
                </div>
              )}
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <p className="text-slate-500 dark:text-gray-400 text-sm">
              No student matches "{searchQuery}".
            </p>
          )}
        </div>
      )}

      {!loading && students.length === 0 && classId && (
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          No students found for this class. Select a class and click Load Students.
        </p>
      )}
    </div>
  );
}

export default TeacherRemarks;
