import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 12;

function ScoreList({ refreshKey }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('${import.meta.env.VITE_API_URL}/scores', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load scores');
      }

      setScores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores, refreshKey]);

  if (loading) return <p className="p-6">Loading scores...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(scores.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageScores = scores.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Scores</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="py-2 pr-4">Student</th>
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
            {pageScores.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-gray-500 dark:text-gray-400">
                  No scores found.
                </td>
              </tr>
            ) : (
              pageScores.map((score) => (
                <tr key={score._id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2 pr-4">{score.studentId?.name || '—'}</td>
                  <td className="py-2 pr-4">{score.subjectId?.name || '—'}</td>
                  <td className="py-2 pr-4">{score.term}</td>
                  <td className="py-2 pr-4">{score.ca1}</td>
                  <td className="py-2 pr-4">{score.ca2}</td>
                  <td className="py-2 pr-4">{score.exam}</td>
                  <td className="py-2 pr-4 font-semibold">{score.total}</td>
                  <td className="py-2 pr-4">{score.grade}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {scores.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, scores.length)} of{' '}
            {scores.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="text-gray-500 dark:text-gray-400 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoreList;