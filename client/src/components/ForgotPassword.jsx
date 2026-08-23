import { useState } from 'react';

/**
 * ForgotPassword — self-service "I forgot my password" page.
 *
 * Accessible at /forgot-password (no login required).
 * User enters their email → server sends a reset link → user is shown
 * a generic success message (we never reveal whether the email exists).
 */
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Forgot Password
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {/* Success state */}
        {submitted ? (
          <div className="text-center">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm p-4 rounded-lg mb-6">
              ✅ If an account with that email exists, a reset link has been sent. Check your inbox (and spam folder).
            </div>
            <a
              href="/"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              ← Back to Login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Error */}
            {error && (
              <div className="bg-rose-50 dark:bg-red-900/30 text-rose-600 dark:text-red-300 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@school.com"
              className="w-full mb-5 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition mb-4"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <a
                href="/"
                className="text-sm text-slate-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                ← Back to Login
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
