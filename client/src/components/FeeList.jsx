import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeeReceipt from './FeeReceipt';

const PAGE_SIZE = 12;

function FeeList({ refreshKey }) {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payAmount, setPayAmount] = useState({});
  const [payingId, setPayingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptFee, setReceiptFee] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [initiatingId, setInitiatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFees = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = search
        ? `${import.meta.env.VITE_API_URL}/fees?search=${encodeURIComponent(search)}`
        : `${import.meta.env.VITE_API_URL}/fees`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load fees');
      }

      setFees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees(searchTerm);
  }, [fetchFees, refreshKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchFees(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchTerm, fetchFees]);

  const handlePay = async (feeId) => {
    const amount = Number(payAmount[feeId]);
    if (!amount || amount <= 0) return;

    setPayingId(feeId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/${feeId}/pay`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      setPayAmount((prev) => ({ ...prev, [feeId]: '' }));
      fetchFees(searchTerm);
    } catch (err) {
      alert(err.message);
    } finally {
      setPayingId(null);
    }
  };

  const handleDelete = async (feeId, studentName) => {
    const confirmed = window.confirm(
      `Delete this fee record for ${studentName}? This will be logged in the audit trail. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(feeId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/${feeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete fee');

      fetchFees(searchTerm);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdjust = async (feeId) => {
    const amount = Number(editAmount);
    if (!amount || amount <= 0) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/${feeId}/adjust`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountExpected: amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust fee');

      setEditingId(null);
      fetchFees(searchTerm);
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePayOnline = async (feeId) => {
    setInitiatingId(feeId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/${feeId}/initiate-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');

      window.open(data.authorizationUrl, '_blank');
    } catch (err) {
      alert(err.message);
    } finally {
      setInitiatingId(null);
    }
  };

  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(fees.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageFees = fees.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Fees</h2>
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm w-64 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>

        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading fees...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Student</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Term</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Expected</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Paid</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Balance</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Status</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Record Payment</th>
                    <th className="py-3 px-5"></th>
                    <th className="py-3 px-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageFees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                        No fee records found.
                      </td>
                    </tr>
                  ) : (
                    pageFees.map((fee) => (
                      <tr key={fee._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                        <td className="py-3 px-5 text-slate-800 dark:text-white">{fee.studentId?.name || '—'}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{fee.term}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                          {editingId === fee._id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                className="w-24 p-1 rounded border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                autoFocus
                              />
                              <button
                                onClick={() => handleAdjust(fee._id)}
                                className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(fee._id);
                                setEditAmount(fee.amountExpected);
                              }}
                              className="hover:underline decoration-dotted"
                              title="Click to adjust"
                            >
                              ₦{fee.amountExpected.toLocaleString()}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                          ₦{fee.amountPaid.toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                          ₦{fee.balance.toLocaleString()}
                        </td>
                        <td className="py-3 px-5">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              fee.status === 'Fully Paid'
                                ? 'bg-emerald-50 dark:bg-green-900 text-emerald-700 dark:text-green-200'
                                : fee.status === 'Partly Paid'
                                ? 'bg-amber-100 dark:bg-yellow-900 text-amber-700 dark:text-yellow-200'
                                : 'bg-rose-50 dark:bg-red-900 text-rose-700 dark:text-red-200'
                            }`}
                          >
                            {fee.status}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          {fee.status === 'Fully Paid' ? (
                            <span className="text-slate-400 text-sm">—</span>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Amount"
                                value={payAmount[fee._id] || ''}
                                onChange={(e) =>
                                  setPayAmount((prev) => ({ ...prev, [fee._id]: e.target.value }))
                                }
                                className="w-24 p-1 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                              />
                              <button
                                onClick={() => handlePay(fee._id)}
                                disabled={payingId === fee._id}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm px-3 py-1 rounded-lg transition"
                              >
                                {payingId === fee._id ? '...' : 'Pay'}
                              </button>
                              <button
                                onClick={() => handlePayOnline(fee._id)}
                                disabled={initiatingId === fee._id}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm px-3 py-1 rounded-lg transition"
                              >
                                {initiatingId === fee._id ? '...' : 'Pay Online'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <button
                            onClick={() => setReceiptFee(fee)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium transition"
                          >
                            Receipt
                          </button>
                        </td>
                        <td className="py-3 px-5">
                          <button
                            onClick={() => handleDelete(fee._id, fee.studentId?.name || 'this student')}
                            disabled={deletingId === fee._id}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-50 text-sm transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {fees.length > 0 && (
              <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
                <span className="text-slate-500 dark:text-gray-400">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, fees.length)} of{' '}
                  {fees.length}
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
          </>
        )}
      </div>

      <FeeReceipt fee={receiptFee} onClose={() => setReceiptFee(null)} />
    </div>
  );
}

export default FeeList;