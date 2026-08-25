import { useState, useEffect, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import printArea from '../utils/printArea';

function FeeReceipt({ fee, onClose }) {
  const [school, setSchool] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (!fee) return;
    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();
  }, [fee]);

  if (!fee) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Modal header — never printed */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Fee Receipt</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => printArea(printRef)}
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

        {/* Printable area — only this div is sent to the printer */}
        <div ref={printRef} className="p-8 text-slate-800">
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
            <p className="text-sm font-medium text-slate-600 mt-2">Fee Receipt</p>
            <p className="text-sm text-slate-500">
              {fee.term} — {fee.session}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-sm mb-6">
            <span className="text-slate-500">Student Name</span>
            <span className="font-medium text-right">{fee.studentId?.name || '—'}</span>

            <span className="text-slate-500">Admission Number</span>
            <span className="font-medium text-right">{fee.studentId?.admissionNumber || '—'}</span>

            <span className="text-slate-500">Class</span>
            <span className="font-medium text-right">
              {fee.studentId?.classId?.name || fee.studentId?.className || '—'}
            </span>

            <span className="text-slate-500">Term / Session</span>
            <span className="font-medium text-right">
              {fee.term} — {fee.session}
            </span>
          </div>

          <table className="w-full text-sm border-collapse mb-6">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-500">Amount Expected</td>
                <td className="py-2 text-right font-medium">
                  ₦{fee.amountExpected.toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-500">Amount Paid</td>
                <td className="py-2 text-right font-medium text-emerald-600">
                  ₦{fee.amountPaid.toLocaleString()}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-500">Balance</td>
                <td className="py-2 text-right font-medium text-rose-600">
                  ₦{fee.balance.toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Status</td>
                <td className="py-2 text-right font-semibold">{fee.status}</td>
              </tr>
              {fee.studentId?.walletBalance > 0 && (
                <tr className="border-t border-slate-100">
                  <td className="py-2 text-slate-500">Wallet Credit (from prior overpayment)</td>
                  <td className="py-2 text-right font-medium text-sky-600">
                    ₦{fee.studentId.walletBalance.toLocaleString()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {fee.payments?.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Payment History</p>
              <table className="w-full text-xs">
                <tbody>
                  {fee.payments.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-500">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 text-slate-500">{p.paymentMethod}</td>
                      <td className="py-1.5 text-right font-medium">₦{p.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-end mt-10 pt-6 border-t border-slate-200 text-xs text-slate-400">
            <div>
              <p>Issued: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className="border-t border-slate-400 w-32 mb-1"></div>
              <p>Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeeReceipt;