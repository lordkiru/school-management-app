import { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';

function AuditReport({ logs, onClose }) {
  const [school, setSchool] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('${import.meta.env.VITE_API_URL}/school', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const describeSnapshot = (log) => {
    const s = log.snapshot;
    if (log.entityType === 'Fee') {
      return `Term: ${s.term || '—'}, Session: ${s.session || '—'}, Expected: ₦${(s.amountExpected || 0).toLocaleString()}, Paid: ₦${(s.amountPaid || 0).toLocaleString()}`;
    }
    return JSON.stringify(s);
  };

  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.performedAt);
    if (fromDate && logDate < new Date(fromDate)) return false;
    if (toDate && logDate > new Date(toDate + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:bg-white print:p-0 print:static">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-h-none print:max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 print:hidden">
          <h2 className="font-semibold text-slate-800">Audit Report</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              <label className="text-slate-500">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <label className="text-slate-500">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="p-1.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-8 text-slate-800">
          <div className="text-center mb-6 border-b border-slate-200 pb-4">
            {school?.logoUrl && (
              <img
                src={school.logoUrl}
                alt={`${school.name} logo`}
                className="h-14 mx-auto mb-2 object-contain"
              />
            )}
            <h1 className="text-xl font-bold">{school?.name || 'School'}</h1>
            {school?.address && <p className="text-xs text-slate-500">{school.address}</p>}
            <p className="text-sm font-medium text-slate-600 mt-2">Audit Report</p>
            <p className="text-xs text-slate-400">
              {fromDate || toDate
                ? `${fromDate || 'Start'} — ${toDate || 'Today'}`
                : 'All records'}
            </p>
            <p className="text-xs text-slate-400">Generated {new Date().toLocaleString()}</p>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left text-slate-500 font-medium">Date</th>
                <th className="py-2 text-left text-slate-500 font-medium">Action</th>
                <th className="py-2 text-left text-slate-500 font-medium">Type</th>
                <th className="py-2 text-left text-slate-500 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-400">
                    No audit records in this date range.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="border-b border-slate-100">
                    <td className="py-2 text-slate-600 align-top">
                      {new Date(log.performedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-slate-600 capitalize align-top">{log.action}</td>
                    <td className="py-2 text-slate-600 align-top">{log.entityType}</td>
                    <td className="py-2 text-slate-500 align-top">{describeSnapshot(log)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <p className="text-xs text-slate-400 mt-6">
            Total records: {filteredLogs.length}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuditReport;