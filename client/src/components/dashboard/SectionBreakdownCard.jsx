import Card from './Card';

const TONES = {
  brand: { track: 'bg-lem-track dark:bg-white/10', bar: 'bg-lem-brand dark:bg-indigo-400' },
  amber: { track: 'bg-lem-amber-track dark:bg-white/10', bar: 'bg-lem-amber' },
};

// Label + bar + value per row. Used for BOTH "Students by Section" and "Outstanding Fees by
// Section" so the two always look and behave the same. rows: [{ key, label, valueLabel, pct }]
function SectionBreakdownCard({ title, total, rows, tone = 'brand', emptyText = 'Nothing to show yet.', footnote }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <Card className="p-[22px]">
      <div className="mb-[18px] flex items-center justify-between gap-3">
        <h2 className="font-display text-[14.5px] font-bold text-lem-ink dark:text-white">{title}</h2>
        <span className="text-xs font-semibold text-lem-muted dark:text-gray-400">{total}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-lem-muted dark:text-gray-400">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-[13px]">
          {rows.map((row) => (
            <div key={row.key}>
              <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
                <span className="font-semibold text-lem-ink dark:text-white">{row.label}</span>
                <span className="font-semibold text-lem-muted dark:text-gray-400">{row.valueLabel}</span>
              </div>
              <div className={`h-[7px] overflow-hidden rounded-full ${t.track}`} aria-hidden="true">
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {footnote && <p className="mt-4 text-xs text-lem-muted dark:text-gray-400">{footnote}</p>}
    </Card>
  );
}

export default SectionBreakdownCard;
