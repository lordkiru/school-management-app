import Card from './Card';
import { relativeTime } from '../../utils/dashboardStats';

const TONES = {
  brand: 'bg-lem-brand dark:bg-indigo-400',
  green: 'bg-lem-green',
  amber: 'bg-lem-amber',
  red: 'bg-lem-red',
};

// events: [{ id, ts, tone, title, meta }] from buildActivity(). `now` is passed in so the
// relative times ("3h ago") all agree with each other and don't change between renders.
function ActivityFeed({ events, now }) {
  return (
    <Card className="p-[22px]">
      <h2 className="mb-3.5 font-display text-[14.5px] font-bold text-lem-ink dark:text-white">Recent Activity</h2>

      {events.length === 0 ? (
        <p className="text-[13px] text-lem-muted dark:text-gray-400">
          No recent activity yet. Fee payments, new students and messages you send will show up here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex gap-3 border-b border-lem-ink/[0.06] py-[11px] last:border-b-0 dark:border-white/10"
            >
              <span className={`w-[3px] flex-none rounded-sm ${TONES[ev.tone] || TONES.brand}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-lem-ink dark:text-white">{ev.title}</div>
                <div className="mt-0.5 text-xs text-lem-muted dark:text-gray-400">{ev.meta}</div>
              </div>
              <time
                dateTime={new Date(ev.ts).toISOString()}
                className="flex-none whitespace-nowrap text-[11.5px] text-lem-muted dark:text-gray-400"
              >
                {relativeTime(ev.ts, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default ActivityFeed;
