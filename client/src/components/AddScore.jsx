import { useState, useEffect } from 'react';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function AddScore({ onScoreAdded }) {
  const [studentId, setStudentId] = useState('');
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

  // Find the selected student's class, so we can filter subjects to match
  const selectedStudent = students.find((s) => s._id === studentId);
  const studentClassId = selectedStudent?.classId?._id || selectedStudent?.classId;

  const filteredSubjects = subjects.filter(
    (subj) => subj.classId?._id === studentClassId
  );

  const handleStudentChange = (e) => {
    setStudentId(e.target.value);
    setSubjectId(''); // reset subject choice when student changes, since the class may differ
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

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-md"
    >
      <h2 className="text-lg font-bold mb-4">Add Score</h2>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-sm p-2 rounded mb-3">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm p-2 rounded mb-3">
          {success}
        </div>
      )}

      <label className="block text-sm mb-1">Student</label>
      <select
        value={studentId}
        onChange={handleStudentChange}
        required
        className="w-full mb-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      >
        <option value="">Select a student</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name} ({s.classId?.name || s.className || 'No class'})
          </option>
        ))}
      </select>
      {selectedStudent && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Class: {selectedStudent.classId?.name || selectedStudent.className || 'Unknown'}
        </p>
      )}

      <label className="block text-sm mb-1">Subject</label>
      <select
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        required
        disabled={!studentId}
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 disabled:opacity-50"
      >
        <option value="">
          {studentId ? 'Select a subject' : 'Select a student first'}
        </option>
        {filteredSubjects.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
          </option>
        ))}
      </select>
      {studentId && filteredSubjects.length === 0 && (
        <p className="text-xs text-red-500 mb-3">
          No subjects found for this student's class yet — add one under Subjects first.
        </p>
      )}

      <label className="block text-sm mb-1">Term</label>
      <select
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      >
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label className="block text-sm mb-1">Session</label>
      <input
        type="text"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2025/2026"
        required
        className="w-full mb-3 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label className="block text-sm mb-1">CA1</label>
          <input
            type="number"
            value={ca1}
            onChange={(e) => setCa1(e.target.value)}
            required
            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">CA2</label>
          <input
            type="number"
            value={ca2}
            onChange={(e) => setCa2(e.target.value)}
            required
            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Exam</label>
          <input
            type="number"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
            required
            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded transition"
      >
        {loading ? 'Adding...' : 'Add Score'}
      </button>
    </form>
  );
}

export default AddScore;