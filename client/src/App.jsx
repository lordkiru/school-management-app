import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LogOut, WifiOff, RefreshCw, Menu } from 'lucide-react';
import { syncOfflineQueue, getPendingCount } from './utils/offlineQueue';
import ThemeToggle from './components/ThemeToggle';
import TrialBanner from './components/TrialBanner';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import StudentList from './components/StudentList';
import AddStudent from './components/AddStudent';
import StudentDetail from './components/StudentDetail';
import ClassList from './components/ClassList';
import AddClass from './components/AddClass';
import SubjectList from './components/SubjectList';
import AddSubject from './components/AddSubject';
import ScoreList from './components/ScoreList';
import AddScore from './components/AddScore';
import FeeList from './components/FeeList';
import AddFee from './components/AddFee';
import Dashboard from './components/Dashboard';
import SchoolSettings from './components/SchoolSettings';
import AddClassFee from './components/AddClassFee';
import AuditLogList from './components/AuditLogList';
import AdjustClassFee from './components/AdjustClassFee';
import ParentPay from './components/ParentPay';
import ParentResults from './components/ParentResults';
import StaffList from './components/StaffList';
import AddStaff from './components/AddStaff';
import TimetableView from './components/Timetableview';
import PromoteClass from './components/PromoteClass';
import ReportCardView from './components/ReportCardView';
import FeeReportByClass from './components/FeeReportByClass';
import FeeStructureSetup from './components/FeeStructureSetup';
import FeeBreakdownView from './components/FeeBreakdownView';
import SessionManager from './components/SessionManager';
import ResetPassword from './components/ResetPassword';
import ForgotPassword from './components/ForgotPassword';
import ParentList from './components/ParentList';
import AddParent from './components/AddParent';
import ParentPortal from './components/ParentPortal';
import StudentLogin from './components/StudentLogin';
import CbtTestTaking from './components/CbtTestTaking';
import CbtBuilder from './components/CbtBuilder';
import CbtResults from './components/CbtResults';
import CbtHistory from './components/CbtHistory';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import TenantManagement from './pages/TenantManagement';
import SubscriptionManagement from './pages/SubscriptionManagement';
import AttendanceMarking from './components/AttendanceMarking';
import AttendanceDashboard from './components/AttendanceDashboard';
import NotificationsPanel from './components/NotificationsPanel';
import TeacherRemarks from './components/TeacherRemarks';
import DataImport from './components/DataImport';

const getDefaultRoute = (role) => {
  if (role === 'super_admin') return '/dashboard/superadmin';
  if (role === 'teacher' || role === 'bursar') return '/dashboard/students';
  return '/dashboard';
};

