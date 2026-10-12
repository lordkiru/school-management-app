// The one white card surface the school admin dashboard uses everywhere (stat cards, section
// breakdowns, activity feed, progress, quick actions), so they can't drift apart visually.
function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-lem-ink/[0.06] bg-white shadow-[0_10px_24px_-18px_rgba(30,36,51,0.5)] dark:border-white/10 dark:bg-gray-800 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
