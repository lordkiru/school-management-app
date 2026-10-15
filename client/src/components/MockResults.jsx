import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Minus, AlertTriangle } from 'lucide-react';
import { buildMockView, PASS_MARK } from '../utils/mockStats';

const TERMS = ['First Term', 'Second Term', 'Third Term'];
const TYPE_SHORT = { mock: 'Mock', practice: 'Practice' };

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

const pts = (n) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)} pts`;

// Direction is shown with an arrow and the signed number, so it never depends on colour alone.
function Progress({ value }) {
  if (value === null) return <span className="text-slate-400 dark:text-gray-500">—</span>;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const tone =
    value > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : value < 0
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-slate-600 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${tone}`}>
      <Icon size={14} aria-hidden="true" /> {pts(value)}
    </span>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      {note && <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

const pctText = (n) => (n === null ? '—' : `${n}%`);

function MockResults() {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const [showRank, setShowRank] = useState(false);
  // The last response, tagged with the filters it was fetched for, so "loading" is simply "the
  // latest response isn't for the filters on screen" and stale data is never shown under new ones.
  const [result, setResult] = useState({ key: '', data: null, error: '', code: '' });

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const load = async () => {
      try {
        const [subjectsRes, sessionsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/subjects`, { headers: authHeaders() }),
          fetch(`${import.meta.env.VITE_API_URL}/sessions`, { headers: authHeaders() }),
        ]);
        const subjectsData = await subjectsRes.json();
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
        const sessionData = await sessionsRes.json();
        const list = Array.isArray(sessionData) ? sessionData : [];
        setSessions(list);
        const current = list.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) {
        console.error('Failed to load filters', err);
      }
    };
    load();
  }, []);

  // A teacher only sees the subjects they teach (the server enforces the same rule)
  const visibleSubjects =
    user.role === 'teacher'
      ? subjects.filter((s) => s.teacherId && (s.teacherId._id || s.teacherId) === user.id)
      : subjects;

  const requestKey = subjectId && session ? `${subjectId}|${session}|${term}` : '';

  useEffect(() => {
    if (!requestKey) return undefined;
    let cancelled = false;

    const load = async () => {
      let next;
      try {
        const params = new URLSearchParams({ subjectId, session });
        if (term) params.append('term', term);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/cbt/mock-results?${params}`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        const body = await res.json();
        next = res.ok
          ? { key: requestKey, data: body, error: '', code: '' }
          : { key: requestKey, data: null, error: body.error || 'Failed to load results', code: body.code || '' };
      } catch (err) {
        next = { key: requestKey, data: null, error: err.message, code: '' };
      }
      if (!cancelled) setResult(next);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [requestKey, subjectId, session, term]);

  const current = requestKey && result.key === requestKey ? result : null;
  const data = current?.data || null;
  const view = useMemo(() => (data ? buildMockView(data, showRank) : null), [data, showRank]);

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';
  const messageClass = 'glass-card rounded-xl p-6 text-sm text-slate-500 dark:text-gray-400';

  let body;
  if (!requestKey) {
    body = <p className={messageClass}>Choose a subject and session to see mock and practice results.</p>;
  } else if (!current) {
    body = <p className={messageClass}>Loading results...</p>;
  } else if (current.code === 'CBT_NOT_AVAILABLE') {
    body = (
      <p className={messageClass}>
        Mock &amp; Practice comes with CBT, which needs the Growth plan (or any plan that includes CBT).
      </p>
    );
  } else if (current.error) {
    body = (
      <div className="bg-rose-50 dark:bg-red-900 text-rose-700 dark:text-red-200 text-sm p-3 rounded-lg">
        {current.error}
      </div>
    );
  } else if (data.tests.length === 0) {
    body = (
      <p className={messageClass}>
        No mock or practice tests yet for this subject and session. Create one in{' '}
        <Link to="/dashboard/cbt" className="text-indigo-600 dark:text-indigo-300 hover:underline">
          CBT Tests
        </Link>{' '}
        and choose &ldquo;Mock exam&rdquo; or &ldquo;Practice test&rdquo; as the test type.
      </p>
    );
  } else {
    const { tests, topics } = data;
    body = (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Class average (latest test)"
            value={pctText(view.latestAvg)}
            note={view.several ? `First test: ${pctText(view.firstAvg)}` : 'Only one test so far'}
          />
          <SummaryCard
            label="Change since first mock"
            value={view.change === null ? '—' : <Progress value={view.change} />}
            note={view.several ? 'Class average, in percentage points' : 'Needs at least two tests'}
          />
          <SummaryCard
            label="Students improving"
            value={view.several && view.tookBoth ? `${view.improving} of ${view.tookBoth}` : '—'}
            note={view.several ? 'Latest higher than first, of those who took both' : 'Needs at least two tests'}
          />
          <SummaryCard
            label="Needs attention"
            value={view.tookLatest ? view.needsAttention : '—'}
            note={`Below ${PASS_MARK}% on the latest test${view.tookLatest ? `, of ${view.tookLatest} who took it` : ''}`}
          />
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Scores</h3>
          {view.rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-400">No student has submitted these tests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 dark:border-gray-600 text-slate-500 dark:text-gray-400">
                    {showRank && <th className="py-2 pr-4 font-medium">Rank</th>}
                    <th className="py-2 pr-4 font-medium">Student</th>
                    {tests.map((t) => (
                      <th key={t._id} className="py-2 pr-4 font-medium">
                        <span className="block max-w-[9rem] truncate" title={t.title}>
                          {t.title}
                        </span>
                        <span className="block text-xs font-normal">{TYPE_SHORT[t.testType] || t.testType}</span>
                      </th>
                    ))}
                    <th className="py-2 pr-4 font-medium">Best</th>
                    <th className="py-2 pr-4 font-medium">Progress</th>
                    <th className="py-2 font-medium">Weakest topic</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((s) => (
                    <tr key={s.studentId} className="border-b border-slate-200 dark:border-gray-700">
                      {showRank && (
                        <td className="py-2 pr-4 font-semibold text-slate-800 dark:text-white">{s.rank ?? '—'}</td>
                      )}
                      <td className="py-2 pr-4">
                        <div className="font-medium text-slate-800 dark:text-white">{s.name}</div>
                        <div className="text-xs text-slate-500 dark:text-gray-400">{s.admissionNumber}</div>
                      </td>
                      {tests.map((t) => (
                        <td key={t._id} className="py-2 pr-4 text-slate-700 dark:text-gray-200">
                          {pctText(s.scores[t._id] ?? null)}
                        </td>
                      ))}
                      <td className="py-2 pr-4 font-semibold text-slate-800 dark:text-white">{pctText(s.best)}</td>
                      <td className="py-2 pr-4">
                        <Progress value={s.progress} />
                      </td>
                      <td className="py-2 text-slate-700 dark:text-gray-200">{s.weakestTopic || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-1 font-semibold text-slate-800 dark:text-white">Weak topics</h3>
          {topics.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-400">
              No topics yet. Add a topic to each question when you build a mock or practice test, and the topics the
              class struggles with will show up here.
            </p>
          ) : (
            <>
              <p className="mb-4 text-xs text-slate-500 dark:text-gray-400">
                Share of answers the whole class got right, weakest first. Below {PASS_MARK}% is worth re-teaching.
              </p>
              <ul className="space-y-3">
                {topics.map((t) => {
                  const weak = t.pct < PASS_MARK;
                  return (
                    <li key={t.topic}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-800 dark:text-white">{t.topic}</span>
                        <span className="flex items-center gap-2 text-slate-600 dark:text-gray-300">
                          {weak && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                              <AlertTriangle size={12} aria-hidden="true" /> re-teach
                            </span>
                          )}
                          {t.pct}% correct ({t.correct}/{t.total})
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${t.topic}: ${t.pct}% correct`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={t.pct}
                        className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"
                      >
                        <div
                          className={`h-full rounded-full ${weak ? 'bg-orange-500' : 'bg-indigo-500'}`}
                          style={{ width: `${t.pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="glass-card rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Mock &amp; Practice Results</h2>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Not counted in CA or report card
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600 dark:text-gray-300">Subject</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputClass}>
              <option value="">Select subject</option>
              {visibleSubjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — {s.classId?.name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600 dark:text-gray-300">Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} className={inputClass}>
              <option value="">Select session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>
                  {s.name} {s.isCurrent ? '(current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
              <option value="">All terms</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-600 dark:text-gray-300">
            <input type="checkbox" checked={showRank} onChange={(e) => setShowRank(e.target.checked)} />
            Show class ranking
          </label>
        </div>
      </div>

      {body}
    </div>
  );
}

export default MockResults;
