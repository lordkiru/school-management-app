import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

function StudentDetail({ studentId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`https://school-saas-backend-v8i3.onrender.com/students/${studentId}`, {
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

  if (loading) return <p className="p-6">Loading student profile...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;
  if (!data) return null;

  const { student, scores, fees } = data;

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