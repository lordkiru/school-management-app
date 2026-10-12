import Card from './Card';

const TONES = {
  brand: { chip: 'bg-lem-brand/[0.08] dark:bg-indigo-400/15', icon: 'text-lem-brand dark:text-indigo-300' },
  ink: { chip: 'bg-lem-ink/[0.08] dark:bg-white/10', icon: 'text-lem-ink dark:text-gray-200' },
  red: { chip: 'bg-lem-red/[0.08] dark:bg-rose-400/15', icon: 'text-[#C94547] dark:text-rose-300' },
};

// One headline number: tinted icon chip, big value, muted label, optional small footnote.
function StatCard({ icon: Icon, tone = 'brand', value, label, footnote }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <Card className="p-5">
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
