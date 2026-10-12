import AdminSidebar from './AdminSidebar';
import ConnectionBanners from '../ConnectionBanners';
import TrialBanner from '../TrialBanner';

// The shell for school roles (proprietor, admin, bursar): dark sidebar + light content area.
// `children` is the routed page. Teachers and super admins keep the original shell.
function AdminLayout({ user, darkMode, setDarkMode, onLogout, isOnline, pendingSync, syncStatus, children }) {
  return (
    <div className={`lem-admin min-h-screen bg-lem-canvas font-body text-lem-ink dark:bg-gray-900 dark:text-white ${!isOnline ? 'pt-8' : ''}`}>
      <ConnectionBanners isOnline={isOnline} pendingSync={pendingSync} syncStatus={syncStatus} />

      <div className="flex min-h-screen flex-col min-[700px]:flex-row">
        <AdminSidebar user={user} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={onLogout} />

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <TrialBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
