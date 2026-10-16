import { STATUS_LABELS } from '../ui'

const STYLES = {
  draft: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-rose-100 text-rose-900',
}

// The word is always shown, so status never depends on colour alone.
export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status] || 'bg-slate-100 text-slate-800'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
