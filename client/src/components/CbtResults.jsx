import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Trophy, Clock, AlertTriangle } from 'lucide-react';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

function CbtResults({ refreshKey }) {
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [error, setError] = useState('');

  const [selectedTestId, setSelectedTestId] = useState(null);
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchTests = useCallback(async () => {
    setLoadingTests(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tests');
      setTests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests, refreshKey]);

  const openResults = async (testId) => {
    setSelectedTestId(testId);
    setLoadingResults(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests/${testId}/results`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load results');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingResults(false);
    }
  };

  const togglePublish = async (test) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests/${test._id}/publish`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update test');
      setTests((prev) => prev.map((t) => (t._id === test._id ? data : t)));
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Results detail view ─────────────────────────────────────────────────
  if (selectedTestId) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700">
        <button
          onClick={() => {
            setSelectedTestId(null);
            setResults(null);
          }}
          className="flex items-center gap-2 text-sm mb-4 text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft size={16} /> Back to tests
        </button>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
            {error}
          </div>
        )}

        {loadingResults ? (
          <p className="text-slate-500 dark:text-gray-400">Loading results...</p>
        ) : results ? (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{results.test.title}</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
              {results.test.questions.length} questions · feeds into {results.test.caSlot.toUpperCase()} ·{' '}
              {results.attempts.length} attempt{results.attempts.length === 1 ? '' : 's'}
            </p>

            {results.attempts.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-400 text-sm">No students have taken this test yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-gray-600">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Admission No.</th>
                      <th className="py-2 pr-4">Score</th>
                      <th className="py-2 pr-4">%</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.attempts.map((attempt) => {
                      const pct = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
                      return (
                        <tr key={attempt._id} className="border-b border-slate-200 dark:border-gray-700">
                          <td className="py-2 pr-4">{attempt.studentId?.name || '—'}</td>
                          <td className="py-2 pr-4">{attempt.studentId?.admissionNumber || '—'}</td>
                          <td className="py-2 pr-4 font-semibold">
                            {attempt.score} / {attempt.maxScore}
                          </td>
                          <td className="py-2 pr-4">{pct}%</td>
                          <td className="py-2 pr-4">
                            {attempt.status === 'submitted' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs">
                                <Trophy size={14} /> {attempt.autoSubmitted ? 'Auto-submitted (time up)' : 'Submitted'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                                <Clock size={14} /> In progress
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  }

  // ── Test list view ──────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Your CBT Tests</h2>

      {error && (
        <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {loadingTests ? (
        <p className="text-slate-500 dark:text-gray-400">Loading...</p>
      ) : tests.length === 0 ? (
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          No tests yet. Create one above and it will show up here.
        </p>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <div
              key={test._id}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-gray-600"
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-white">{test.title}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-2">
                  {test.subjectId?.name} · {test.classId?.name} · {test.questions.length} questions
                  {test.status === 'draft' ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} /> Draft
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">Published</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => togglePublish(test)}
                  className="text-sm font-medium py-2 px-3 rounded-lg border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                >
                  {test.status === 'draft' ? 'Publish' : 'Unpublish'}
                </button>
                <button
                  onClick={() => openResults(test._id)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition"
                >
                  Results
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CbtResults;
