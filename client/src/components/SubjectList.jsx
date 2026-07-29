import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

function SubjectList({ refreshKey }) {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/subjects', {
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
      `Delete ${subjectName}? Any scores already recorded for this subject will still reference it but may show as missing. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(subjectId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/subjects/${subjectId}`, {
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

  if (loading) return <p className="p-6">Loading subjects...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Subjects</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Class</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-gray-500 dark:text-gray-400">
                  No subjects found.
                </td>
              </tr>
            ) : (
              subjects.map((subject) => (
                <tr key={subject._id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2 pr-4">{subject.name}</td>
                  <td className="py-2 pr-4">{subject.classId?.name || '—'}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleDelete(subject._id, subject.name)}
                      disabled={deletingId === subject._id}
                      className="text-red-500 hover:text-red-700 disabled:opacity-50 transition"
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
    </div>
  );
}

export default SubjectList;