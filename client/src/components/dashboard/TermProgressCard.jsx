import Card from './Card';
import { formatNaira } from '../../utils/dashboardStats';

// One progress bar: how much of what was billed this term has been collected.
function TermProgressCard({ collected, expected, percent, termLabel }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <Card className="p-[22px]">
      <h2 className="mb-1.5 font-display text-[14.5px] font-bold text-lem-ink dark:text-white">Term Collection Progress</h2>

      {expected <= 0 ? (
        <p className="text-xs text-lem-muted dark:text-gray-400">
          No fees have been billed{termLabel ? ` for ${termLabel}` : ''} yet.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-lem-muted dark:text-gray-400">
            {formatNaira(collected)} of {formatNaira(expected)} billed
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-lem-track dark:bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Share of this term's fees collected"
          >
            <div
              className="h-full rounded-full bg-lem-brand dark:bg-indigo-400"
              style={{ width: `${pct}%`, minWidth: pct > 0 ? 6 : 0 }}
            />
          </div>
          <div className="mt-2.5 font-display text-xl font-extrabold text-lem-ink dark:text-white">{pct.toFixed(1)}%</div>
        </>
      )}
    </Card>
  );
}

export default TermProgressCard;
