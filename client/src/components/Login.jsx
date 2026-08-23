import { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Extract subdomain from the current hostname for tenant-scoped login.
      // e.g. "greenfield.lemida.com" → subdomain = "greenfield"
      // On localhost or the root domain there is no subdomain — send empty string,
      // and the server will fall back to a global lookup (dev mode / super admin).
      const hostname = window.location.hostname; // e.g. "greenfield.lemida.com" or "localhost"
      const parts = hostname.split('.');
      // A subdomain exists when there are 3+ parts and the first part is not "www"
      const subdomain = parts.length >= 3 && parts[0] !== 'www' ? parts[0] : '';

      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, subdomain }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-900 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-slate-800 dark:text-white">
          Lemida Login
        </h1>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
        />

        <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-6 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition mb-4"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>

        <div className="text-center">
          <a
            href="/forgot-password"
            className="text-sm text-slate-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            Forgot your password?
          </a>
        </div>
      </form>
    </div>
  );
}

export default Login;
