import { useState } from 'react';
import ParentLogin from './ParentLogin';
import ParentDashboard from './ParentDashboard';

function ParentPortal() {
  const [parent, setParent] = useState(null);

  if (!parent) {
    return <ParentLogin onLoginSuccess={setParent} />;
  }

  return <ParentDashboard parent={parent} onLogout={() => setParent(null)} />;
}

export default ParentPortal;
