import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { btnPrimary, btnSecondary, card, labelClass, STATUS_LABELS } from '../ui'

const MAX_BYTES = 5 * 1024 * 1024
const DUPLICATES_SHOWN_AT_FIRST = 25

function Count({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

// Questions that look like another question in the bank or earlier in the same file. Warnings only: they are
// imported anyway, but each is shown beside the question it looks like so you can decide before confirming.
function DuplicateWarnings({ duplicates, done }) {
  const [showAll, setShowAll] = useState(false)
  if (duplicates.length === 0) return null
  const shown = showAll ? duplicates : duplicates.slice(0, DUPLICATES_SHOWN_AT_FIRST)
  const plural = duplicates.length === 1 ? '' : 's'

  return (
    <section aria-labelledby="duplicates-title" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 id="duplicates-title" className="mb-1 text-base font-bold text-amber-950">
        {duplicates.length} possible duplicate{plural}: {done ? 'imported anyway, please check them' : 'please check before you import'}
      </h3>
      <p className="mb-3 text-sm text-amber-950">
        These are warnings, not errors. {done ? 'They were imported.' : 'They will still be imported unless you remove them from your file.'}{' '}
        Each one is shown next to the question it looks like (same or very similar wording, with the same numbers).
      </p>
      <ul className="space-y-3">
        {shown.map((d) => (
          <li key={d.externalId} className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">
              {d.externalId} looks like {d.matchesExternalId}
              <span className="font-normal text-slate-700"> · {d.reason} ({Math.round(d.similarity * 100)}% similar)</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">In this file · {d.externalId}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{d.text}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {d.matchesIn === 'bank'
                    ? `Already in the bank · ${d.matchesExternalId}${d.matchesStatus ? ` (${STATUS_LABELS[d.matchesStatus] || d.matchesStatus})` : ''}`
                    : `Earlier in this file · ${d.matchesExternalId}`}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-900">{d.matchesText}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {duplicates.length > DUPLICATES_SHOWN_AT_FIRST && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={`${btnSecondary} mt-3`}>
          {showAll ? 'Show fewer' : `Show all ${duplicates.length}`}
        </button>
      )}
    </section>
  )
}

function Report({ report }) {
  const done = !report.dryRun
  const problems = report.errors.length
  const duplicates = report.possibleDuplicates || []
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-800">
        <span className="font-semibold">{report.subject || 'No subject'}</span>
        {report.batch && <> · batch <span className="font-semibold">{report.batch}</span></>} · {report.total} question
        {report.total === 1 ? '' : 's'} in the file
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Count label={done ? 'Created' : 'Will be created'} value={report.toCreate} />
        <Count label={done ? 'Updated' : 'Will be updated'} value={report.toUpdate} />
        <Count label="Unchanged" value={report.unchanged} />
        <Count label={done ? 'Skipped (problems)' : 'Have problems'} value={problems} />
        <Count label="Possible duplicates" value={duplicates.length} />
        <Count label="Theory skipped" value={report.theorySkipped} />
      </div>

      {report.theorySkipped > 0 && (
        <p className="text-sm text-slate-800">
          Theory questions are not imported yet. {report.theorySkipped} in this file {done ? 'were' : 'will be'} left out.
        </p>
      )}

      {report.reapprovalNeeded.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p className="mb-1 font-semibold">
            {report.reapprovalNeeded.length} approved question{report.reapprovalNeeded.length === 1 ? '' : 's'} changed
            and {done ? 'went' : 'will go'} back to draft for re-approval:
          </p>
          <p className="break-words">{report.reapprovalNeeded.join(', ')}</p>
        </div>
      )}

      {problems > 0 && (
        <section aria-labelledby="problems-title">
          <h3 id="problems-title" className="mb-1 text-base font-bold text-rose-900">
            {problems} question{problems === 1 ? '' : 's'} with problems {done ? 'were skipped' : 'will be skipped'}
          </h3>
          <p className="mb-2 text-sm text-slate-800">
            Fix these in your file and import it again. Only what changed is touched.
          </p>
          <div className="overflow-x-auto rounded-lg border border-rose-200 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Questions with problems</caption>
              <thead>
                <tr className="border-b border-rose-200 bg-rose-50">
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-rose-950">Question ID</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold text-rose-950">What is wrong</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((e, i) => (
                  <tr key={`${e.externalId}-${i}`} className="border-b border-slate-100 align-top">
                    <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-900">{e.externalId}</th>
                    <td className="px-3 py-2 text-slate-900">
                      <ul className="list-disc space-y-0.5 pl-4">
                        {e.messages.map((m, j) => (
                          <li key={j}>{m}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DuplicateWarnings duplicates={duplicates} done={done} />
    </div>
  )
}

export default function Import() {
  const payload = useRef(null) // the parsed file lives in memory only, never saved anywhere
  const [fileInfo, setFileInfo] = useState(null) // { name, size }
  const [stage, setStage] = useState('idle') // idle | checking | checked | importing | done
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [inputKey, setInputKey] = useState(0)

  const reset = () => {
    payload.current = null
    setFileInfo(null)
    setStage('idle')
    setReport(null)
    setError('')
    setInputKey((k) => k + 1)
  }

  const onFile = async (e) => {
    const file = e.target.files[0]
    payload.current = null
    setReport(null)
    setError('')
    if (!file) {
      setFileInfo(null)
      setStage('idle')
      return
    }
    setFileInfo({ name: file.name, size: file.size })

    if (file.size > MAX_BYTES) {
      setStage('idle')
      setError('That file is larger than 5 MB. Split it into smaller files and import them one at a time.')
      return
    }

    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch (err) {
      setStage('idle')
      setError(`This is not a valid JSON file: ${err.message}`)
      return
    }

    payload.current = parsed
    setStage('checking')
    try {
      setReport(await api('/bank/import', { method: 'POST', params: { dryRun: 'true' }, body: parsed }))
      setStage('checked')
    } catch (err) {
      setStage('idle')
      setError(err.message)
    }
  }

  const confirmImport = async () => {
    setError('')
    setStage('importing')
    try {
      setReport(await api('/bank/import', { method: 'POST', params: { dryRun: 'false' }, body: payload.current }))
      payload.current = null
      setStage('done')
    } catch (err) {
      setStage('checked')
      setError(err.message)
    }
  }

  const willWrite = report ? report.toCreate + report.toUpdate : 0

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Import questions</h1>

      <section className={card} aria-labelledby="choose-title">
        <h2 id="choose-title" className="mb-1 text-lg font-bold text-slate-900">1. Choose a file</h2>
        <p className="mb-3 text-sm text-slate-800">
          Pick a question file (.json) from your computer. It is checked first and nothing is saved until you confirm. The
          file is read in your browser and sent straight to the server; it is not stored anywhere else.
        </p>
        <label htmlFor="file" className={labelClass}>Question file</label>
        <input
          key={inputKey}
          id="file"
          type="file"
          accept=".json,application/json"
          onChange={onFile}
          disabled={stage === 'checking' || stage === 'importing'}
          className="block w-full text-sm text-slate-900 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-800"
        />
        {fileInfo && (
          <p className="mt-2 text-sm text-slate-800">
            {fileInfo.name} ({(fileInfo.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </section>

      <div role="status" aria-live="polite">
        {stage === 'checking' && <p className="text-slate-800">Checking the file...</p>}
        {stage === 'importing' && <p className="text-slate-800">Importing...</p>}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-800">{error}</div>
      )}

      {report && (stage === 'checked' || stage === 'importing' || stage === 'done') && (
        <section className={card} aria-labelledby="report-title">
          <h2 id="report-title" className="mb-3 text-lg font-bold text-slate-900">
            {stage === 'done' ? 'Import finished' : '2. Check the report'}
          </h2>

          <Report report={report} />

          {stage !== 'done' ? (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="mb-1 text-base font-bold text-slate-900">3. Confirm</h3>
              <p className="mb-3 text-sm text-slate-800">
                {willWrite === 0
                  ? 'There is nothing to import from this file.'
                  : `This will save ${report.toCreate} new question${report.toCreate === 1 ? '' : 's'} as ${report.toCreate === 1 ? 'a draft' : 'drafts'} and update ${report.toUpdate} existing one${report.toUpdate === 1 ? '' : 's'}.`}
              </p>
              {(report.possibleDuplicates || []).length > 0 && (
                <p className="mb-3 text-sm font-medium text-amber-950">
                  {report.possibleDuplicates.length} possible duplicate{report.possibleDuplicates.length === 1 ? ' is' : 's are'} listed above and will still
                  be imported. Remove them from your file first if you do not want them.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={confirmImport} disabled={willWrite === 0 || stage === 'importing'} className={btnPrimary}>
                  {stage === 'importing' ? 'Importing...' : `Import ${willWrite} question${willWrite === 1 ? '' : 's'}`}
                </button>
                <button type="button" onClick={reset} disabled={stage === 'importing'} className={btnSecondary}>
                  Choose a different file
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <Link to="/questions?status=draft" className={btnPrimary}>Review the drafts</Link>
              <button type="button" onClick={reset} className={btnSecondary}>Import another file</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
