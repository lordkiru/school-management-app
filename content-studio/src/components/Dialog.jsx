import { useEffect, useRef } from 'react'

// A modal dialog: closes with Escape or a click on the backdrop, moves focus into itself when it opens
// and gives it back to the button that opened it when it closes.
export default function Dialog({ title, onClose, children, wide = false }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && typeof opener.focus === 'function') opener.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`my-8 w-full rounded-xl bg-white p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
