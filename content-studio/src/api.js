// Talks to the Lemida backend. The token lives under its own localStorage key so it can never be
// confused with a SchoolManager login.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

export const TOKEN_KEY = 'contentStudioToken'
export const USER_KEY = 'contentStudioUser'

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let unauthorizedHandler = null
// Called whenever the API answers 401 (token missing, expired or rejected): the app signs the user out.
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn
}

async function request(path, { method = 'GET', body, params, auth = true } = {}) {
  const query = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
    : ''

  let res
  try {
    res = await fetch(`${API_URL}${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0)
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // an empty or non-JSON body
  }

  if (res.status === 401 && auth && unauthorizedHandler) unauthorizedHandler()
  if (!res.ok) throw new ApiError(data?.error || `Something went wrong (${res.status})`, res.status, data?.details)
  return data
}

export const api = (path, options) => request(path, options)

// Same login endpoint the school staff use. No subdomain: Content Studio is not a school.
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password }, auth: false })
