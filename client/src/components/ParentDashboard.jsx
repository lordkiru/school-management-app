import { useState, useEffect } from 'react';
import { LogOut, User, DollarSign, FileText, ClipboardCheck } from 'lucide-react';

function AttendancePanel({ child }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const token = localStorage.getItem('parentToken');
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/attendance/parent/child/${child._id}?limit=30`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = await res.json();
        if (res.ok) setData(d);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [child._id]);

  if (loading) return <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Loading attendance...</p>;
  if (!data) return <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No attendance data available.</p>;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1 mb-2">
        <ClipboardCheck size={14} className="text-indigo-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Attendance (last 30 days)</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-2">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{data.present}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Present</div>
        </div>
        <div className="text-center bg-rose-50 dark:bg-rose-900/30 rounded-lg p-2">
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{data.absent}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Absent</div>
        </div>
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-2">
          <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            {data.attendancePercent ?? 'N/A'}{data.attendancePercent != null ? '%' : ''}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Rate</div>
        </div>
      </div>
      {/* Last 10 days mini-calendar */}
      <div className="flex gap-1 flex-wrap">
        {data.records.slice(0, 14).map((r) => (
          <span
            key={r._id}
            title={`${new Date(r.date).toLocaleDateString('en-NG')} — ${r.status}`}
            className={`w-5 h-5 rounded-sm text-center text-xs flex items-center justify-center ${
              r.status === 'Present' ? 'bg-emerald-400 dark:bg-emerald-600' :
              r.status === 'Absent' ? 'bg-rose-400 dark:bg-rose-600' :
              r.status === 'Late' ? 'bg-amber-400 dark:bg-amber-600' :
              'bg-blue-400 dark:bg-blue-600'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">● Green=Present · Red=Absent · Amber=Late · Blue=Excused</p>
    </div>
  );
}

function ParentDashboard({ parent, onLogout }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedAttendance, setExpandedAttendance] = useState({});

  const fetchChildren = async () => {
    try {
      const token = localStorage.getItem('parentToken');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents/me/children`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load children');

      setChildren(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('parentToken');
    localStorage.removeItem('parent');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parent Portal</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Welcome, {parent.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-red-600 dark:text-red-400">{error}</p>
        ) : children.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">No children linked to your account yet.</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Please contact the school administrator to link your children.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <div
                key={child._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-3 rounded-full">
                    <User className="text-indigo-600 dark:text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{child.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{child.admissionNumber}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Class:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {child.classId?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gender:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{child.gender}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                  <a
                    href={`/results?admissionNumber=${encodeURIComponent(child.admissionNumber)}&accessToken=${encodeURIComponent(child.publicAccessToken)}&studentName=${encodeURIComponent(child.name)}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-3 rounded-lg transition"
                  >
                    <FileText size={16} />
                    Results
                  </a>
                  <a
                    href={`/pay?admissionNumber=${encodeURIComponent(child.admissionNumber)}&accessToken=${encodeURIComponent(child.publicAccessToken)}&studentName=${encodeURIComponent(child.name)}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 px-3 rounded-lg transition"
                  >
                    <DollarSign size={16} />
                    Fees
                  </a>
                </div>
                {/* Attendance toggle */}
                <button
                  onClick={() => setExpandedAttendance((prev) => ({ ...prev, [child._id]: !prev[child._id] }))}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ClipboardCheck size={13} />
                  {expandedAttendance[child._id] ? 'Hide attendance' : 'View attendance'}
                </button>
                {expandedAttendance[child._id] && <AttendancePanel child={child} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentDashboard;
