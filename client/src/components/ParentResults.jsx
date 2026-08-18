import { useState } from 'react';
import { Search, Printer, ArrowLeft } from 'lucide-react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function ParentResults() {
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [termFilter, setTermFilter] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/students/public/results/${admissionNumber}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredScores = result
    ? result.scores.filter((s) => !termFilter || s.term === termFilter)
    : [];

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4 print:bg-white print:p-0">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-slate-100 p-8 print:shadow-none print:border-0">
        <div className="print:hidden">
          <div className="flex items-center justify-between mb-4">
            <a
              href="/portal"
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </a>
            <a href="/pay" className="text-sm text-indigo-600 hover:underline">
              Pay fees instead →
            </a>
          </div>

          <h1 className="text-xl font-bold text-slate-800 text-center mb-1">Student Results</h1>
          <p className="text-sm text-slate-500 text-center mb-4">
            Enter your child's admission number to view their results.
          </p>

          <form onSubmit={handleLookup} className="flex gap-2 mb-4">
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

          {error && (
            <div className="bg-rose-50 text-rose-600 text-sm p-3 rounded-lg mb-4">{error}</div>
          )}
        </div>

        {result && (
          <div>
            <div className="flex items-center justify-between mb-4 print:hidden">
              <select
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)}
                className="p-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="">All terms</option>
                {TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
              >
                <Printer size={16} /> Print / Save as PDF
              </button>
            </div>

            <div className="text-center mb-6 border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-800">{result.student.name}</h2>
              <p className="text-sm text-slate-500">
                {result.student.className} — {result.student.admissionNumber}
              </p>
            </div>

            {filteredScores.length === 0 ? (
              <p className="text-sm text-slate-400 text-center">No results found for this selection.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-slate-500 font-medium">Subject</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Term</th>
                    <th className="py-2 text-left text-slate-500 font-medium">CA1</th>
                    <th className="py-2 text-left text-slate-500 font-medium">CA2</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Exam</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Total</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScores.map((score) => (
                    <tr key={score._id} className="border-b border-slate-100">
                      <td className="py-2 text-slate-800">{score.subjectId?.name || '—'}</td>
                      <td className="py-2 text-slate-600">{score.term}</td>
                      <td className="py-2 text-slate-600">{score.ca1}</td>
                      <td className="py-2 text-slate-600">{score.ca2}</td>
                      <td className="py-2 text-slate-600">{score.exam}</td>
                      <td className="py-2 font-semibold text-slate-800">{score.total}</td>
                      <td className="py-2 text-slate-800">{score.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentResults;