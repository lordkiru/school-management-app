import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import { api, ApiError, getToken, login, setUnauthorizedHandler, TOKEN_KEY, USER_KEY } from './api'

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

// Who may use Content Studio is decided by the server, not here: after signing in we ask the question
// bank for its stats, and only an account the bank accepts gets in (today: super admin).
export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => (getToken() ? 'checking' : 'out')) // checking | in | out
  const [user, setUser] = useState(readUser)

  const signOut = useCallback(() => {
    clearSession()
    setUser(null)
    setStatus('out')
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  // Returning visitor: make sure the saved token still works and still has access
  useEffect(() => {
    if (!getToken()) return
    api('/bank/stats')
      .then(() => setStatus('in'))
      .catch(() => signOut())
  }, [signOut])

  const signIn = useCallback(async (email, password) => {
    const { token, user: who } = await login(email, password)
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      throw new ApiError('This browser is blocking storage, so you cannot stay signed in. Allow site data and try again.', 0)
    }
    try {
      await api('/bank/stats')
    } catch (err) {
      clearSession()
      if (err.status === 403) {
        throw new ApiError('This account does not have access to Lemida Content Studio.', 403)
      }
      throw err
    }
    localStorage.setItem(USER_KEY, JSON.stringify({ name: who?.name, email: who?.email }))
    setUser({ name: who?.name, email: who?.email })
    setStatus('in')
  }, [])

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
