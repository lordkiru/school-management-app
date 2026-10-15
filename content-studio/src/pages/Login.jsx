import { useState } from 'react'
import { useAuth } from '../authContext'
import { btnPrimary, card, inputClass, labelClass } from '../ui'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className={`${card} w-full max-w-sm`} aria-labelledby="login-title">
        <h1 id="login-title" className="mb-1 text-2xl font-bold text-indigo-900">
          Lemida Content Studio
        </h1>
        <p className="mb-5 text-sm text-slate-700">Sign in to manage the Lemida question bank.</p>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} mb-4`}
        />

        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputClass} mb-5`}
        />

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
