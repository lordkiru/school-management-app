import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import Login from './components/Login';
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
import SessionManager from './components/SessionManager';
import ResetPassword from './components/ResetPassword';
import ParentList from './components/ParentList';
import AddParent from './components/AddParent';
import ParentPortal from './components/ParentPortal';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import TenantManagement from './pages/TenantManagement';

const getDefaultPage = (role) => {
  if (role === 'teacher' || role === 'bursar') return 'students';
  return 'dashboard';
};

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [classRefreshKey, setClassRefreshKey] = useState(0);
  const [subjectRefreshKey, setSubjectRefreshKey] = useState(0);
  const [scoreRefreshKey, setScoreRefreshKey] = useState(0);
  const [feeRefreshKey, setFeeRefreshKey] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [staffRefreshKey, setStaffRefreshKey] = useState(0);
  const [parentRefreshKey, setParentRefreshKey] = useState(0);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setActivePage(getDefaultPage(parsedUser.role));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSelectedStudentId(null);
  };

  if (window.location.pathname === '/pay') {
    return <ParentPay />;
  }
  if (window.location.pathname === '/results') {
    return <ParentResults />;
  }
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }
  if (window.location.pathname === '/portal') {
    return <ParentPortal />;
  }

  if (!user) {
    return (
      <>
        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        <Login
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setActivePage(getDefaultPage(loggedInUser.role));
          }}
        />
      </>
    );
  }

  const renderPage = () => {
    if (activePage === 'dashboard') {
      return <Dashboard userRole={user.role} />;
    }
    if (activePage === 'students') {
      return selectedStudentId ? (
        <StudentDetail
          studentId={selectedStudentId}
          onBack={() => setSelectedStudentId(null)}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddStudent onStudentAdded={() => setRefreshKey((k) => k + 1)} />
          <StudentList refreshKey={refreshKey} onSelectStudent={setSelectedStudentId} />
        </div>
      );
    }

    if (activePage === 'classes') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddClass onClassAdded={() => setClassRefreshKey((k) => k + 1)} />
          <ClassList refreshKey={classRefreshKey} />
        </div>
      );
    }
    if (activePage === 'subjects') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddSubject onSubjectAdded={() => setSubjectRefreshKey((k) => k + 1)} />
          <SubjectList refreshKey={subjectRefreshKey} />
        </div>
      );
    }
    if (activePage === 'scores') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddScore onScoreAdded={() => setScoreRefreshKey((k) => k + 1)} />
          <ScoreList refreshKey={scoreRefreshKey} />
        </div>
      );
    }

    if (activePage === 'fees') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <div className="flex flex-col gap-6">
            <AddClassFee onFeesAdded={() => setFeeRefreshKey((k) => k + 1)} />
            <AdjustClassFee onAdjusted={() => setFeeRefreshKey((k) => k + 1)} />
            <AddFee onFeeAdded={() => setFeeRefreshKey((k) => k + 1)} />
          </div>
          <FeeList refreshKey={feeRefreshKey} />
        </div>
      );
    }
    if (activePage === 'sessions') {
      return <SessionManager />;
    }
    if (activePage === 'feereport') {
      return <FeeReportByClass />;
    }

    if (activePage === 'timetable') {
      return <TimetableView />;
    }
    if (activePage === 'promote') {
      return <PromoteClass />;
    }
    if (activePage === 'staff') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddStaff onStaffAdded={() => setStaffRefreshKey((k) => k + 1)} currentUserRole={user.role} />
          <StaffList refreshKey={staffRefreshKey} />
        </div>
      );
    }
    if (activePage === 'parents') {
      return (
        <div className="grid md:grid-cols-2 gap-6 p-6">
          <AddParent onParentAdded={() => setParentRefreshKey((k) => k + 1)} />
          <ParentList refreshKey={parentRefreshKey} />
        </div>
      );
    }
    if (activePage === 'auditlog') {
      return <AuditLogList />;
    }
    if (activePage === 'settings') {
      return <SchoolSettings />;
    }
    if (activePage === 'reportcards') {
      return <ReportCardView />;
    }
    // Super Admin Routes
    if (activePage === 'superadmin') {
      return <SuperAdminDashboard />;
    }
    if (activePage === 'superadmin-tenants') {
      return <TenantManagement />;
    }
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400">
        {activePage.charAt(0).toUpperCase() + activePage.slice(1)} page coming soon.
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="flex">
        <Sidebar
          activePage={activePage}
          onSelectPage={(page) => {
            setActivePage(page);
            setSelectedStudentId(null);
          }}
          userRole={user.role}
        />

        <div className="flex-1">
          <div className="flex items-center justify-between px-6 pt-16 pb-4">
            <h1 className="text-2xl font-bold">Welcome, {user.name} 👋</h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>

          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default App;