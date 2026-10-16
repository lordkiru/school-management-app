import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../authContext'
import { btnSecondary } from '../ui'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/questions', label: 'Questions' },
  { to: '/import', label: 'Import' },
]

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-indigo-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="absolute left-2 top-2 z-50 -translate-y-16 rounded bg-white px-3 py-2 text-sm font-semibold text-indigo-800 shadow focus:translate-y-0"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-lg font-bold text-indigo-900">Lemida Content Studio</span>
            <nav aria-label="Main" className="flex flex-wrap gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user?.email && <span className="hidden text-sm text-slate-700 sm:inline">{user.email}</span>}
            <button type="button" onClick={signOut} className={btnSecondary}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
