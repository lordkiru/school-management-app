import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 12;

function ClassList({ refreshKey }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/classes', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load classes');
      }

      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses, refreshKey]);

  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(classes.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageClasses = classes.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="bg-amber-50 dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Classes</h2>
        </div>

        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading classes...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Level</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {pageClasses.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                        No classes found.
                      </td>
                    </tr>
                  ) : (
                    pageClasses.map((cls) => (
                      <tr key={cls._id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                        <td className="py-3 px-5 text-slate-800 dark:text-white">{cls.name}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{cls.level}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{cls.section || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {classes.length > 0 && (
              <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
                <span className="text-slate-500 dark:text-gray-400">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, classes.length)} of{' '}
                  {classes.length}
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

export default ClassList;