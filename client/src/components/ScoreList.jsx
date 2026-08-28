import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Check, X } from 'lucide-react';

const PAGE_SIZE = 12;

function ScoreList({ refreshKey }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ ca1: 0, ca2: 0, exam: 0 });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/scores`, {
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

  const startEdit = (score) => {
    setEditingId(score._id);
    setEditValues({ ca1: score.ca1, ca2: score.ca2, exam: score.exam });
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError('');
  };

  const saveEdit = async (scoreId) => {
    const { ca1, ca2, exam } = editValues;
    // Same 0-100 range the backend enforces on create, checked here too for a faster error
    for (const [label, val] of [['CA1', ca1], ['CA2', ca2], ['Exam', exam]]) {
      const num = Number(val);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        setEditError(`${label} must be a number between 0 and 100`);
        return;
      }
    }

    setSaving(true);
    setEditError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/scores/${scoreId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ca1: Number(ca1), ca2: Number(ca2), exam: Number(exam) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update score');

      setEditingId(null);
      fetchScores(); // refetch so total/grade recompute server-side
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6">Loading scores...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(scores.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageScores = scores.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Scores</h2>
      {editError && (
        <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded mb-3">
          {editError}
        </div>
      )}
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
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {pageScores.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-gray-500 dark:text-gray-400">
                  No scores found.
                </td>
              </tr>
            ) : (
              pageScores.map((score) => {
                const isEditing = editingId === score._id;
                return (
                  <tr key={score._id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-4">{score.studentId?.name || '—'}</td>
                    <td className="py-2 pr-4">{score.subjectId?.name || '—'}</td>
                    <td className="py-2 pr-4">{score.term}</td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editValues.ca1}
                          onChange={(e) => setEditValues((v) => ({ ...v, ca1: e.target.value }))}
                          className="w-16 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                      ) : (
                        score.ca1
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editValues.ca2}
                          onChange={(e) => setEditValues((v) => ({ ...v, ca2: e.target.value }))}
                          className="w-16 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                      ) : (
                        score.ca2
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editValues.exam}
                          onChange={(e) => setEditValues((v) => ({ ...v, exam: e.target.value }))}
                          className="w-16 p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                      ) : (
                        score.exam
                      )}
                    </td>
                    <td className="py-2 pr-4 font-semibold">{score.total}</td>
                    <td className="py-2 pr-4">{score.grade}</td>
                    <td className="py-2 pr-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(score._id)}
                            disabled={saving}
                            className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(score)}
                          className="text-indigo-500 hover:text-indigo-700"
                          title="Edit this score"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
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