// Role restrictions here used to be UI-only (Sidebar just hid the link) — this is the
// actual enforcement, so typing the URL directly no longer bypasses it.
function RequireRole({ roles, userRole, children }) {
  if (!roles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Extracted from the old `/cbt-login` pathname check — its own localStorage-based auth,
// independent of the main `user` session.
function CbtLoginRoute() {
  const [cbtView, setCbtView] = useState('tests'); // 'tests' | 'history'
  const loggedInStudent = localStorage.getItem('student') ? JSON.parse(localStorage.getItem('student')) : null;

  if (!loggedInStudent) {
    return <StudentLogin onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto mb-4 px-6 flex items-center justify-between">
        <span className="text-slate-600 dark:text-gray-300">
          Logged in as <strong>{loggedInStudent.name}</strong>
        </span>
        <button
          onClick={() => {
            localStorage.removeItem('studentToken');
            localStorage.removeItem('student');
            window.location.reload();
          }}
          className="text-sm text-rose-600 dark:text-rose-400 hover:underline"
        >
          Log out
        </button>
      </div>
      <div className="max-w-2xl mx-auto mb-4 px-6 flex gap-2">
        <button
          onClick={() => setCbtView('tests')}
          className={`text-sm font-medium py-2 px-4 rounded-lg transition ${
            cbtView === 'tests'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-600'
          }`}
        >
          Take a test
        </button>
        <button
          onClick={() => setCbtView('history')}
          className={`text-sm font-medium py-2 px-4 rounded-lg transition ${
            cbtView === 'history'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-600'
          }`}
        >
          History
        </button>
      </div>
      {cbtView === 'history' ? <CbtHistory /> : <CbtTestTaking />}
    </div>
  );
}

// The persistent chrome (banners, header, sidebar) plus every nested /dashboard/* route.
function DashboardShell({
  user,
  darkMode,
  setDarkMode,
  onLogout,
  isOnline,
  pendingSync,
  syncStatus,
  sidebarOpen,
  setSidebarOpen,
  refreshKeys,
  bumpRefresh,
}) {
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Offline / Sync banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4">
          <WifiOff size={15} />
          You're offline — attendance will sync automatically when reconnected
          {pendingSync > 0 && (
            <span className="bg-white text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full ml-1">
              {pendingSync} queued
            </span>
          )}
        </div>
      )}
      {isOnline && syncStatus === 'syncing' && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium py-2 px-4">
          <RefreshCw size={15} className="animate-spin" />
          Syncing offline attendance records...
        </div>
      )}
      {isOnline && syncStatus === 'synced' && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-emerald-500 text-white text-sm font-medium py-2 px-4">
          ✅ Offline attendance synced successfully!
        </div>
      )}

      {/* ── Fixed top header bar ── */}
      <header className={`fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 shadow-sm print:hidden ${!isOnline ? 'mt-8' : ''}`}>
        <div className="flex items-center justify-between px-4 h-14">
          {/* Hamburger (mobile only) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* App name / logo */}
          <img src="/assets/logo.png" alt="Lemida SchoolManager" className="h-8 md:h-9 w-auto" />

          {/* Right side: welcome + theme toggle + logout */}
          <div className="flex items-center gap-1">
            <span className="hidden sm:block text-sm text-slate-600 dark:text-gray-300 truncate max-w-[130px] mr-1">
              {user.name}
            </span>
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} inline />
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline px-1"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`flex pt-14 ${!isOnline ? 'mt-8' : ''}`}>
        <Sidebar
          userRole={user.role}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <TrialBanner />
          <Routes>
            <Route index element={<Dashboard userRole={user.role} />} />

            <Route path="students">
              <Route
                index
                element={
                  <div className="grid md:grid-cols-2 gap-6 p-6">
                    <AddStudent onStudentAdded={() => bumpRefresh('student')} />
                    <StudentList refreshKey={refreshKeys.student} />
                  </div>
                }
              />
              <Route path=":studentId" element={<StudentDetail />} />
            </Route>

            <Route
              path="classes"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <AddClass onClassAdded={() => bumpRefresh('class')} />
                  <ClassList refreshKey={refreshKeys.class} />
                </div>
              }
            />
            <Route
              path="subjects"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <AddSubject onSubjectAdded={() => bumpRefresh('subject')} />
                  <SubjectList refreshKey={refreshKeys.subject} />
                </div>
              }
            />
            <Route
              path="scores"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <AddScore onScoreAdded={() => bumpRefresh('score')} />
                  <ScoreList refreshKey={refreshKeys.score} />
                </div>
              }
            />
            <Route
              path="cbt"
              element={
                <div className="grid xl:grid-cols-2 gap-6 p-6">
                  <CbtBuilder onTestCreated={() => bumpRefresh('cbt')} />
                  <CbtResults refreshKey={refreshKeys.cbt} />
                </div>
              }
            />

            <Route
              path="fees"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <div className="flex flex-col gap-6">
                    <AddClassFee onFeesAdded={() => bumpRefresh('fee')} />
                    <AdjustClassFee onAdjusted={() => bumpRefresh('fee')} />
                    <AddFee onFeeAdded={() => bumpRefresh('fee')} />
                  </div>
                  <FeeList refreshKey={refreshKeys.fee} />
                </div>
              }
            />
            <Route path="fees/report" element={<FeeReportByClass />} />
            <Route path="fees/setup" element={<FeeStructureSetup />} />
            <Route path="fees/breakdown" element={<FeeBreakdownView />} />

            <Route
              path="sessions"
              element={<RequireRole roles={['proprietor']} userRole={user.role}><SessionManager /></RequireRole>}
            />
            <Route path="timetable" element={<TimetableView />} />
            <Route path="promote" element={<PromoteClass />} />
            <Route
              path="staff"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <AddStaff onStaffAdded={() => bumpRefresh('staff')} currentUserRole={user.role} />
                  <StaffList refreshKey={refreshKeys.staff} />
                </div>
              }
            />
            <Route
              path="parents"
              element={
                <div className="grid md:grid-cols-2 gap-6 p-6">
                  <AddParent onParentAdded={() => bumpRefresh('parent')} />
                  <ParentList refreshKey={refreshKeys.parent} />
                </div>
              }
            />
            <Route
              path="auditlog"
              element={<RequireRole roles={['proprietor']} userRole={user.role}><AuditLogList /></RequireRole>}
            />
            <Route
              path="settings"
              element={<RequireRole roles={['proprietor']} userRole={user.role}><SchoolSettings /></RequireRole>}
            />
            <Route path="reportcards" element={<ReportCardView />} />
            <Route path="remarks" element={<TeacherRemarks userRole={user.role} />} />
            <Route path="dataimport" element={<DataImport userRole={user.role} />} />
            <Route path="notifications" element={<NotificationsPanel />} />

            {/* Attendance — teachers see marking UI, admin/proprietor see the dashboard */}
            <Route
              path="attendance"
              element={user.role === 'teacher' ? <AttendanceMarking userRole={user.role} /> : <AttendanceDashboard />}
            />

            {/* Super Admin routes */}
            <Route
              path="superadmin"
              element={<RequireRole roles={['super_admin']} userRole={user.role}><SuperAdminDashboard /></RequireRole>}
            />
            <Route
              path="superadmin/tenants"
              element={<RequireRole roles={['super_admin']} userRole={user.role}><TenantManagement /></RequireRole>}
            />
            <Route
              path="superadmin/subscriptions"
              element={<RequireRole roles={['super_admin']} userRole={user.role}><SubscriptionManagement /></RequireRole>}
            />

            <Route path="*" element={<div className="p-6 text-gray-500 dark:text-gray-400">Page not found.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [refreshKeys, setRefreshKeys] = useState({
    student: 0, class: 0, subject: 0, score: 0, fee: 0, staff: 0, parent: 0, cbt: 0,
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncStatus, setSyncStatus] = useState(''); // 'syncing' | 'synced' | ''
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const bumpRefresh = (name) => setRefreshKeys((keys) => ({ ...keys, [name]: keys[name] + 1 }));

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Online/offline detection + auto-sync queued attendance when back online
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const count = await getPendingCount();
      if (count > 0) {
        setSyncStatus('syncing');
        const token = localStorage.getItem('token');
        const apiUrl = import.meta.env.VITE_API_URL;
        if (token && apiUrl) {
          const result = await syncOfflineQueue(token, apiUrl);
          setSyncStatus('synced');
          setPendingSync(0);
          setTimeout(() => setSyncStatus(''), 4000);
        }
      }
    };
    const handleOffline = async () => {
      setIsOnline(false);
      const count = await getPendingCount();
      setPendingSync(count);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending on mount
    getPendingCount().then(setPendingSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Routes>
      <Route path="/pay" element={<ParentPay />} />
      <Route path="/results" element={<ParentResults />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/portal" element={<ParentPortal />} />
      <Route path="/cbt-login" element={<CbtLoginRoute />} />

      <Route
        path="/"
        element={user ? <Navigate to={getDefaultRoute(user.role)} replace /> : <LandingPage darkMode={darkMode} setDarkMode={setDarkMode} />}
      />

      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={
                location.state?.from
                  ? `${location.state.from.pathname}${location.state.from.search || ''}`
                  : getDefaultRoute(user.role)
              }
              replace
            />
          ) : (
            <>
              <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <Login onLoginSuccess={setUser} />
            </>
          )
        }
      />

      <Route
        path="/dashboard/*"
        element={
          user ? (
            <DashboardShell
              user={user}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              onLogout={handleLogout}
              isOnline={isOnline}
              pendingSync={pendingSync}
              syncStatus={syncStatus}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              refreshKeys={refreshKeys}
              bumpRefresh={bumpRefresh}
            />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
