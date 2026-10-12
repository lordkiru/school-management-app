import { Link } from 'react-router-dom';
import Card from './Card';

// actions: [{ to, label, icon }] - already filtered to what this user's role can actually open.
function QuickActions({ actions }) {
  if (actions.length === 0) return null;
  return (
    <Card className="p-[22px]">
      <h2 className="mb-3.5 font-display text-[14.5px] font-bold text-lem-ink dark:text-white">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ to, label, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="flex flex-col gap-2 rounded-xl bg-lem-brand/[0.06] p-3 text-[12.5px] font-bold text-lem-ink transition hover:bg-lem-brand/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/10"
          >
            <Icon size={16} className="text-lem-brand dark:text-indigo-300" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export default QuickActions;
