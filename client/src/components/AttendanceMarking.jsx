import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, FileCheck, AlertCircle, Send, WifiOff } from 'lucide-react';
import { queueAttendance } from '../utils/offlineQueue';

const STATUS_OPTIONS = [
  { value: 'Present', label: 'Present', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700', activeColor: 'bg-emerald-500 text-white border-emerald-500', icon: CheckCircle },
  { value: 'Absent', label: 'Absent', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-700', activeColor: 'bg-rose-500 text-white border-rose-500', icon: XCircle },
  { value: 'Late', label: 'Late', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700', activeColor: 'bg-amber-500 text-white border-amber-500', icon: Clock },
  { value: 'Excused', label: 'Excused', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700', activeColor: 'bg-blue-500 text-white border-blue-500', icon: FileCheck },
];

function AttendanceMarking({ userRole }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'Late' | 'Excused' }
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [existingRecords, setExistingRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const today = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Load classes — teachers get all classes but we'll auto-select their assigned class
  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setClasses(data);
          // Auto-select if teacher has assigned class
          if (user.assignedClassId) {
            setSelectedClassId(user.assignedClassId);
          }
        }
      } catch (err) {
        setError('Failed to load classes');
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  // Load students + check if already marked whenever class changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setAttendance({});
      setAlreadyMarked(false);
      setExistingRecords([]);
      return;
    }

    const loadClassData = async () => {
      setStudentsLoading(true);
      setError('');
      setSuccess('');
      try {
        // Fetch students in this class
        const studentsRes = await fetch(
          `${import.meta.env.VITE_API_URL}/students?classId=${selectedClassId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const studentsData = await studentsRes.json();

        // Check if attendance already marked today
        const attRes = await fetch(
          `${import.meta.env.VITE_API_URL}/attendance/class/${selectedClassId}?date=${today}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const attData = await attRes.json();

        const allStudents = (studentsData || []).filter(
          (s) => s.status === 'Active' &&
            (s.classId?._id === selectedClassId || s.classId === selectedClassId)
        );
        setStudents(allStudents);

        if (attData.records && attData.records.length > 0) {
          setAlreadyMarked(true);
          setExistingRecords(attData.records);
          // Pre-fill with existing data
          const existingMap = {};
          attData.records.forEach((r) => {
            const sid = r.studentId?._id || r.studentId;
            existingMap[sid] = r.status;
          });
          setAttendance(existingMap);
        } else {
          setAlreadyMarked(false);
          setExistingRecords([]);
          // Default all to Present
          const defaultMap = {};
          allStudents.forEach((s) => { defaultMap[s._id] = 'Present'; });
          setAttendance(defaultMap);
        }
      } catch (err) {
        setError('Failed to load class data');
      } finally {
        setStudentsLoading(false);
      }
    };

    loadClassData();
  }, [selectedClassId, today]);

  const setStatus = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status) => {
    const newMap = {};
    students.forEach((s) => { newMap[s._id] = status; });
    setAttendance(newMap);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const records = students.map((s) => ({
        studentId: s._id,
        status: attendance[s._id] || 'Present',
        notes: '',
      }));

      // If offline, queue locally and show message
      if (!navigator.onLine) {
        await queueAttendance({ classId: selectedClassId, date: today, records });
        setSuccess(`📥 You're offline. Attendance for ${records.length} students saved locally and will sync when you reconnect.`);
        setAlreadyMarked(true);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/attendance/mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ classId: selectedClassId, records }),
      });

      const data = await res.json();
      if (!res.ok) {
        // If server unreachable, queue offline
        if (!res.status || res.status === 0) {
          await queueAttendance({ classId: selectedClassId, date: today, records });
          setSuccess(`📥 Network error — attendance saved locally and will sync when you reconnect.`);
          setAlreadyMarked(true);
          return;
        }
        setError(data.error || 'Failed to submit attendance');
        return;
      }

      const absentCount = records.filter((r) => r.status === 'Absent').length;
      setSuccess(`✅ Attendance submitted for ${records.length} students. ${absentCount > 0 ? `${absentCount} absent.` : 'All present!'}`);
      setAlreadyMarked(true);
    } catch (err) {
      // Network failure — queue offline
      try {
        const records = students.map((s) => ({
          studentId: s._id,
          status: attendance[s._id] || 'Present',
          notes: '',
        }));
        await queueAttendance({ classId: selectedClassId, date: today, records });
        setSuccess(`📥 Network error — attendance saved locally and will sync when you reconnect.`);
        setAlreadyMarked(true);
      } catch {
        setError('Failed to submit or queue attendance. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(attendance).filter((s) => s === 'Present').length;
  const absentCount = Object.values(attendance).filter((s) => s === 'Absent').length;
  const lateCount = Object.values(attendance).filter((s) => s === 'Late').length;
  const excusedCount = Object.values(attendance).filter((s) => s === 'Excused').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Attendance Register</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400">{todayDisplay}</p>
      </div>

      {/* Class selector */}
      <div className="mb-6 max-w-sm">
        <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Select Class</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          disabled={loading}
        >
          <option value="">-- Choose a class --</option>
          {classes.map((cls) => (
            <option key={cls._id} value={cls._id}>{cls.name} ({cls.section})</option>
          ))}
        </select>
      </div>

      {studentsLoading && (
        <p className="text-slate-500 dark:text-gray-400">Loading students...</p>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg mb-4 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 p-3 rounded-lg mb-4 text-sm font-medium">
          {success}
        </div>
      )}

      {alreadyMarked && !success && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 p-3 rounded-lg mb-4 text-sm">
          <AlertCircle size={16} />
          Attendance has already been submitted for this class today. Showing submitted records.
        </div>
      )}

      {selectedClassId && !studentsLoading && students.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Present', count: presentCount, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Absent', count: absentCount, color: 'text-rose-600 dark:text-rose-400' },
              { label: 'Late', count: lateCount, color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Excused', count: excusedCount, color: 'text-blue-600 dark:text-blue-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-3 text-center">
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
              </div>
            ))}
          </div>

          {/* Quick mark all buttons */}
          {!alreadyMarked && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="text-sm text-slate-500 dark:text-gray-400 self-center">Mark all:</span>
              {STATUS_OPTIONS.map(({ value, label, activeColor }) => (
                <button
                  key={value}
                  onClick={() => markAll(value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${activeColor}`}
                >
                  All {label}
                </button>
              ))}
            </div>
          )}

          {/* Student list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden mb-5">
            <div className="p-4 border-b border-slate-100 dark:border-gray-700">
              <h3 className="font-semibold text-slate-800 dark:text-white">
                {classes.find((c) => c._id === selectedClassId)?.name} — {students.length} students
              </h3>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-gray-700">
              {students.map((student, idx) => {
                const currentStatus = attendance[student._id] || 'Present';
                return (
                  <div key={student._id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm text-slate-400 dark:text-gray-500 w-6 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{student.name}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500">{student.admissionNumber}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {STATUS_OPTIONS.map(({ value, label, color, activeColor }) => (
                        <button
                          key={value}
                          disabled={alreadyMarked}
                          onClick={() => setStatus(student._id, value)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                            currentStatus === value ? activeColor : color
                          } ${alreadyMarked ? 'opacity-70 cursor-default' : 'hover:opacity-90'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit button */}
          {!alreadyMarked && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-6 py-2.5 rounded-lg transition"
            >
              <Send size={16} />
              {submitting ? 'Submitting...' : `Submit Attendance (${students.length} students)`}
            </button>
          )}
        </>
      )}

      {selectedClassId && !studentsLoading && students.length === 0 && (
        <div className="text-slate-500 dark:text-gray-400 text-sm bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-100 dark:border-gray-700">
          No active students found in this class.
        </div>
      )}
    </div>
  );
}

export default AttendanceMarking;
