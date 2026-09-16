import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, BookOpen, ClipboardCheck, ClipboardList, PenLine, Calendar, AlertCircle } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function TeacherDashboard() {
  const [summary, setSummary] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const today = DAY_NAMES[new Date().getDay()];
  const isWeekday = !['Sunday', 'Saturday'].includes(today);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [summaryRes, timetableRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/staff/me/summary`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/timetable`, { headers }),
        ]);

        const summaryData = await summaryRes.json();
        if (!summaryRes.ok) throw new Error(summaryData.error || 'Failed to load your summary');
        setSummary(summaryData);

        const timetableData = await timetableRes.json();
        const entries = Array.isArray(timetableData) ? timetableData : [];

        const myClassIds = new Set([
          summaryData.formClass?._id,
          ...(summaryData.subjectsTaught || []).map((s) => s.classId),
        ].filter(Boolean));

        const mine = entries.filter((entry) => {
          if (entry.dayOfWeek !== today) return false;
          const entryClassId = entry.classId?._id || entry.classId;
          const entryTeacherId = entry.subjectId?.teacherId?._id;
          return myClassIds.has(entryClassId) || entryTeacherId === user.id;
        });
        mine.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setTodaySchedule(mine);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading your dashboard...</p>;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Welcome, {user.name}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Here's what's on your plate today.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg text-sm mb-4">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Link
          to="/dashboard/attendance"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-sm p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition"
        >
          <ClipboardCheck size={20} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 dark:text-white">Mark Attendance</span>
        </Link>
        <Link
          to="/dashboard/scores"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-sm p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition"
        >
          <ClipboardList size={20} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 dark:text-white">Enter Scores</span>
        </Link>
        <Link
          to="/dashboard/remarks"
          className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-xl shadow-sm p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition"
        >
          <PenLine size={20} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800 dark:text-white">Add Remarks</span>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Form class */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white mb-3">
            <GraduationCap size={18} className="text-indigo-600 dark:text-indigo-400" /> Your Form Class
          </h3>
          {summary?.formClass ? (
            <div>
              <p className="text-lg font-bold text-slate-800 dark:text-white">
                {summary.formClass.name} {summary.formClass.section && `(${summary.formClass.section})`}
              </p>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                {summary.formClass.studentCount} active student{summary.formClass.studentCount === 1 ? '' : 's'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-gray-400">
              You haven't been assigned a form class yet. Contact your admin to get one assigned.
            </p>
          )}
        </div>

        {/* Subjects taught */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white mb-3">
            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" /> Subjects You Teach
          </h3>
          {summary?.subjectsTaught?.length > 0 ? (
            <ul className="space-y-2">
              {summary.subjectsTaught.map((s) => (
                <li key={s._id} className="text-sm text-slate-700 dark:text-gray-200 flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate-400 dark:text-gray-500">
                    {s.className} {s.classSection && `(${s.classSection})`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-gray-400">
              You haven't been assigned any subjects yet. Contact your admin to get subjects assigned.
            </p>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mt-6">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white mb-3">
          <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" /> Today's Schedule ({today})
        </h3>
        {!isWeekday ? (
          <p className="text-sm text-slate-500 dark:text-gray-400">No classes today — enjoy the weekend!</p>
        ) : todaySchedule.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-gray-400">Nothing on your timetable for today.</p>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-gray-700">
            {todaySchedule.map((entry) => (
              <div key={entry._id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400 dark:text-gray-500 w-28 flex-shrink-0">
                  {entry.startTime} – {entry.endTime}
                </span>
                <span className="flex-1 font-medium text-slate-800 dark:text-white">
                  {entry.type === 'lesson' ? (entry.subjectId?.name || 'Lesson') : entry.type === 'short_break' ? 'Short Break' : 'Long Break'}
                </span>
                <span className="text-slate-400 dark:text-gray-500">
                  {entry.classId?.name || ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherDashboard;
