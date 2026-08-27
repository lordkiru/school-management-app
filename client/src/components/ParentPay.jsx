import { useState, useEffect } from 'react';
import { Search, ArrowLeft } from 'lucide-react';

// Get tenantId from the logged-in parent's stored session, or fall back to URL param
function getParentTenantId() {
  try {
    const urlParam = new URLSearchParams(window.location.search).get('tenantId');
    if (urlParam) return urlParam;
    const saved = localStorage.getItem('parent');
    if (saved) {
      const parent = JSON.parse(saved);
      return parent.tenantId || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function ParentPay() {
  const tenantId = getParentTenantId();
  const urlParams = new URLSearchParams(window.location.search);
  const urlAdmissionNumber = urlParams.get('admissionNumber') || '';
  const urlStudentName = urlParams.get('studentName') || '';
  const isAutofilled = !!urlAdmissionNumber;

  const [admissionNumber, setAdmissionNumber] = useState(urlAdmissionNumber);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);

  const fetchFees = async (admNum) => {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/public/lookup/${admNum}?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlAdmissionNumber && tenantId) {
      const timer = setTimeout(() => {
        fetchFees(urlAdmissionNumber);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Guard: if no tenantId, the parent hasn't come through a school portal link
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800 mb-3">School not identified</h1>
          <p className="text-sm text-slate-500 mb-6">
            Please sign in through your school's portal link first. Ask your school admin for the correct link.
          </p>
          <a
            href="/portal"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
          >
            Go to Parent Portal
          </a>
        </div>
      </div>
    );
  }

  const handleLookup = async (e) => {
    e.preventDefault();
    await fetchFees(admissionNumber);
  };

  const handlePay = async (feeId) => {
    setPayingId(feeId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/fees/public/${feeId}/initiate-payment`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');
      window.location.href = data.authorizationUrl;
    } catch (err) {
      alert(err.message);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center justify-between mb-4">
          <a
            href="/portal"
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </a>
          <a href="/results" className="text-sm text-indigo-600 hover:underline">
            View results →
          </a>
        </div>

        <h1 className="text-xl font-bold text-slate-800 text-center mb-1">
          {isAutofilled && urlStudentName ? `${urlStudentName}'s Fees` : 'School Fee Payment'}
        </h1>
        {isAutofilled && !error ? (
          loading && (
            <p className="text-sm text-slate-500 text-center mb-4">
              Loading fees for {urlStudentName}...
            </p>
          )
        ) : (
          <>
            <p className="text-sm text-slate-500 text-center mb-4">
              Enter your child's admission number to view and pay outstanding fees.
            </p>

            <form onSubmit={handleLookup} className="flex gap-2 mb-6">
              <input
                type="text"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="e.g. SEC0001"
                required
                className="flex-1 p-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 rounded-lg transition"
              >
                <Search size={18} />
              </button>
            </form>
          </>
        )}

        {error && (
          <div className="bg-rose-50 text-rose-600 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        {result && (
          <div>
            <p className="font-semibold text-slate-800 mb-1">{result.studentName}</p>
            <p className="text-xs text-slate-400 mb-4">{result.admissionNumber}</p>

            {result.outstandingFees.length === 0 ? (
              <p className="text-sm text-emerald-600">No outstanding fees. 🎉</p>
            ) : (
              <div className="space-y-3">
                {result.outstandingFees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {fee.term} — {fee.session}
                      </p>
                      <p className="text-xs text-slate-500">
                        Balance: ₦{fee.balance.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePay(fee.id)}
                      disabled={payingId === fee.id}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm px-3 py-1.5 rounded-lg transition"
                    >
                      {payingId === fee.id ? '...' : 'Pay Now'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentPay;