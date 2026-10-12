import Card from './Card';

const TONES = {
  brand: {
    chip: 'bg-lem-brand/[0.08] dark:bg-indigo-400/15',
    icon: 'text-lem-brand dark:text-indigo-300',
    accent: 'border-l-4 border-l-lem-brand dark:border-l-indigo-400',
    shadow: 'shadow-[0_14px_30px_-12px_rgba(67,56,202,0.45)] dark:shadow-[0_14px_30px_-12px_rgba(129,140,248,0.4)]',
  },
  purple: {
    chip: 'bg-violet-500/10 dark:bg-violet-400/15',
    icon: 'text-violet-600 dark:text-violet-300',
    accent: 'border-l-4 border-l-violet-500 dark:border-l-violet-400',
    shadow: 'shadow-[0_14px_30px_-12px_rgba(139,92,246,0.45)] dark:shadow-[0_14px_30px_-12px_rgba(167,139,250,0.4)]',
  },
  green: {
    chip: 'bg-lem-green/10 dark:bg-emerald-400/15',
    icon: 'text-lem-green dark:text-emerald-300',
    accent: 'border-l-4 border-l-lem-green dark:border-l-emerald-400',
    shadow: 'shadow-[0_14px_30px_-12px_rgba(46,158,110,0.45)] dark:shadow-[0_14px_30px_-12px_rgba(52,211,153,0.4)]',
  },
  red: {
    chip: 'bg-lem-red/[0.08] dark:bg-rose-400/15',
    icon: 'text-[#C94547] dark:text-rose-300',
    accent: 'border-l-4 border-l-lem-red dark:border-l-rose-400',
    shadow: 'shadow-[0_14px_30px_-12px_rgba(224,88,90,0.45)] dark:shadow-[0_14px_30px_-12px_rgba(251,113,133,0.4)]',
  },
};

// One headline number: tinted icon chip, big value, muted label, optional small footnote. The card's
// left edge bar (like the Attendance screen) and shadow are tinted to match its tone.
function StatCard({ icon: Icon, tone = 'brand', value, label, footnote }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <Card className={`p-5 ${t.accent}`} shadow={t.shadow}>
      <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-[10px] ${t.chip}`}>
        <Icon size={18} className={t.icon} aria-hidden="true" />
      </div>
      <div className="font-display text-[25px] font-extrabold leading-tight text-lem-ink [overflow-wrap:anywhere] dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-[12.5px] font-semibold text-lem-muted dark:text-gray-400">{label}</div>
      {footnote && <div className="mt-1 text-xs text-lem-muted dark:text-gray-400">{footnote}</div>}
    </Card>
  );
}

export default StatCard;
