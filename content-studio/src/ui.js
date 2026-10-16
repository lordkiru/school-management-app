// Shared class names so buttons and fields look the same everywhere.
export const btn =
  'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'
export const btnPrimary = `${btn} bg-indigo-700 text-white hover:bg-indigo-800`
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`
export const btnDanger = `${btn} bg-rose-700 text-white hover:bg-rose-800`
export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500'
export const card = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm'
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

export const STATUS_LABELS = { draft: 'Draft', approved: 'Approved', rejected: 'Rejected' }
export const POOL_LABELS = { public: 'Public', reserved: 'Reserved (school mocks only)' }
export const DIFFICULTIES = ['easy', 'medium', 'hard']
export const EXAMS = ['WAEC', 'NECO']
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
