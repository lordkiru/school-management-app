import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
const PAGE_SIZE = 12;

function StudentList({ refreshKey, onSelectStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStudents = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = search
        ? `${import.meta.env.VITE_API_URL}/students?search=${encodeURIComponent(search)}`
        : `${import.meta.env.VITE_API_URL}/students`;
      const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
});
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load students');
      }

      setStudents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents(searchTerm);
  }, [fetchStudents, refreshKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStudents(searchTerm);
      setCurrentPage(1); // reset to page 1 whenever the search term changes
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchTerm, fetchStudents]);

  const handleDelete = async (e, studentId, studentName) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete ${studentName}? This will also delete all their scores and fee records. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(studentId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/students/${studentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete student');
      }

      fetchStudents(searchTerm);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  const totalPages = Math.ceil(students.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageStudents = students.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Students</h2>
        <input
          type="text"
          placeholder="Search by name or admission no."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm w-64"
        />
      </div>

      {loading ? (
        <p>Loading students...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 dark:border-gray-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Class</th>
                  <th className="py-2 pr-4">Admission No.</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {pageStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-gray-500 dark:text-gray-400">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  pageStudents.map((student) => (
                    <tr
                      key={student._id}
                      onClick={() => onSelectStudent(student._id)}
                      className="border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <td className="py-2 pr-4">{student.name}</td>
                      <td className="py-2 pr-4">{student.classId?.name || student.className || '—'}</td>
                      <td className="py-2 pr-4">{student.admissionNumber}</td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={(e) => handleDelete(e, student._id, student.name)}
                          disabled={deletingId === student._id}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                          title="Delete student"
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

          {students.length > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, students.length)} of{' '}
                {students.length}
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
        </>
      )}
    </div>
  );
}

export default StudentList;