import { useState, useEffect } from 'react';
import { ArrowLeft, KeyRound, Copy, Check } from 'lucide-react';

function StudentDetail({ studentId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pinResult, setPinResult] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/students/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || 'Failed to load student');
        }

        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [studentId]);

  const handleGeneratePin = async () => {
    setPinLoading(true);
    setPinError('');
    setPinResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/students/${studentId}/generate-pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate PIN');
      setPinResult(result);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const loginUrl = `${window.location.origin}/cbt-login?tenantId=${data.student.tenantId}`;
    try {
      await navigator.clipboard.writeText(loginUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Clipboard API can fail in some contexts (e.g. non-HTTPS) — fall back to a prompt
      // the user can manually copy from, rather than silently doing nothing.
      window.prompt('Copy this link:', loginUrl);
    }
  };

  if (loading) return <p className="p-6">Loading student profile...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return null;

  const { student, scores, fees } = data;
  const formatDate = (value) => (value
    ? new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '—');
  const detailItems = [
    ['Full name', student.name],
    ['Admission number', student.admissionNumber],
    ['Class', student.classId?.name || student.className || '—'],
    ['Date of birth', formatDate(student.dateOfBirth)],
    ['Gender', student.gender || '—'],
    ['Status', student.status || '—'],
    ['Wallet balance', `₦${Number(student.walletBalance || 0).toLocaleString()}`],
    ['CBT login', student.cbtLoginConfigured ? 'Configured' : 'Not configured'],
  ];

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm mb-6 text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ArrowLeft size={16} /> Back to students
      </button>

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-6">
        <h2 className="text-2xl font-bold mb-1">{student.name}</h2>
        <p className="text-gray-600 dark:text-gray-300">
          {student.classId?.name || student.className || '—'} · {student.admissionNumber}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4">Student details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {detailItems.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <KeyRound size={18} /> CBT Login
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Generate or reset this student's PIN so they can log in and take a CBT test.
          The PIN is shown once — print or share it with the student right away.
        </p>

        {pinError && (
          <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">{pinError}</p>
        )}

        {pinResult && (
          <div className="bg-emerald-50 dark:bg-green-900/40 border border-emerald-200 dark:border-green-800 rounded-lg p-4 mb-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              New PIN for <strong>{pinResult.name}</strong> ({pinResult.admissionNumber}):
            </p>
            <p className="text-2xl font-mono font-bold text-emerald-800 dark:text-emerald-200 tracking-widest mt-1">
              {pinResult.pin}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              This won't be shown again — write it down now.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGeneratePin}
            disabled={pinLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
          >
            {pinLoading ? 'Generating...' : pinResult ? 'Generate new PIN' : 'Generate CBT PIN'}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            {linkCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
            {linkCopied ? 'Copied!' : 'Copy test link'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Scores</h3>
        {scores.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No scores recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-600">
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Term</th>
                  <th className="py-2 pr-4">CA1</th>
                  <th className="py-2 pr-4">CA2</th>
                  <th className="py-2 pr-4">Exam</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Grade</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => (
                  <tr key={score._id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-4">{score.subjectId?.name || '—'}</td>
                    <td className="py-2 pr-4">{score.term}</td>
                    <td className="py-2 pr-4">{score.ca1}</td>
                    <td className="py-2 pr-4">{score.ca2}</td>
                    <td className="py-2 pr-4">{score.exam}</td>
                    <td className="py-2 pr-4 font-semibold">{score.total}</td>
                    <td className="py-2 pr-4">{score.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Fees</h3>
        {fees.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No fee records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-600">
                  <th className="py-2 pr-4">Term</th>
                  <th className="py-2 pr-4">Expected</th>
                  <th className="py-2 pr-4">Paid</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee._id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-4">{fee.term}</td>
                    <td className="py-2 pr-4">₦{fee.amountExpected.toLocaleString()}</td>
                    <td className="py-2 pr-4">₦{fee.amountPaid.toLocaleString()}</td>
                    <td className="py-2 pr-4">₦{fee.balance.toLocaleString()}</td>
                    <td className="py-2 pr-4">{fee.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDetail;
