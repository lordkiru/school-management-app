import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 12;

function SubjectList({ refreshKey }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load subjects');
      }

      setSubjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects, refreshKey]);

  const handleDelete = async (subjectId, subjectName) => {
    const confirmed = window.confirm(
      `Delete ${subjectName}? Any scores recorded for this subject will also be deleted. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(subjectId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subjects/${subjectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete subject');
      }

      fetchSubjects();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(subjects.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageSubjects = subjects.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="bg-amber-50 dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Subjects</h2>
        </div>

        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading subjects...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Class</th>
                    <th className="py-3 px-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                        No subjects found.
                      </td>
                    </tr>
                  ) : (
                    pageSubjects.map((subject) => (
                      <tr key={subject._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                        <td className="py-3 px-5 text-slate-800 dark:text-white">{subject.name}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{subject.classId?.name || '—'}</td>
                        <td className="py-3 px-5">
                          <button
                            onClick={() => handleDelete(subject._id, subject.name)}
                            disabled={deletingId === subject._id}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                            title="Delete subject"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {subjects.length > 0 && (
              <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
                <span className="text-slate-500 dark:text-gray-400">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, subjects.length)} of{' '}
                  {subjects.length}
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
    </div>
  );
}

export default SubjectList;