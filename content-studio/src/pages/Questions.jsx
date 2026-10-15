import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'
import RejectDialog from '../components/RejectDialog'
import EditDialog from '../components/EditDialog'
import { btnPrimary, btnSecondary, card, EXAMS, inputClass, labelClass, POOL_LABELS, STATUS_LABELS } from '../ui'

const FILTERS = ['subject', 'topic', 'status', 'pool', 'exam', 'search']
const PAGE_SIZE = 25

export default function Questions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = Object.fromEntries(FILTERS.map((k) => [k, searchParams.get(k) || '']))
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1)

  const [searchText, setSearchText] = useState(filters.search)
  const [stats, setStats] = useState(null)
  const [reload, setReload] = useState(0)
  // The last response, tagged with what it was fetched for, so "loading" is simply "the latest
  // response is not for the filters on screen" and stale questions are never shown under new filters.
  const [result, setResult] = useState({ key: '', data: null, error: '' })
  const [selected, setSelected] = useState(() => new Set())
  const [notice, setNotice] = useState(null) // { ok, text }
  const [dialog, setDialog] = useState(null) // { type: 'reject', ids } | { type: 'edit', question }
  const [busy, setBusy] = useState(false)

  const requestKey = `${searchParams.toString()}|${reload}`

  useEffect(() => {
    api('/bank/stats').then(setStats).catch(() => setStats({ subjects: [] }))
  }, [])

  useEffect(() => {
    let cancelled = false
    const params = Object.fromEntries(FILTERS.map((k) => [k, searchParams.get(k) || '']))
    api('/bank/questions', { params: { ...params, page, limit: PAGE_SIZE } })
      .then((data) => !cancelled && setResult({ key: requestKey, data, error: '' }))
      .catch((err) => !cancelled && setResult({ key: requestKey, data: null, error: err.message }))
    return () => {
      cancelled = true
    }
  }, [requestKey, searchParams, page])

  const current = result.key === requestKey ? result : null
  const questions = current?.data?.questions || []

  const subjects = stats?.subjects || []
  const topicOptions = filters.subject
    ? subjects.find((s) => s.subject === filters.subject)?.topics.map((t) => t.topic) || []
    : [...new Set(subjects.flatMap((s) => s.topics.map((t) => t.topic)))].sort()

  const updateParams = (patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)))
    if (!keepPage) next.delete('page')
    setSelected(new Set())
    setSearchParams(next)
  }

  const changeSubject = (subject) => updateParams({ subject, topic: '' })
  const clearFilters = () => {
    setSearchText('')
    setSelected(new Set())
    setSearchParams(new URLSearchParams())
  }

  const toggleOne = (id, checked) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  const allOnPage = questions.length > 0 && questions.every((q) => selected.has(q._id))
  const toggleAll = (checked) => setSelected(checked ? new Set(questions.map((q) => q._id)) : new Set())

  const review = async (ids, status, notes) => {
    setBusy(true)
    setNotice(null)
    try {
      const out = await api('/bank/review', { method: 'POST', body: { ids, status, notes } })
      setNotice({ ok: true, text: `${out.modified} question${out.modified === 1 ? '' : 's'} ${status}.` })
      setSelected(new Set())
      setDialog(null)
      setReload((n) => n + 1)
    } catch (err) {
      setNotice({ ok: false, text: err.message })
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  const saved = (question, wasApproved) => {
    setDialog(null)
    setNotice({
      ok: true,
      text: wasApproved ? `Saved ${question.externalId}. It is back to draft and needs approving again.` : `Saved ${question.externalId}.`,
    })
    setReload((n) => n + 1)
  }

  const total = current?.data?.total ?? 0
  const totalPages = current?.data?.totalPages ?? 1
  const hasFilters = FILTERS.some((k) => filters[k])
  const ids = [...selected]

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Questions</h1>

      <form
        className={`${card} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`}
        onSubmit={(e) => {
          e.preventDefault()
          updateParams({ search: searchText.trim() })
        }}
        aria-label="Filter questions"
      >
        <div>
          <label htmlFor="f-subject" className={labelClass}>Subject</label>
          <select id="f-subject" value={filters.subject} onChange={(e) => changeSubject(e.target.value)} className={inputClass}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>{s.subject}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-topic" className={labelClass}>Topic</label>
          <select id="f-topic" value={filters.topic} onChange={(e) => updateParams({ topic: e.target.value })} className={inputClass}>
            <option value="">All topics</option>
            {topicOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className={labelClass}>Status</label>
          <select id="f-status" value={filters.status} onChange={(e) => updateParams({ status: e.target.value })} className={inputClass}>
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-pool" className={labelClass}>Pool</label>
          <select id="f-pool" value={filters.pool} onChange={(e) => updateParams({ pool: e.target.value })} className={inputClass}>
            <option value="">Any pool</option>
            {Object.entries(POOL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-exam" className={labelClass}>Exam</label>
          <select id="f-exam" value={filters.exam} onChange={(e) => updateParams({ exam: e.target.value })} className={inputClass}>
            <option value="">Any exam</option>
            {EXAMS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-search" className={labelClass}>Search question text or ID</label>
          <div className="flex gap-2">
            <input id="f-search" type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} className={inputClass} />
            <button type="submit" className={btnPrimary}>Search</button>
          </div>
        </div>
        {hasFilters && (
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="button" onClick={clearFilters} className={btnSecondary}>Clear filters</button>
          </div>
        )}
      </form>

      <div role="status" aria-live="polite">
        {notice && (
          <p className={`rounded-lg p-3 text-sm ${notice.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-800'}`}>
            {notice.text}
          </p>
        )}
      </div>

      {!current && <p role="status" className="text-slate-700">Loading questions...</p>}
      {current?.error && (
        <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">{current.error}</div>
      )}

      {current?.data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={allOnPage} onChange={(e) => toggleAll(e.target.checked)} disabled={questions.length === 0} className="h-4 w-4" />
              Select all on this page
            </label>
            <p className="text-sm text-slate-700">
              {total} question{total === 1 ? '' : 's'} found
            </p>
          </div>

          {ids.length > 0 && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <span className="text-sm font-semibold text-indigo-950">{ids.length} selected</span>
              <button type="button" disabled={busy} onClick={() => review(ids, 'approved')} className={btnPrimary}>
                Approve selected
              </button>
              <button type="button" disabled={busy} onClick={() => setDialog({ type: 'reject', ids })} className={btnSecondary}>
                Reject selected
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className={btnSecondary}>
                Clear selection
              </button>
            </div>
          )}

          {questions.length === 0 ? (
            <p className={`${card} text-slate-700`}>No questions match these filters.</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <QuestionCard
                  key={q._id}
                  q={q}
                  selected={selected.has(q._id)}
                  onSelect={toggleOne}
                  onApprove={(id) => review([id], 'approved')}
                  onReject={(id) => setDialog({ type: 'reject', ids: [id] })}
                  onEdit={(question) => setDialog({ type: 'edit', question })}
                  disabled={busy}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between">
              <button type="button" disabled={page <= 1} onClick={() => updateParams({ page: page - 1 }, { keepPage: true })} className={btnSecondary}>
                Previous
              </button>
              <span className="text-sm text-slate-800">Page {page} of {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => updateParams({ page: page + 1 }, { keepPage: true })} className={btnSecondary}>
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {dialog?.type === 'reject' && (
        <RejectDialog
          count={dialog.ids.length}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(notes) => review(dialog.ids, 'rejected', notes)}
        />
      )}
      {dialog?.type === 'edit' && <EditDialog question={dialog.question} onCancel={() => setDialog(null)} onSaved={saved} />}
    </div>
  )
}
