import { Link } from 'react-router-dom';
import { Bell, Plus } from 'lucide-react';
import DashboardSearch from './DashboardSearch';

// Greeting + school/term line on the left; search, notifications and the Record Payment button
// on the right. Buttons the user's role can't use are simply not rendered.
function DashboardTopbar({ userName, subtitle, students, classes, canOpenClasses, canOpenMessaging, canRecordPayment }) {
  const firstName = (userName || '').trim().split(/\s+/)[0] || 'there';
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold leading-tight text-lem-ink dark:text-white">
          Welcome back, {firstName}
        </h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-lem-muted dark:text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex w-full flex-wrap items-center gap-2.5 min-[520px]:w-auto">
        <DashboardSearch students={students} classes={classes} canOpenClasses={canOpenClasses} />

        {/* The app has no "unread" state for notifications, so the bell is a plain link to Messaging
            (no unread dot - that would be invented). */}
        {canOpenMessaging && (
          <Link
            to="/dashboard/notifications"
            aria-label="Notifications"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] border border-lem-ink/10 bg-white text-lem-ink transition hover:bg-lem-canvas dark:border-white/10 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            <Bell size={17} aria-hidden="true" />
          </Link>
        )}

        {canRecordPayment && (
          <Link
            to="/dashboard/fees"
            className="inline-flex items-center gap-[7px] rounded-[11px] bg-lem-brand px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-lem-brand-deep"
          >
            <Plus size={15} strokeWidth={2.3} aria-hidden="true" />
            Record Payment
          </Link>
        )}
      </div>
    </div>
  );
}

export default DashboardTopbar;
