import { useState, useEffect, useRef } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AddScore({ onScoreAdded }) {
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [ca1, setCa1] = useState('');
  const [ca2, setCa2] = useState('');
  const [exam, setExam] = useState('');
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const token = localStorage.getItem('token');
        const [studentsRes, subjectsRes] = await Promise.all([
          fetch('http://localhost:5000/students', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:5000/subjects', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setStudents(await studentsRes.json());
        setSubjects(await subjectsRes.json());
      } catch (err) {
        console.error('Failed to load students/subjects', err);
      }
    };
    fetchOptions();
  }, []);

  // Close the dropdown when clicking outside it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedStudent = students.find((s) => s._id === studentId);
  const studentClassId = selectedStudent?.classId?._id || selectedStudent?.classId;

  const filteredSubjects = subjects.filter(
    (subj) => subj.classId?._id === studentClassId
  );

  const matchingStudents = studentQuery
    ? students.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()))
    : students.slice(0, 20); // show a first batch even before typing

  const handleSelectStudent = (student) => {
    setStudentId(student._id);
    setStudentQuery(student.name);
    setSubjectId('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId,
          subjectId,
          term,
          session,
          ca1: Number(ca1),
          ca2: Number(ca2),
          exam: Number(exam),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add score');
      }

      setSuccess('Score added successfully');
      setCa1('');
      setCa2('');
      setExam('');
      onScoreAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full mb-3 p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 max-w-md"
    >
      <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Add Score</h2>

      {error && (
        <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-green-900 text-emerald-600 dark:text-green-200 text-sm p-2 rounded-lg mb-3">
          {success}
        </div>
      )}

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Student</label>
      <div className="relative mb-1" ref={wrapperRef}>
        <input
          type="text"
          value={studentQuery}
          onChange={(e) => {
            setStudentQuery(e.target.value);
            setStudentId('');
            setSubjectId('');
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type a student's name..."
          required
          className={inputClass}
        />
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {matchingStudents.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">No matching students</p>
            ) : (
              matchingStudents.map((s) => (
                <button
                  type="button"
                  key={s._id}
                  onClick={() => handleSelectStudent(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-gray-600 transition text-slate-800 dark:text-white"
                >
                  {s.name}{' '}
                  <span className="text-slate-400 dark:text-gray-400">
                    ({s.classId?.name || s.className || 'No class'})
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selectedStudent && (
        <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
          Class: {selectedStudent.classId?.name || selectedStudent.className || 'Unknown'}
        </p>
      )}

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Subject</label>
      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        required
        disabled={!studentId}
        className={`${inputClass} disabled:opacity-50`}
      >
        <option value="">{studentId ? 'Select a subject' : 'Select a student first'}</option>
        {filteredSubjects.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </select>
      {studentId && filteredSubjects.length === 0 && (
        <p className="text-xs text-rose-500 -mt-2 mb-3">
          No subjects found for this student's class yet — add one under Subjects first.
        </p>
      )}

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Term</label>
      <select value={term} onChange={(e) => setTerm(e.target.value)} required className={inputClass}>
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Session</label>
      <input
        type="text"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2025/2026"
        required
        className={inputClass}
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">CA1</label>
          <input
            type="number"
            value={ca1}
            onChange={(e) => setCa1(e.target.value)}
            required
            className="w-full p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">CA2</label>
          <input
            type="number"
            value={ca2}
            onChange={(e) => setCa2(e.target.value)}
            required
            className="w-full p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Exam</label>
          <input
            type="number"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            required
            className="w-full p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2 rounded-lg transition"
      >
        {loading ? 'Adding...' : 'Add Score'}
      </button>
    </form>
  );
}

export default AddScore;