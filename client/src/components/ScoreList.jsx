import { useState, useEffect, useCallback } from 'react';

function ScoreList({ refreshKey }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/scores', {
        headers: { Authorization: `Bearer ${token}` },
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
            {scores.map((score) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScoreList;