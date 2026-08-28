import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, CheckCircle } from 'lucide-react';

function authHeaders() {
  const token = localStorage.getItem('studentToken');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function CbtTestTaking() {
  const [availableTests, setAvailableTests] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');

  const [activeTest, setActiveTest] = useState(null); // { test, attempt }
  const [answers, setAnswers] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const submittedRef = useRef(false);

  const fetchAvailable = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests/available`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tests');
      setAvailableTests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailable();
  }, [fetchAvailable]);

  const submit = useCallback(async (finalAnswers) => {
    if (!activeTest || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/attempts/${activeTest.attempt._id}/submit`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      setResult(data);
    } catch (err) {
      setError(err.message);
      submittedRef.current = false; // allow retry on network failure
    } finally {
      setSubmitting(false);
    }
  }, [activeTest]);

  // Server-anchored countdown: recompute from startedAt + durationMinutes every tick,
  // never trust a client-only timer that could drift or be paused by backgrounding the tab.
  useEffect(() => {
    if (!activeTest) return;
    const deadline = new Date(activeTest.attempt.startedAt).getTime() + activeTest.test.durationMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        submit(answers);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTest]);

  const startTest = async (testId) => {
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/tests/${testId}/start`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start test');

      submittedRef.current = false;
      setResult(null);
      setActiveTest(data);
      setAnswers(data.attempt.answers?.length ? data.attempt.answers : new Array(data.test.questions.length).fill(-1));
    } catch (err) {
      setError(err.message);
    }
  };

  const selectAnswer = (questionIndex, optionIndex) => {
    setAnswers((prev) => prev.map((a, i) => (i === questionIndex ? optionIndex : a)));
  };

  const formatTime = (s) => {
    if (s === null) return '--:--';
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Result screen ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-lg mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 text-center">
        <CheckCircle className="mx-auto text-emerald-500 mb-3" size={48} />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Test submitted</h2>
        <p className="text-slate-600 dark:text-gray-300 mb-4">
          You scored {result.attempt.score} out of {result.attempt.maxScore}.
        </p>
        <button
          onClick={() => {
            setActiveTest(null);
            setResult(null);
            fetchAvailable();
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          Back to tests
        </button>
      </div>
    );
  }

  // ── Active test screen ───────────────────────────────────────────────────
  if (activeTest) {
    const { test } = activeTest;
    const lowTime = secondsLeft !== null && secondsLeft <= 60;
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-gray-800 pb-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{test.title}</h2>
          <div className={`flex items-center gap-1 font-mono text-lg ${lowTime ? 'text-rose-600' : 'text-slate-700 dark:text-gray-200'}`}>
            <Clock size={18} /> {formatTime(secondsLeft)}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
            {error}
          </div>
        )}

        {test.questions.map((q, qIndex) => (
          <div key={q._id || qIndex} className="mb-5 p-4 rounded-lg border border-slate-200 dark:border-gray-600">
            <p className="font-medium text-slate-800 dark:text-white mb-3">
              {qIndex + 1}. {q.text}
            </p>
            {q.options.map((opt, oIndex) => (
              <label key={oIndex} className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  name={`q-${qIndex}`}
                  checked={answers[qIndex] === oIndex}
                  onChange={() => selectAnswer(qIndex, oIndex)}
                />
                <span className="text-slate-700 dark:text-gray-200">{opt}</span>
              </label>
            ))}
          </div>
        ))}

        <button
          onClick={() => submit(answers)}
          disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-lg transition"
        >
          {submitting ? 'Submitting...' : 'Submit test'}
        </button>
      </div>
    );
  }

  // ── Test list screen ─────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Available tests</h2>

      {error && (
        <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {loadingList ? (
        <p className="text-slate-500 dark:text-gray-400">Loading...</p>
      ) : availableTests.length === 0 ? (
        <p className="text-slate-500 dark:text-gray-400">No tests available right now.</p>
      ) : (
        <div className="space-y-3">
          {availableTests.map((test) => (
            <div
              key={test._id}
              className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-white">{test.title}</p>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  {test.subjectId?.name} · {test.durationMinutes} min · {test.questions.length} questions
                </p>
              </div>
              <button
                onClick={() => startTest(test._id)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                Start
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CbtTestTaking;
