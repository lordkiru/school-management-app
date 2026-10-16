import StatusBadge from './StatusBadge'
import { btnPrimary, btnSecondary, LETTERS, POOL_LABELS } from '../ui'

const chip = 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800'

export default function QuestionCard({ q, selected, onSelect, onApprove, onReject, onEdit, disabled }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={`Question ${q.externalId}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(q._id, e.target.checked)}
            className="h-4 w-4"
          />
          <span>
            <span className="sr-only">Select question </span>
            {q.externalId}
          </span>
        </label>
        <StatusBadge status={q.status} />
        <span className={chip}>{q.topic}</span>
        <span className={chip}>{q.difficulty}</span>
        <span className={chip}>{POOL_LABELS[q.pool] || q.pool}</span>
        <span className={chip}>{(q.exams || []).join(' / ')}</span>
        {q.section && <span className={chip}>{q.section}</span>}
      </div>

      <p className="mb-3 whitespace-pre-wrap text-base text-slate-900">{q.text}</p>

      <ol className="mb-3 space-y-1.5" aria-label="Answer options">
        {q.options.map((option, i) => {
          const correct = i === q.correctIndex
          return (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                correct ? 'border-emerald-600 bg-emerald-50 text-emerald-950' : 'border-slate-200 text-slate-900'
              }`}
            >
              <span className="font-semibold">{LETTERS[i]}.</span>
              <span className="flex-1 whitespace-pre-wrap">{option}</span>
              {correct && <span className="whitespace-nowrap font-semibold">✓ Correct answer</span>}
            </li>
          )
        })}
      </ol>

      <p className="mb-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
        <span className="font-semibold">Explanation: </span>
        {q.explanation}
      </p>

      {q.reviewNotes && (
        <p className="mb-2 text-sm text-slate-800">
          <span className="font-semibold">Review notes: </span>
          {q.reviewNotes}
          {q.reviewedBy && <span className="text-slate-700"> ({q.reviewedBy})</span>}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onApprove(q._id)} disabled={disabled || q.status === 'approved'} className={btnPrimary}>
          Approve<span className="sr-only"> {q.externalId}</span>
        </button>
        <button type="button" onClick={() => onReject(q._id)} disabled={disabled || q.status === 'rejected'} className={btnSecondary}>
          Reject<span className="sr-only"> {q.externalId}</span>
        </button>
        <button type="button" onClick={() => onEdit(q)} disabled={disabled} className={btnSecondary}>
          Edit<span className="sr-only"> {q.externalId}</span>
        </button>
      </div>
    </article>
  )
}
