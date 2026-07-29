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
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSelectedStudentId(null);
  };

  if (!user) {
    return (
      <>
        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
        <Login onLoginSuccess={setUser} />
      </>
    );
  }

  const renderPage = () => {
    if (activePage === 'dashboard') {
  return <Dashboard />;
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
      <AddFee onFeeAdded={() => setFeeRefreshKey((k) => k + 1)} />
      <FeeList refreshKey={feeRefreshKey} />
    </div>
  );
}

  return (
    <div className="p-6 text-gray-500 dark:text-gray-400">
      {activePage.charAt(0).toUpperCase() + activePage.slice(1)} page coming soon.
    </div>
  );
};

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />

      <div className="flex">
        <Sidebar
          activePage={activePage}
          onSelectPage={(page) => {
            setActivePage(page);
            setSelectedStudentId(null);
          }}
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