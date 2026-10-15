import { useState } from 'react'
import Dialog from './Dialog'
import { api } from '../api'
import { btnPrimary, btnSecondary, DIFFICULTIES, EXAMS, inputClass, labelClass, LETTERS, POOL_LABELS } from '../ui'

// Edit one question. Saving an approved question sends it back to draft: a reviewer approved the old
// wording, not the new one.
export default function EditDialog({ question, onCancel, onSaved }) {
  const [form, setForm] = useState({
    text: question.text,
    options: [...question.options],
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    topic: question.topic,
    difficulty: question.difficulty,
    pool: question.pool,
    exams: [...question.exams],
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setOption = (i, value) => set({ options: form.options.map((o, idx) => (idx === i ? value : o)) })
  const addOption = () => form.options.length < 6 && set({ options: [...form.options, ''] })
  const removeOption = (i) => {
    if (form.options.length <= 2) return
    const options = form.options.filter((_, idx) => idx !== i)
    let correctIndex = form.correctIndex
    if (i === correctIndex) correctIndex = 0
    else if (i < correctIndex) correctIndex -= 1
    set({ options, correctIndex })
  }
  const toggleExam = (exam) =>
    set({ exams: form.exams.includes(exam) ? form.exams.filter((e) => e !== exam) : [...form.exams, exam] })

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (form.exams.length === 0) {
      setError('Choose at least one exam.')
      return
    }
    setBusy(true)
    try {
      const saved = await api(`/bank/questions/${question._id}`, { method: 'PATCH', body: form })
      onSaved(saved, question.status === 'approved' && saved.status === 'draft')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Dialog title={`Edit ${question.externalId}`} onClose={onCancel} wide>
      <form onSubmit={save}>
        {question.status === 'approved' && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            This question is approved. If you change anything, it goes back to draft and needs approving again.
          </p>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <label htmlFor="edit-text" className={labelClass}>Question</label>
        <textarea id="edit-text" rows={3} required value={form.text} onChange={(e) => set({ text: e.target.value })} className={`${inputClass} mb-4`} />

        <fieldset className="mb-4">
          <legend className={labelClass}>Options (choose the correct answer)</legend>
          <div className="space-y-2">
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={form.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                  aria-label={`Option ${LETTERS[i]} is the correct answer`}
                  className="h-4 w-4"
                />
                <span className="w-5 text-sm font-semibold text-slate-800">{LETTERS[i]}.</span>
                <input
                  type="text"
                  required
                  value={option}
                  onChange={(e) => setOption(i, e.target.value)}
                  aria-label={`Option ${LETTERS[i]} text`}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={form.options.length <= 2}
                  className={btnSecondary}
                  aria-label={`Remove option ${LETTERS[i]}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {form.options.length < 6 && (
            <button type="button" onClick={addOption} className={`${btnSecondary} mt-2`}>
              Add option
            </button>
          )}
        </fieldset>

        <label htmlFor="edit-explanation" className={labelClass}>Explanation</label>
        <textarea id="edit-explanation" rows={3} required value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} className={`${inputClass} mb-4`} />

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="edit-topic" className={labelClass}>Topic</label>
            <input id="edit-topic" type="text" required value={form.topic} onChange={(e) => set({ topic: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="edit-difficulty" className={labelClass}>Difficulty</label>
            <select id="edit-difficulty" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} className={inputClass}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-pool" className={labelClass}>Pool</label>
            <select id="edit-pool" value={form.pool} onChange={(e) => set({ pool: e.target.value })} className={inputClass}>
              {Object.entries(POOL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mb-5">
          <legend className={labelClass}>Exams</legend>
          <div className="flex gap-4">
            {EXAMS.map((exam) => (
              <label key={exam} className="flex items-center gap-2 text-sm text-slate-900">
                <input type="checkbox" checked={form.exams.includes(exam)} onChange={() => toggleExam(exam)} className="h-4 w-4" />
                {exam}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </Dialog>
  )
}
