/**
 * apiFetch — a thin wrapper around fetch() that:
 *  1. Automatically attaches the JWT Bearer token from localStorage
 *  2. Handles 401 Unauthorized by clearing auth and redirecting to login
 *  3. Returns parsed JSON or throws a structured error
 *
 * Usage:
 *   import apiFetch from '../utils/apiFetch';
 *   const data = await apiFetch('/students');
 *   const result = await apiFetch('/students', { method: 'POST', body: JSON.stringify({...}) });
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Reload to the root — the app will show the Login screen
  window.location.href = '/';
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Token expired or invalid — log the user out automatically
  if (res.status === 401) {
    clearAuthAndRedirect();
    throw new Error('Session expired. Please log in again.');
  }

  // Subscription expired / account suspended — return structured error
  // so components can show a meaningful message
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.error || 'Access denied');
    err.code = data.code || 'FORBIDDEN';
    err.status = 403;
    throw err;
  }

  // Parse JSON for all other responses
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed with status ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export default apiFetch;
