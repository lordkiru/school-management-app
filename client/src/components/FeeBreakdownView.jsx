import { useState, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import printArea from '../utils/printArea';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function FeeBreakdownView() {
  const [sessions, setSessions] = useState([]);
  const [school, setSchool] = useState(null);
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const printRef = useRef(null);

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition';

  useEffect(() => {
    const token = localStorage.getItem('token');

    const fetchSessions = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSessions(data);
        const current = data.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) { console.error(err); }
    };

    const fetchSchool = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSchool(await res.json());
      } catch (err) { console.error(err); }
    };

    fetchSessions();
    fetchSchool();
  }, []);

  const handleLoad = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLoaded(false);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (term) params.append('term', term);
      if (session) params.append('session', session);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/fee-structure?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load fee structures');

      // Sort by class name
      data.sort((a, b) => (a.classId?.name || '').localeCompare(b.classId?.name || ''));
      setStructures(data);
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = structures.reduce((sum, s) => {
    return sum + s.items.reduce((iSum, item) => iSum + item.amount, 0);
  }, 0);

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Fee Breakdown</h2>
        <p className="text-xs text-slate-400 mb-4">
          View the fee structure breakdown for all classes for a given term and session.
        </p>

        {error && (
          <div className="mb-3 p-2 bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm rounded-lg">{error}</div>
        )}

        <form onSubmit={handleLoad} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputClass}>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Session</label>
            <select value={session} onChange={(e) => setSession(e.target.value)} className={inputClass}>
              <option value="">All sessions</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>{s.name} {s.isCurrent ? '(current)' : ''}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'View Breakdown'}
          </button>
          {loaded && structures.length > 0 && (
            <button
              type="button"
              onClick={() => printArea(printRef)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              <Printer size={16} /> Print Breakdown
            </button>
          )}
        </form>
      </div>

      {/* Printable breakdown */}
      {loaded && (
        <div ref={printRef} className="space-y-4">
          {/* Print-only header */}
          <div className="screen-hidden hidden" style={{ textAlign: 'center', paddingBottom: 16, marginBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
            {school?.logoUrl && (
              <img src={school.logoUrl} alt="" style={{ height: 52, margin: '0 auto 8px' }} />
            )}
            <div style={{ fontWeight: 700, fontSize: 20 }}>{school?.name || 'School'}</div>
            {school?.address && <div style={{ fontSize: 12, color: '#64748b' }}>{school.address}</div>}
            <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600 }}>
              Fee Breakdown — {term}{session ? ` · ${session}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Generated {new Date().toLocaleString()}
            </div>
          </div>

          {structures.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-100 dark:border-gray-700 p-8 text-center text-slate-400">
              No fee structures found for {term}{session ? `, ${session}` : ''}. 
              <br />
              <span className="text-xs mt-1 block">Set up fee structures using the "Fee Setup" page.</span>
            </div>
          ) : (
            <>
              {structures.map((structure) => {
                const classTotal = structure.items.reduce((sum, item) => sum + item.amount, 0);
                return (
                  <div
                    key={structure._id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden"
                  >
                    {/* Class header */}
                    <div className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-indigo-800 dark:text-indigo-200 text-sm">
                          {structure.classId?.name || 'Unknown Class'}
                        </span>
                        {structure.classId?.section && (
                          <span className="ml-2 text-xs text-indigo-500 dark:text-indigo-400">
                            ({structure.classId.section})
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                        Total: ₦{classTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Fee items table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-gray-700">
                            <th className="py-2 px-5 text-left text-slate-500 dark:text-gray-400 font-medium">Fee Item</th>
                            <th className="py-2 px-5 text-right text-slate-500 dark:text-gray-400 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {structure.items.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="py-3 px-5 text-slate-400 dark:text-gray-500 text-xs">
                                No items defined for this class.
                              </td>
                            </tr>
                          ) : (
                            structure.items.map((item) => (
                              <tr key={item._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                                <td className="py-2 px-5 text-slate-700 dark:text-gray-300">{item.name}</td>
                                <td className="py-2 px-5 text-right text-slate-600 dark:text-gray-300">
                                  ₦{item.amount.toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 dark:border-gray-600 bg-slate-50 dark:bg-gray-700/30">
                            <td className="py-2 px-5 font-semibold text-slate-700 dark:text-gray-200">Subtotal</td>
                            <td className="py-2 px-5 text-right font-bold text-slate-800 dark:text-white">
                              ₦{classTotal.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              <div className="bg-indigo-600 dark:bg-indigo-700 rounded-xl px-5 py-4 flex items-center justify-between text-white">
                <span className="font-semibold">Grand Total across all classes</span>
                <span className="text-xl font-bold">₦{grandTotal.toLocaleString()}</span>
              </div>

              <p className="text-xs text-slate-400 text-right">
                Generated {new Date().toLocaleString()} · {structures.length} class{structures.length !== 1 ? 'es' : ''}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FeeBreakdownView;
