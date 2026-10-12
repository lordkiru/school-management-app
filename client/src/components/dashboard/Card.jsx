// The one white card surface the school admin dashboard uses everywhere (stat cards, section
// breakdowns, activity feed, progress, quick actions), so they can't drift apart visually.
// `shadow` lets a card swap the neutral shadow for a coloured one (the stat cards do).
function Card({ className = '', shadow = 'shadow-[0_10px_24px_-18px_rgba(30,36,51,0.5)]', children, ...rest }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-lem-ink/[0.06] bg-white dark:border-white/10 dark:bg-gray-800 ${shadow} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
