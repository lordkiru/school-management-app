import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import AuditReport from './AuditReport';

const PAGE_SIZE = 12;

function AuditLogList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [showReport, setShowReport] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('https://school-saas-backend-v8i3.onrender.com/auditlog', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load audit log');
      }

      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const describeLog = (log) => {
    const s = log.snapshot;
    if (log.entityType === 'Fee') {
      const studentName = s.studentId?.name || 'Unknown student';
      return `${studentName} — ${s.term || ''} ${s.session || ''} — Expected ₦${(s.amountExpected || 0).toLocaleString()}, Paid ₦${(s.amountPaid || 0).toLocaleString()}`;
    }
    return `${log.entityType} record`;
  };

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading audit log...</p>;
  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(logs.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageLogs = logs.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-1">
              A record of deleted items, kept for reference even after removal.
            </p>
          </div>
          <button
            onClick={() => setShowReport(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
          >
            Generate Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-gray-700">
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Action</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Type</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Details</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Performed By</th>
                <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Date</th>
                <th className="py-3 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {pageLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                    No audit records yet.
                  </td>
                </tr>
              ) : (
                pageLogs.map((log) => (
                  <>
                    <tr
                      key={log._id}
                      onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                      className="border-b border-slate-50 dark:border-gray-700 cursor-pointer hover:bg-amber-50/60 dark:hover:bg-gray-700 transition"
                    >
                      <td className="py-3 px-5 text-slate-800 dark:text-white capitalize">{log.action}</td>
                      <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{log.entityType}</td>
                      <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{describeLog(log)}</td>
                      <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{log.performedBy || '—'}</td>
                      <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                        {new Date(log.performedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-slate-400">
                        {expandedId === log._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expandedId === log._id && (
                      <tr className="bg-amber-50/40 dark:bg-gray-900/40">
                        <td colSpan={6} className="px-5 py-3">
                          <pre className="text-xs text-slate-600 dark:text-gray-300 whitespace-pre-wrap break-all">
                            {JSON.stringify(log.snapshot, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && (
          <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
            <span className="text-slate-500 dark:text-gray-400">
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, logs.length)} of {logs.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-slate-500 dark:text-gray-400 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-gray-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-gray-700 transition"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showReport && <AuditReport logs={logs} onClose={() => setShowReport(false)} />}
    </div>
  );
}

export default AuditLogList;