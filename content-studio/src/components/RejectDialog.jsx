import { useState } from 'react'
import Dialog from './Dialog'
import { btnDanger, btnSecondary, inputClass, labelClass } from '../ui'

// Asks for a reason before rejecting one or several questions. The note is shown to whoever edits the
// question next, so it is worth filling in.
export default function RejectDialog({ count, busy, onCancel, onConfirm }) {
  const [notes, setNotes] = useState('')

  return (
    <Dialog title={`Reject ${count} question${count === 1 ? '' : 's'}`} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onConfirm(notes.trim())
        }}
      >
        <label htmlFor="reject-notes" className={labelClass}>
          Why are you rejecting {count === 1 ? 'it' : 'them'}? (optional)
        </label>
        <textarea
          id="reject-notes"
          rows={4}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClass} mb-4`}
          placeholder="e.g. Two options could both be correct"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={btnDanger}>
            {busy ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
