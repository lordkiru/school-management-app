import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { card, POOL_LABELS } from '../ui'

function Stat({ label, value, to, linkText }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
      {to && (
        <Link to={to} className="mt-2 inline-block text-sm font-semibold text-indigo-800 underline">
          {linkText}
        </Link>
      )}
    </div>
  )
}

const th = 'py-2 pr-4 text-left font-medium text-slate-700'
const td = 'py-2 pr-4'

export default function Dashboard() {
  const [state, setState] = useState({ stats: null, error: '' })

  useEffect(() => {
    api('/bank/stats')
      .then((stats) => setState({ stats, error: '' }))
      .catch((err) => setState({ stats: null, error: err.message }))
  }, [])

  const { stats, error } = state

  if (error) {
    return (
      <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">
        {error}
      </div>
    )
  }
  if (!stats) return <p role="status" className="text-slate-700">Loading the question bank...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Question bank overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Approved" value={stats.totals.approved} to="/questions?status=approved" linkText="View approved" />
        <Stat label="Draft (waiting for review)" value={stats.totals.draft} to="/questions?status=draft" linkText="Review drafts" />
        <Stat label="Rejected" value={stats.totals.rejected} to="/questions?status=rejected" linkText="View rejected" />
        <Stat label="All questions" value={stats.totals.total} to="/import" linkText="Import more" />
      </div>

      <section className={card} aria-labelledby="pools">
        <h2 id="pools" className="mb-3 text-lg font-bold text-slate-900">By pool</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Questions by pool and status</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className={th}>Pool</th>
                <th scope="col" className={th}>Approved</th>
                <th scope="col" className={th}>Draft</th>
                <th scope="col" className={th}>Rejected</th>
                <th scope="col" className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {['public', 'reserved'].map((pool) => (
                <tr key={pool} className="border-b border-slate-100">
                  <th scope="row" className={`${td} text-left font-medium text-slate-900`}>{POOL_LABELS[pool]}</th>
                  <td className={td}>{stats.byPool[pool].approved}</td>
                  <td className={td}>{stats.byPool[pool].draft}</td>
                  <td className={td}>{stats.byPool[pool].rejected}</td>
                  <td className={td}>{stats.byPool[pool].total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-700">
          Reserved questions are used only for school mocks and are never shown in the student Exam Prep app.
        </p>
      </section>

      <section aria-labelledby="subjects" className="space-y-3">
        <h2 id="subjects" className="text-lg font-bold text-slate-900">Subjects and topics</h2>
        {stats.subjects.length === 0 && (
          <p className={`${card} text-slate-700`}>
            No questions yet. <Link to="/import" className="font-semibold text-indigo-800 underline">Import your first file</Link>.
          </p>
        )}
        {stats.subjects.map((s) => (
          <details key={s.subject} className={card}>
            <summary className="cursor-pointer text-base font-semibold text-slate-900">
              {s.subject}
              <span className="ml-2 text-sm font-normal text-slate-700">
                {s.approved} approved · {s.draft} draft · {s.rejected} rejected
              </span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Topics in {s.subject}</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className={th}>Topic</th>
                    <th scope="col" className={th}>Approved</th>
                    <th scope="col" className={th}>Draft</th>
                    <th scope="col" className={th}>Rejected</th>
                    <th scope="col" className={th}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topics.map((t) => (
                    <tr key={t.topic} className="border-b border-slate-100">
                      <th scope="row" className={`${td} text-left font-medium text-slate-900`}>
                        <Link
                          to={`/questions?subject=${encodeURIComponent(s.subject)}&topic=${encodeURIComponent(t.topic)}`}
                          className="text-indigo-800 underline"
                        >
                          {t.topic}
                        </Link>
                      </th>
                      <td className={td}>{t.approved}</td>
                      <td className={td}>{t.draft}</td>
                      <td className={td}>{t.rejected}</td>
                      <td className={td}>{t.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}
