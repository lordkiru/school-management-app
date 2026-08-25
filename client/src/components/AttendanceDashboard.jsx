import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Users, BarChart2 } from 'lucide-react';

function AttendanceDashboard() {
  const [overview, setOverview] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'flagged' | 'summary'
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const todayDisplay = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, flaggedRes, classesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/attendance/today-overview`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_URL}/attendance/flagged-absences`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const overviewData = await overviewRes.json();
      const flaggedData = await flaggedRes.json();
      const classesData = await classesRes.json();

      if (overviewRes.ok) setOverview(overviewData);
      if (flaggedRes.ok) setFlagged(flaggedData.flagged || []);
      if (classesRes.ok) setClasses(classesData);
    } catch (err) {
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const fetchSummary = async (classId) => {
    if (!classId) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/attendance/summary/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setSummary(data);
    } catch (err) {
      setError('Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && activeTab === 'summary') {
      fetchSummary(selectedClassId);
    }
  }, [selectedClassId, activeTab]);

  const tabClass = (tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition ${
      activeTab === tab
        ? 'bg-indigo-600 text-white'
        : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
    }`;

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading attendance data...</p>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Attendance Overview</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">{todayDisplay}</p>
        </div>
        <button
          onClick={fetchOverview}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {overview && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 border-l-4 border-l-indigo-500">
            <div className="text-3xl font-bold text-slate-800 dark:text-white">{overview.totalClasses}</div>
            <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">Total Classes</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 border-l-4 border-l-emerald-500">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{overview.markedCount}</div>
            <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">Marked Today</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 border-l-4 border-l-rose-500">
            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">{overview.unmarkedCount}</div>
            <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">Not Yet Marked</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button className={tabClass('today')} onClick={() => setActiveTab('today')}>
          Today's Register
        </button>
        <button className={tabClass('flagged')} onClick={() => setActiveTab('flagged')}>
          Flagged Absences {flagged.length > 0 && <span className="ml-1 bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">{flagged.length}</span>}
        </button>
        <button className={tabClass('summary')} onClick={() => setActiveTab('summary')}>
          Term Summary
        </button>
      </div>

      {/* Today's Register */}
      {activeTab === 'today' && overview && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-gray-700">
            <h3 className="font-semibold text-slate-800 dark:text-white">Class Register Status</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700">
                  <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Class</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Section</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Teacher</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.overview.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 px-4 text-slate-500 dark:text-gray-400 text-sm">No classes found.</td>
                  </tr>
                ) : (
                  overview.overview.map((cls) => (
                    <tr key={cls.classId} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{cls.className}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">{cls.section}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">
                        {cls.teacherName || <span className="italic text-slate-300 dark:text-gray-600">Unassigned</span>}
                      </td>
                      <td className="py-3 px-4">
                        {cls.markedToday ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                            <CheckCircle size={12} /> Marked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full">
                            <XCircle size={12} /> Not yet
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flagged Absences */}
      {activeTab === 'flagged' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-gray-700">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-500" />
              Students with 3+ Consecutive Absences
            </h3>
          </div>
          {flagged.length === 0 ? (
            <div className="p-6 text-slate-500 dark:text-gray-400 text-sm">
              🎉 No students with 3 or more consecutive absences. Great attendance!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Student</th>
                    <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Adm. No.</th>
                    <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Class</th>
                    <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Consecutive Absences</th>
                    <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.map((f) => (
                    <tr key={f.studentId} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{f.name}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">{f.admissionNumber}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">{f.className}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-full">
                          {f.consecutiveAbsences} days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm">
                        {f.lastSeen ? new Date(f.lastSeen).toLocaleDateString('en-NG') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Term Summary */}
      {activeTab === 'summary' && (
        <div>
          <div className="mb-4 max-w-sm">
            <label className="block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 outline-none transition"
            >
              <option value="">-- Choose a class --</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>{cls.name} ({cls.section})</option>
              ))}
            </select>
          </div>

          {summaryLoading && <p className="text-slate-500 dark:text-gray-400 text-sm">Loading summary...</p>}

          {summary && !summaryLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-gray-700">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <BarChart2 size={16} className="text-indigo-500" />
                  Term Attendance — {classes.find((c) => c._id === selectedClassId)?.name}
                </h3>
              </div>
              {summary.summary.length === 0 ? (
                <div className="p-6 text-slate-500 dark:text-gray-400 text-sm">No attendance records found for this class this term.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-gray-700">
                        <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Student</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Days</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Present</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Absent</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-500 dark:text-gray-400">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.summary.map((s) => (
                        <tr key={s.studentId} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">
                            <div>{s.name}</div>
                            <div className="text-xs text-slate-400 dark:text-gray-500">{s.admissionNumber}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{s.total}</td>
                          <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">{s.present}</td>
                          <td className="py-3 px-4 text-rose-600 dark:text-rose-400 font-medium">{s.absent}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden max-w-[80px]">
                                <div
                                  className={`h-full rounded-full ${
                                    s.attendancePercent >= 75
                                      ? 'bg-emerald-500'
                                      : s.attendancePercent >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${s.attendancePercent || 0}%` }}
                                />
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  s.attendancePercent >= 75
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : s.attendancePercent >= 50
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {s.attendancePercent ?? 'N/A'}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AttendanceDashboard;
