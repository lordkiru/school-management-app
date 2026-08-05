import { useState, useEffect } from 'react';
import { Printer } from 'lucide-react';

function FeeReportByClass() {
  const [school, setSchool] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [term, setTerm] = useState('');
  const [session, setSession] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const TERMS = ['First Term', 'Second Term', 'Third Term'];

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();

    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSessions(await res.json());
      } catch (err) {
        console.error('Failed to load sessions', err);
      }
    };
    fetchSessions();
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

      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/report-by-class?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');
      setResults(data);
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totals = results.reduce(
    (acc, r) => ({
      totalExpected: acc.totalExpected + r.totalExpected,
      totalPaid: acc.totalPaid + r.totalPaid,
      totalOutstanding: acc.totalOutstanding + r.totalOutstanding,
      studentCount: acc.studentCount + r.studentCount,
    }),
    { totalExpected: 0, totalPaid: 0, totalOutstanding: 0, studentCount: 0 }
  );

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6 print:hidden">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Fee Report by Class</h2>
        <p className="text-xs text-slate-400 mb-4">
          Leave term/session as "All" to include every fee record.
        </p>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
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
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Load Report'}
          </button>
          {loaded && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
          )}
        </form>
      </div>

      {loaded && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-8 print:shadow-none print:border-0">
          <div className="text-center mb-6 border-b border-slate-200 dark:border-gray-700 pb-4">
            {school?.logoUrl && (
              <img src={school.logoUrl} alt={`${school.name} logo`} className="h-14 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{school?.name || 'School'}</h1>
            {school?.address && <p className="text-xs text-slate-500">{school.address}</p>}
            <p className="text-sm font-medium text-slate-600 dark:text-gray-300 mt-2">Fee Report by Class</p>
            <p className="text-xs text-slate-400">
              {term || session ? `${term || 'All terms'} — ${session || 'All sessions'}` : 'All records'}
            </p>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-slate-400 text-center">No fee records found.</p>
          ) : (
            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-700">
                  <th className="py-2 text-left text-slate-500 dark:text-gray-400 font-medium">Class</th>
                  <th className="py-2 text-left text-slate-500 dark:text-gray-400 font-medium">Students</th>
                  <th className="py-2 text-left text-slate-500 dark:text-gray-400 font-medium">Expected</th>
                  <th className="py-2 text-left text-slate-500 dark:text-gray-400 font-medium">Paid</th>
                  <th className="py-2 text-left text-slate-500 dark:text-gray-400 font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.classId} className="border-b border-slate-100 dark:border-gray-700">
                    <td className="py-2 font-medium text-slate-800 dark:text-white">{r.className}</td>
                    <td className="py-2 text-slate-600 dark:text-gray-300">{r.studentCount}</td>
                    <td className="py-2 text-slate-600 dark:text-gray-300">₦{r.totalExpected.toLocaleString()}</td>
                    <td className="py-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      ₦{r.totalPaid.toLocaleString()}
                    </td>
                    <td className="py-2 text-rose-600 dark:text-rose-400 font-medium">
                      ₦{r.totalOutstanding.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-gray-600 font-semibold">
                  <td className="py-2 text-slate-800 dark:text-white">Total</td>
                  <td className="py-2 text-slate-800 dark:text-white">{totals.studentCount}</td>
                  <td className="py-2 text-slate-800 dark:text-white">₦{totals.totalExpected.toLocaleString()}</td>
                  <td className="py-2 text-emerald-700 dark:text-emerald-400">
                    ₦{totals.totalPaid.toLocaleString()}
                  </td>
                  <td className="py-2 text-rose-700 dark:text-rose-400">
                    ₦{totals.totalOutstanding.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          <p className="text-xs text-slate-400 mt-6">Generated {new Date().toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

export default FeeReportByClass;