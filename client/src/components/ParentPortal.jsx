import { useState } from 'react';
import ParentLogin from './ParentLogin';
import ParentDashboard from './ParentDashboard';

function ParentPortal() {
  // Restore an existing session on refresh — parentToken/parent are saved
  // to localStorage by ParentLogin after a successful sign-in.
  const [parent, setParent] = useState(() => {
    try {
      const saved = localStorage.getItem('parent');
      const token = localStorage.getItem('parentToken');
      return saved && token ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  if (!parent) {
    return <ParentLogin onLoginSuccess={setParent} />;
  }

  return <ParentDashboard parent={parent} onLogout={() => setParent(null)} />;
}

export default ParentPortal;