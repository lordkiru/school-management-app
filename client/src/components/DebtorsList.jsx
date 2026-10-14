import { useState, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import printArea from '../utils/printArea';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

const naira = (n) => `₦${n.toLocaleString()}`;

// The non-money columns in the order they appear. The Class column exists only in the whole-school
// view (in the grouped view the class is already the group heading). The header renders from this
// list and the footer's colSpan is its length, so the subtotal/total label cell always spans exactly
// the columns to its left and Expected / Paid / Owing stay under their own headers.
function leadingColumns(showClass) {
  return [
    { key: 'student', label: 'Student' },
    { key: 'admission', label: 'Admission No.' },
    showClass && { key: 'class', label: 'Class' },
    { key: 'term', label: 'Term — Session' },
  ].filter(Boolean);
}

// "N owing" counts students, not fee rows: a student behind in two terms is still one debtor.
const countStudents = (rows) => new Set(rows.map((r) => r.studentId)).size;

const sumOf = (rows) =>
  rows.reduce(
    (acc, r) => ({
      amountExpected: acc.amountExpected + r.amountExpected,
      amountPaid: acc.amountPaid + r.amountPaid,
      balance: acc.balance + r.balance,
    }),
    { amountExpected: 0, amountPaid: 0, balance: 0 }
  );

const thClass = 'py-2 text-left text-slate-500 dark:text-gray-400 font-medium';

function DebtorsHeader({ showClass }) {
  return (
    <tr className="border-b border-slate-200 dark:border-gray-700">
      {leadingColumns(showClass).map((c) => (
        <th key={c.key} className={thClass}>
          {c.label}
        </th>
      ))}
      <th className={thClass}>Expected</th>
      <th className={thClass}>Paid</th>
      <th className={thClass}>Owing</th>
    </tr>
  );
}

function DebtorRow({ r, showClass }) {
  return (
    <tr className="border-b border-slate-100 dark:border-gray-700">
      <td className="py-2 font-medium text-slate-800 dark:text-white">{r.studentName}</td>
      <td className="py-2 text-slate-600 dark:text-gray-300">{r.admissionNumber}</td>
      {showClass && <td className="py-2 text-slate-600 dark:text-gray-300">{r.className}</td>}
      <td className="py-2 text-slate-600 dark:text-gray-300">
        {r.term} — {r.session}
      </td>
      <td className="py-2 text-slate-600 dark:text-gray-300">{naira(r.amountExpected)}</td>
      <td className="py-2 text-emerald-700 dark:text-emerald-400 font-medium">{naira(r.amountPaid)}</td>
      <td className="py-2 text-rose-700 dark:text-rose-400 font-medium">{naira(r.balance)}</td>
    </tr>
  );
}

// One table with a footer row: used for every class group and for the whole-school list.
function DebtorsTable({ rows, showClass, footerLabel }) {
  const total = sumOf(rows);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse mb-4">
        <thead>
          <DebtorsHeader showClass={showClass} />
        </thead>
        <tbody>
          {rows.map((r) => (
            <DebtorRow key={r.feeId} r={r} showClass={showClass} />
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 dark:border-gray-600 font-semibold">
            <td colSpan={leadingColumns(showClass).length} className="py-2 text-slate-800 dark:text-white">
              {footerLabel}
            </td>
            <td className="py-2 text-slate-800 dark:text-white">{naira(total.amountExpected)}</td>
            <td className="py-2 text-emerald-700 dark:text-emerald-400">{naira(total.amountPaid)}</td>
            <td className="py-2 text-rose-700 dark:text-rose-400">{naira(total.balance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function groupByClass(results) {
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.classId)) groups.set(r.classId, { classId: r.classId, className: r.className, rows: [] });
    groups.get(r.classId).rows.push(r);
  }
  return [...groups.values()].sort((a, b) => a.className.localeCompare(b.className));
}

function DebtorsList() {
  const [school, setSchool] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [term, setTerm] = useState('');
  const [session, setSession] = useState('');
  const [classId, setClassId] = useState('');
  const [view, setView] = useState('grouped'); // 'grouped' | 'whole'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchSchool = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, { headers });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();

    const fetchSessions = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, { headers });
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load sessions', err);
      }
    };
    fetchSessions();

    const fetchClasses = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, { headers });
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    };
    fetchClasses();
  }, []);

  const handleLoad = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (term) params.append('term', term);
      if (session) params.append('session', session);
      if (classId) params.append('classId', classId);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/debtors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load debtors list');
      setResults(data);
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showClass = view === 'whole';
  const groups = view === 'grouped' ? groupByClass(results) : [];
  const classLabel = classes.find((c) => c._id === classId)?.name;

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <div className="p-6">
      {/* Filter form — never printed */}
      <div className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Debtors List</h2>
        <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
          Every student with an outstanding fee balance. Leave term, session and class as "All" to include every fee
          record.
        </p>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-700 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleLoad} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
              <option value="">All terms</option>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} className={inputClass}>
              <option value="">All sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>
                  {s.name} {s.isCurrent ? '(current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">View</label>
            <select value={view} onChange={(e) => setView(e.target.value)} className={inputClass}>
              <option value="grouped">Grouped by class</option>
              <option value="whole">Whole school</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Load Debtors'}
          </button>
          {loaded && (
            <button
              type="button"
              onClick={() => printArea(printRef)}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
          )}
        </form>
      </div>

      {/* Printable area — only this div is sent to the printer */}
      {loaded && (
        <div ref={printRef} className="glass-card rounded-xl p-8">
          <div className="text-center mb-6 border-b border-slate-200 dark:border-gray-700 pb-4">
            {school?.logoUrl && (
              <img src={school.logoUrl} alt={`${school.name} logo`} className="h-14 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{school?.name || 'School'}</h1>
            {school?.address && <p className="text-xs text-slate-500 dark:text-gray-400">{school.address}</p>}
            <p className="text-sm font-medium text-slate-600 dark:text-gray-300 mt-2">Debtors List</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {term || 'All terms'} — {session || 'All sessions'}
              {classLabel ? ` — ${classLabel}` : ''}
            </p>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-gray-400 text-center">
              No outstanding balances — every student is paid up.
            </p>
          ) : view === 'grouped' ? (
            groups.map((g) => (
              <section key={g.classId} className="mb-6 break-inside-avoid">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">
                  {g.className} ({countStudents(g.rows)} owing)
                </h3>
                <DebtorsTable rows={g.rows} showClass={false} footerLabel="Subtotal" />
              </section>
            ))
          ) : (
            <DebtorsTable rows={results} showClass={showClass} footerLabel={`Total (${countStudents(results)} owing)`} />
          )}

          <p className="text-xs text-slate-500 dark:text-gray-400 mt-6">Generated {new Date().toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

export default DebtorsList;
