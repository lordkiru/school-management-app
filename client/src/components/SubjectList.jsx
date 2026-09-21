import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronLeft, ChevronRight, UserCog } from 'lucide-react';

const GROUPS_PER_PAGE = 8;

function SubjectList({ refreshKey }) {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [staff, setStaff] = useState([]);

  // Single-row (one class) quick assign/unassign
  const [assigningId, setAssigningId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // Bulk assign — one teacher across several classes of the same subject name
  const [bulkAssignName, setBulkAssignName] = useState(null);
  const [bulkTeacherId, setBulkTeacherId] = useState('');
  const [bulkClassIds, setBulkClassIds] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

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

      setSubjects(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setClasses(data);
    } catch (err) {
      console.error('Failed to load classes', err);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStaff(data.filter((s) => s.role === 'teacher'));
      }
    } catch (err) {
      console.error('Failed to load staff', err);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects, refreshKey]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Reset to page 1 whenever the class filter changes, so you don't land on an empty page
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId]);

  const handleDelete = async (subjectId, subjectName, className) => {
    const confirmed = window.confirm(
      `Remove ${subjectName} from ${className}? Any scores recorded for this subject in this class will also be deleted. This cannot be undone.`
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

  const handleAssignTeacher = async (subjectId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subjects/${subjectId}/assign-teacher`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teacherId: selectedTeacher || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign teacher');

      setAssigningId(null);
      fetchSubjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const openBulkAssign = (name) => {
    setBulkAssignName(name);
    setBulkTeacherId('');
    setBulkClassIds([]);
    setBulkError('');
  };

  const toggleBulkClass = (classId) => {
    setBulkClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleBulkAssign = async (name) => {
    setBulkError('');
    if (bulkClassIds.length === 0) {
      setBulkError('Select at least one class');
      return;
    }
    setBulkSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/subjects/assign-teacher-bulk`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, teacherId: bulkTeacherId || null, classIds: bulkClassIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign teacher');

      setBulkAssignName(null);
      fetchSubjects();
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  if (error) return <p className="p-6 text-rose-600 dark:text-red-400">{error}</p>;

  const filteredSubjects = selectedClassId
    ? subjects.filter((s) => (s.classId?._id || s.classId) === selectedClassId)
    : subjects;

  // Group the flat per-class Subject documents by name — a subject taught in
  // 3 classes is still 3 documents underneath, this just presents them as one row.
  const groupMap = new Map();
  filteredSubjects.forEach((subject) => {
    if (!groupMap.has(subject.name)) groupMap.set(subject.name, []);
    groupMap.get(subject.name).push(subject);
  });
  const groups = [...groupMap.entries()]
    .map(([name, rows]) => ({
      name,
      rows: rows.sort((a, b) => (a.classId?.name || '').localeCompare(b.classId?.name || '')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(groups.length / GROUPS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * GROUPS_PER_PAGE;
  const pageGroups = groups.slice(startIndex, startIndex + GROUPS_PER_PAGE);

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Subjects</h2>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-slate-700 dark:text-gray-200"
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">Loading subjects...</p>
        ) : groups.length === 0 ? (
          <p className="p-5 text-slate-500 dark:text-gray-400">
            {selectedClassId ? 'No subjects found for this class.' : 'No subjects found.'}
          </p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {pageGroups.map((group) => (
                <div key={group.name} className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                      {group.name}
                      <span className="ml-2 text-xs font-normal text-slate-400 dark:text-gray-500">
                        {group.rows.length} class{group.rows.length === 1 ? '' : 'es'}
                      </span>
                    </h3>
                    <button
                      onClick={() => openBulkAssign(group.name)}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <UserCog size={14} /> Assign teacher to multiple classes
                    </button>
                  </div>

                  {bulkAssignName === group.name && (
                    <div className="mb-3 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20">
                      <p className="text-xs text-slate-500 dark:text-gray-400 mb-2">
                        Pick a teacher and every class of {group.name} they should teach. A different teacher can still cover this subject in classes you don't select here.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <select
                          value={bulkTeacherId}
                          onChange={(e) => setBulkTeacherId(e.target.value)}
                          className="p-1.5 rounded border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((t) => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleBulkAssign(group.name)}
                          disabled={bulkSaving}
                          className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded"
                        >
                          {bulkSaving ? 'Saving...' : 'Apply to selected classes'}
                        </button>
                        <button
                          onClick={() => setBulkAssignName(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                      {bulkError && <p className="text-xs text-rose-500 mb-2">{bulkError}</p>}
                      <div className="flex flex-wrap gap-2">
                        {group.rows.map((row) => (
                          <label key={row._id} className="flex items-center gap-1.5 text-xs bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-full px-2.5 py-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={bulkClassIds.includes(row.classId?._id || row.classId)}
                              onChange={() => toggleBulkClass(row.classId?._id || row.classId)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                            />
                            {row.classId?.name || '—'}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {group.rows.map((subject) => (
                          <tr key={subject._id} className="border-t border-slate-50 dark:border-gray-700 first:border-0">
                            <td className="py-2 pr-4 text-sm text-slate-600 dark:text-gray-300 w-1/3">{subject.classId?.name || '—'}</td>
                            <td className="py-2 pr-4">
                              {assigningId === subject._id ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    className="p-1 rounded border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                                  >
                                    <option value="">Unassigned</option>
                                    {staff.map((t) => (
                                      <option key={t._id} value={t._id}>
                                        {t.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleAssignTeacher(subject._id)}
                                    className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setAssigningId(null)}
                                    className="text-slate-400 hover:text-slate-600 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAssigningId(subject._id);
                                    setSelectedTeacher(subject.teacherId?._id || '');
                                  }}
                                  className="hover:underline decoration-dotted text-sm text-slate-600 dark:text-gray-300"
                                  title="Click to assign a teacher to this class"
                                >
                                  {subject.teacherId?.name || 'Unassigned'}
                                </button>
                              )}
                            </td>
                            <td className="py-2 pl-4 text-right w-10">
                              <button
                                onClick={() => handleDelete(subject._id, subject.name, subject.classId?.name || 'this class')}
                                disabled={deletingId === subject._id}
                                className="text-rose-500 hover:text-rose-700 disabled:opacity-50 transition"
                                title="Remove subject from this class"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {groups.length > 0 && (
              <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-gray-700 text-sm">
                <span className="text-slate-500 dark:text-gray-400">
                  Showing {startIndex + 1}–{Math.min(startIndex + GROUPS_PER_PAGE, groups.length)} of{' '}
                  {groups.length} subjects
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
