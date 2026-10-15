// What this school may do with CBT, from GET /subscriptions/cbt-access:
//   { fullCbt, mockPractice, addon: { active, expiresAt } | null, inTrial }
// fullCbt = CA tests + mock + practice; mockPractice without fullCbt = the CBT add-on (mock and
// practice only, never CA tests). Returns null if it can't be loaded, so callers fall back to
// today's behaviour and the server stays the one that enforces access.
export async function fetchCbtAccess() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL}/subscriptions/cbt-access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Add-on school: can run mock exams and practice tests but not CA tests.
export const isAddonOnly = (access) => !!access && !access.fullCbt && access.mockPractice;

// "31 Mar 2027"
export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
