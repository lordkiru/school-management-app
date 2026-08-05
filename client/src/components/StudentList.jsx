import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 16;

function StudentList({ refreshKey, onSelectStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('');

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
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClasses(await res.json());
      } catch (err) {
        console.error('Failed to load classes', err);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchStudents(searchTerm);
  }, [fetchStudents, refreshKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStudents(searchTerm);
      setCurrentPage(1);
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

  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const filteredStudents = classFilter
    ? students.filter((s) => (s.classId?._id || s.classId) === classFilter)
    : students;

  const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageStudents = filteredStudents.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-gray-700 gap-3">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Students</h2>
          <div className="flex items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm"
            >
              <option value="">All classes</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search by name or admission no."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm w-64 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
            />
          </div>
        </div>

        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading students...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Class</th>
                    <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Admission No.</th>
                    <th className="py-3 px-5"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 px-5 text-slate-500 dark:text-gray-400">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    pageStudents.map((student) => (
                      <tr
                        key={student._id}
                        onClick={() => onSelectStudent(student._id)}
                        className="border-b border-slate-50 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-amber-50/60 dark:hover:bg-gray-700 transition"
                      >
                        <td className="py-3 px-5 text-slate-800 dark:text-white">{student.name}</td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">
                          {student.classId?.name || student.className || '—'}
                        </td>
                        <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{student.admissionNumber}</td>
                        <td className="py-3 px-5">
                          <button
                            onClick={(e) => handleDelete(e, student._id, student.name)}
                            disabled={deletingId === student._id}
                            className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
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

            {filteredStudents.length > 0 && (
              <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
                <span className="text-slate-500 dark:text-gray-400">
                  Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filteredStudents.length)} of{' '}
                  {filteredStudents.length}
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

export default StudentList;