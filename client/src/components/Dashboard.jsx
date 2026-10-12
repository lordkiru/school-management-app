import { useState, useEffect, useMemo } from 'react';
import { Users, BookOpen, Wallet, CircleAlert, UserPlus, Banknote, ClipboardCheck, Send } from 'lucide-react';
import { buildDashboardModel, buildActivity, toBreakdownRows, formatNaira } from '../utils/dashboardStats';
import DashboardTopbar from './dashboard/DashboardTopbar';
import StatCard from './dashboard/StatCard';
import SectionBreakdownCard from './dashboard/SectionBreakdownCard';
import ActivityFeed from './dashboard/ActivityFeed';
import TermProgressCard from './dashboard/TermProgressCard';
import QuickActions from './dashboard/QuickActions';

// School admin dashboard (proprietor, admin, bursar). Fetches the raw data; every number on
// screen is derived from it in utils/dashboardStats.js.
function Dashboard({ userRole, userName }) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canSeeFees = userRole === 'proprietor' || userRole === 'bursar';
  const canUseMessaging = userRole === 'proprietor' || userRole === 'admin';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        // null on any failure, so one optional endpoint being down can't blank the whole page
        const get = async (path) => {
          const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers });
          return res.ok ? res.json() : null;
        };

        const [students, classes, school, sessions, fees, history] = await Promise.all([
          get('/students'),
          get('/classes'),
          get('/school'),
          get('/sessions'),
          canSeeFees ? get('/fees') : Promise.resolve([]),
          canUseMessaging ? get('/notifications/history?limit=60') : Promise.resolve(null),
        ]);

        // These are the page: if they fail, say so rather than showing zeros as if they were real.
        if (!Array.isArray(students) || !Array.isArray(classes) || !Array.isArray(fees)) {
          throw new Error('Failed to load');
        }

        setRaw({
          fetchedAt: Date.now(), // relative times ("3h ago") are measured from when the data was loaded
          students,
          classes,
          fees,
          school,
          sessions: Array.isArray(sessions) ? sessions : [],
          notifications: Array.isArray(history?.notifications) ? history.notifications : [],
        });
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userRole, canSeeFees, canUseMessaging]);

  const view = useMemo(() => {
    if (!raw) return null;
    const model = buildDashboardModel({ ...raw, canSeeFees });
    return {
      model,
      now: raw.fetchedAt,
      activity: buildActivity({ students: raw.students, fees: raw.fees, notifications: raw.notifications }),
    };
  }, [raw, canSeeFees]);

  if (loading) return <p className="px-9 py-8 text-lem-muted dark:text-gray-400">Loading dashboard...</p>;
  if (error) return <p className="px-9 py-8 text-red-600 dark:text-red-400">{error}</p>;

  const { model, now, activity } = view;
  const fees = model.fees;
  const termLabel = model.term ? `${model.term.term}, ${model.term.session}` : model.session;
  const subtitle = [raw.school?.name, termLabel].filter(Boolean).join(' · ');

  // Only offer what this role can actually open
  const quickActions = [
    userRole !== 'bursar' && { to: '/dashboard/students', label: 'Add Student', icon: UserPlus },
    canSeeFees && { to: '/dashboard/fees', label: 'Record Payment', icon: Banknote },
    userRole !== 'bursar' && { to: '/dashboard/attendance', label: 'Mark Attendance', icon: ClipboardCheck },
    canUseMessaging && { to: '/dashboard/notifications?tab=notices', label: 'Send Notice', icon: Send },
  ].filter(Boolean);

  const studentRows = toBreakdownRows(model.studentsBySection, (s) => s.count, (n) => n.toLocaleString());
  const feeRows = fees ? toBreakdownRows(fees.bySection, (s) => s.outstanding, formatNaira) : [];

  return (
    <div className="relative overflow-hidden px-4 pb-12 pt-6 min-[700px]:px-9 min-[700px]:pb-14 min-[700px]:pt-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-10 h-[420px] w-[420px] rounded-full bg-lem-brand/5 blur-[90px]" />

      <div className="relative">
        <DashboardTopbar
          userName={userName}
          subtitle={subtitle}
          students={raw.students}
          classes={raw.classes}
          canOpenClasses={userRole !== 'bursar'}
          canOpenMessaging={canUseMessaging}
          canRecordPayment={canSeeFees}
        />

        {/* Stat row: fee cards only for roles that can see fees */}
        <div className={`mb-5 grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 ${fees ? 'min-[1280px]:grid-cols-4' : ''}`}>
          <StatCard
            icon={Users}
            tone="brand"
            value={model.totalStudents.toLocaleString()}
            label="Total Students"
            footnote={model.unassignedStudents > 0 ? `${model.unassignedStudents} not yet linked to a class` : undefined}
          />
          <StatCard icon={BookOpen} tone="purple" value={model.totalClasses.toLocaleString()} label="Total Classes" />
          {fees && (
            <>
              <StatCard
                icon={Wallet}
                tone="green"
                value={formatNaira(fees.collected)}
                label={model.term ? 'Fees Collected This Term' : 'Fees Collected'}
              />
              <StatCard icon={CircleAlert} tone="red" value={formatNaira(fees.outstanding)} label="Fees Outstanding" />
            </>
          )}
        </div>

        {/* Same card pattern for both breakdowns */}
        <div className={`mb-4 grid grid-cols-1 gap-4 ${fees ? 'min-[800px]:grid-cols-2' : ''}`}>
          <SectionBreakdownCard
            title="Students by Section"
            total={`${model.totalStudents.toLocaleString()} total`}
            rows={studentRows}
            tone="brand"
          />
          {fees && (
            <SectionBreakdownCard
              title="Outstanding Fees by Section"
              total={`${formatNaira(fees.outstanding)} total`}
              rows={feeRows}
              tone="amber"
              emptyText="No fees to show yet."
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ActivityFeed events={activity} now={now} />
          <div className="flex min-w-0 flex-col gap-4">
            {fees && (
              <TermProgressCard
                collected={fees.collected}
                expected={fees.expected}
                percent={fees.percentCollected}
                termLabel={model.term ? model.term.term : null}
              />
            )}
            <QuickActions actions={quickActions} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
