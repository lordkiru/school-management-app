import { useState, useEffect, useRef } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AddScore({ onScoreAdded }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [sessions, setSessions] = useState([]);
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
        const [studentsRes, subjectsRes, classesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/students`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL}/subjects`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${import.meta.env.VITE_API_URL}/classes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setStudents(await studentsRes.json());
        setSubjects(await subjectsRes.json());
        setClasses(await classesRes.json());
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSessions(data);
        const current = data.find((s) => s.isCurrent);
        if (current) setSession(current.name);
      } catch (err) {
        console.error('Failed to load sessions', err);
      }
    };
    fetchSessions();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When class changes, reset student and subject selection
  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    setStudentId('');
    setStudentQuery('');
    setSubjectId('');
  };

  const selectedStudent = students.find((s) => s._id === studentId);
  const studentClassId = selectedStudent?.classId?._id || selectedStudent?.classId;

  // Filter students by selected class (if a class is chosen)
  const studentsInClass = selectedClassId
    ? students.filter((s) => {
        const sClassId = s.classId?._id || s.classId;
        return sClassId === selectedClassId;
      })
    : students;

  const matchingStudents = studentQuery
    ? studentsInClass.filter((s) => s.name.toLowerCase().includes(studentQuery.toLowerCase()))
    : studentsInClass.slice(0, 30);

  // Filter subjects by student's class
  const filteredSubjects = subjects.filter(
    (subj) => subj.classId?._id === studentClassId
  );

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
      // CA1, CA2, and Exam are entered independently — only send the ones
      // actually filled in, so leaving a field blank doesn't overwrite it with 0.
      const body = { studentId, subjectId, term, session };
      if (ca1 !== '') body.ca1 = Number(ca1);
      if (ca2 !== '') body.ca2 = Number(ca2);
      if (exam !== '') body.exam = Number(exam);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add score');
      }

      setSuccess('Score added successfully');
      setCa1('');
      setCa2('');
      setExam('');
      setStudentId('');
      setStudentQuery('');
      setSubjectId('');
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

      {/* Class filter */}
      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">
        Filter by Class <span className="text-slate-400">(optional)</span>
      </label>
      <select
        value={selectedClassId}
        onChange={(e) => handleClassChange(e.target.value)}
        className={inputClass}
      >
        <option value="">All classes</option>
        {classes.map((cls) => (
          <option key={cls._id} value={cls._id}>
            {cls.name} {cls.section ? `(${cls.section})` : ''}
          </option>
        ))}
      </select>

      {/* Student search */}
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
          placeholder={selectedClassId ? 'Type a student name in this class...' : "Type a student's name..."}
          required
          className={inputClass}
        />
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {matchingStudents.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">
                {selectedClassId ? 'No students found in this class' : 'No matching students'}
              </p>
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

      {/* Subject */}
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

      {/* Term */}
      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Term</label>
      <select value={term} onChange={(e) => setTerm(e.target.value)} required className={inputClass}>
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Session */}
      <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Session</label>
      <select value={session} onChange={(e) => setSession(e.target.value)} required className={inputClass}>
        <option value="">Select a session</option>
        {sessions.map((s) => (
          <option key={s._id} value={s.name}>
            {s.name} {s.isCurrent ? '(current)' : ''}
          </option>
        ))}
      </select>

      {/* Scores — each is optional on its own; leave blank to fill in later */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">CA1</label>
          <input
            type="number"
            min="0"
            max="100"
            value={ca1}
            onChange={(e) => setCa1(e.target.value)}
            placeholder="—"
            className="w-full p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">CA2</label>
          <input
            type="number"
            min="0"
            max="100"
            value={ca2}
            onChange={(e) => setCa2(e.target.value)}
            placeholder="—"
            className="w-full p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-slate-600 dark:text-gray-300">Exam</label>
          <input
            type="number"
            min="0"
            max="100"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            placeholder="—"
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
