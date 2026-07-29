import { useState, useEffect, useCallback } from 'react';

function FeeList({ refreshKey }) {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payAmount, setPayAmount] = useState({});
  const [payingId, setPayingId] = useState(null);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/fees', {
        headers: { Authorization: `Bearer ${token}` },
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
    fetchFees();
  }, [fetchFees, refreshKey]);

  const handlePay = async (feeId) => {
    const amount = Number(payAmount[feeId]);
    if (!amount || amount <= 0) return;

    setPayingId(feeId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/fees/${feeId}/pay`, {
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
      fetchFees();
    } catch (err) {
      alert(err.message);
    } finally {
      setPayingId(null);
    }
  };

  if (loading) return <p className="p-6">Loading fees...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Fees</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="py-2 pr-4">Student</th>
              <th className="py-2 pr-4">Term</th>
              <th className="py-2 pr-4">Expected</th>
              <th className="py-2 pr-4">Paid</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Record Payment</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee._id} className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-2 pr-4">{fee.studentId?.name || '—'}</td>
                <td className="py-2 pr-4">{fee.term}</td>
                <td className="py-2 pr-4">₦{fee.amountExpected.toLocaleString()}</td>
                <td className="py-2 pr-4">₦{fee.amountPaid.toLocaleString()}</td>
                <td className="py-2 pr-4">₦{fee.balance.toLocaleString()}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      fee.status === 'Fully Paid'
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                        : fee.status === 'Partly Paid'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                    }`}
                  >
                    {fee.status}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  {fee.status === 'Fully Paid' ? (
                    <span className="text-gray-400 text-sm">—</span>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={payAmount[fee._id] || ''}
                        onChange={(e) =>
                          setPayAmount((prev) => ({ ...prev, [fee._id]: e.target.value }))
                        }
                        className="w-24 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                      />
                      <button
                        onClick={() => handlePay(fee._id)}
                        disabled={payingId === fee._id}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm px-3 py-1 rounded transition"
                      >
                        {payingId === fee._id ? '...' : 'Pay'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FeeList;