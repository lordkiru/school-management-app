import { useState, useEffect } from 'react';
import { Search, UserPlus, Trash2 } from 'lucide-react';

function ParentList({ refreshKey }) {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [linkingParentId, setLinkingParentId] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    fetchParents();
  }, [refreshKey]);

  const fetchParents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load parents');

      setParents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchStudents = async (query) => {
    if (!query || query.length < 2) {
      setStudents([]);
      return;
    }

    setSearchingStudents(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/students?search=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search students');

      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const linkChild = async (parentId, studentId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents/${parentId}/link-child`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link child');

      alert('Child linked successfully!');
      setLinkingParentId(null);
      setStudentSearch('');
      setStudents([]);
      fetchParents();
    } catch (err) {
      alert(err.message);
    }
  };

  const unlinkChild = async (parentId, studentId) => {
    if (!confirm('Remove this child from parent account?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents/${parentId}/unlink-child`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink child');

      fetchParents();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteParent = async (parentId, parentName) => {
    if (!confirm(`Delete parent account for ${parentName}? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/parents/${parentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete parent');

      fetchParents();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredParents = parents.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p className="p-6 text-slate-500 dark:text-gray-400">Loading parents...</p>;
  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3">Parents</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search parents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
        {filteredParents.length === 0 ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">No parents found.</p>
        ) : (
          filteredParents.map((parent) => (
            <div key={parent._id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{parent.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400">{parent.email}</p>
                  {parent.phone && (
                    <p className="text-sm text-slate-600 dark:text-gray-400">{parent.phone}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteParent(parent._id, parent.name)}
                  className="text-red-500 hover:text-red-700 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mb-3">
                <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Children ({parent.children?.length || 0}):
                </p>
                {parent.children && parent.children.length > 0 ? (
                  <div className="space-y-1">
                    {parent.children.map((child) => (
                      <div
                        key={child._id}
                        className="flex items-center justify-between bg-slate-50 dark:bg-gray-700 px-3 py-2 rounded text-sm"
                      >
                        <span className="text-slate-800 dark:text-white">
                          {child.name} ({child.admissionNumber})
                        </span>
                        <button
                          onClick={() => unlinkChild(parent._id, child._id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-gray-500">No children linked</p>
                )}
              </div>

              {linkingParentId === parent._id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search student by name..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      searchStudents(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {searchingStudents && <p className="text-xs text-slate-500">Searching...</p>}
                  {students.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-gray-600 rounded-lg">
                      {students.map((student) => (
                        <button
                          key={student._id}
                          onClick={() => linkChild(parent._id, student._id)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-700 text-sm text-slate-800 dark:text-white"
                        >
                          {student.name} ({student.admissionNumber}) - {student.classId?.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setLinkingParentId(null);
                      setStudentSearch('');
                      setStudents([]);
                    }}
                    className="text-sm text-slate-600 dark:text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setLinkingParentId(parent._id)}
                  className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <UserPlus size={16} />
                  Link Child
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ParentList;
