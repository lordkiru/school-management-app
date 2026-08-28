import { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';

function CbtHistory() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('studentToken');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/attempts/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load history');
        setAttempts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading...</p>;
  if (error) return <p className="p-6 text-rose-600 dark:text-rose-400">{error}</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Your test history</h2>

      {attempts.length === 0 ? (
        <p className="text-slate-500 dark:text-gray-400">You haven't taken any tests yet.</p>
      ) : (
        <div className="space-y-3">
          {attempts.map((attempt) => {
            const test = attempt.testId;
            const pct = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : null;
            return (
              <div
                key={attempt._id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{test?.title || 'Test'}</p>
                  <p className="text-sm text-slate-500 dark:text-gray-400">
                    {test?.subjectId?.name || ''}
                  </p>
                </div>
                <div className="text-right">
                  {attempt.status === 'submitted' ? (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle size={16} />
                      {attempt.score}/{attempt.maxScore} {pct !== null && `(${pct}%)`}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm">
                      <Clock size={14} /> In progress
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CbtHistory;
