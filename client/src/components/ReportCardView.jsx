import { useState, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import printArea from '../utils/printArea';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function ReportCardView() {
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [school, setSchool] = useState(null);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printStudentId, setPrintStudentId] = useState(null);
  const printRef = useRef(null);

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

    const fetchSchool = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/school`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSchool(await res.json());
      } catch (err) {
        console.error('Failed to load school info', err);
      }
    };
    fetchSchool();

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

  const handleLoad = async (e) => {
    e.preventDefault();
    setError('');
    setResults([]);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = `${import.meta.env.VITE_API_URL}/scores/report-card?classId=${classId}&term=${encodeURIComponent(term)}&session=${encodeURIComponent(session)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report card');
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'p-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-slate-800 dark:text-white text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none transition';

  const printing = results.find((r) => r.student.id === printStudentId);

  return (
    <div className="p-6">
      {/* Filter form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Report Cards</h2>

        {error && (
          <div className="bg-rose-50 dark:bg-red-900 text-rose-600 dark:text-red-200 text-sm p-2 rounded-lg mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleLoad} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} required className={inputClass}>
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} required className={inputClass}>
              {TERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-slate-600 dark:text-gray-300">Session</label>
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select a session</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.name}>
                  {s.name} {s.isCurrent ? '(current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </form>
      </div>

      {/* Class results table */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700">
                  <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Position</th>
                  <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Name</th>
                  <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Admission No.</th>
                  <th className="py-3 px-5 text-slate-500 dark:text-gray-400 text-sm font-medium">Total</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.student.id} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                    <td className="py-3 px-5 text-slate-800 dark:text-white">{r.position}</td>
                    <td className="py-3 px-5 text-slate-800 dark:text-white">{r.student.name}</td>
                    <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{r.student.admissionNumber}</td>
                    <td className="py-3 px-5 text-slate-600 dark:text-gray-300">{r.totalScore}</td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => setPrintStudentId(r.student.id)}
                        disabled={r.scores.length === 0}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <Printer size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual report card modal */}
      {printing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header — never printed */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Report Card</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printArea(printRef)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg transition"
                >
                  <Printer size={16} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setPrintStudentId(null)}
                  className="text-slate-500 hover:text-slate-700 text-sm px-2"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable area — only this div is sent to the printer */}
            <div ref={printRef} className="p-8 text-slate-800">
              <div className="text-center mb-6 border-b border-slate-200 pb-4">
                {school?.logoUrl && (
                  <img src={school.logoUrl} alt={`${school.name} logo`} className="h-14 mx-auto mb-2 object-contain" />
                )}
                <h1 className="text-xl font-bold">{school?.name || 'School'}</h1>
                {school?.address && <p className="text-xs text-slate-500">{school.address}</p>}
                <p className="text-sm font-medium text-slate-600 mt-2">Report Card</p>
                <p className="text-sm text-slate-500">
                  {term} — {session}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm mb-6">
                <span className="text-slate-500">Student Name</span>
                <span className="font-medium text-right">{printing.student.name}</span>

                <span className="text-slate-500">Admission Number</span>
                <span className="font-medium text-right">{printing.student.admissionNumber}</span>

                <span className="text-slate-500">Class</span>
                <span className="font-medium text-right">{printing.student.className}</span>

                <span className="text-slate-500">Position in Class</span>
                <span className="font-medium text-right">
                  {printing.position} of {results.length}
                </span>
              </div>

              <table className="w-full text-sm border-collapse mb-6">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-slate-500 font-medium">Subject</th>
                    <th className="py-2 text-left text-slate-500 font-medium">CA1</th>
                    <th className="py-2 text-left text-slate-500 font-medium">CA2</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Exam</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Total</th>
                    <th className="py-2 text-left text-slate-500 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {printing.scores.map((s) => (
                    <tr key={s._id} className="border-b border-slate-100">
                      <td className="py-2">{s.subjectId?.name || '—'}</td>
                      <td className="py-2">{s.ca1}</td>
                      <td className="py-2">{s.ca2}</td>
                      <td className="py-2">{s.exam}</td>
                      <td className="py-2 font-semibold">{s.total}</td>
                      <td className="py-2">{s.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-sm font-medium mb-6">Overall Total: {printing.totalScore}</p>

              {/* Remarks section */}
              {(printing.teacherRemark || printing.principalRemark) && (
                <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                  {printing.teacherRemark && (
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Class Teacher's Remark
                      </p>
                      <p className="text-sm text-slate-800 italic">"{printing.teacherRemark}"</p>
                    </div>
                  )}
                  {printing.principalRemark && (
                    <div className="p-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Principal's Remark
                      </p>
                      <p className="text-sm text-slate-800 italic">"{printing.principalRemark}"</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-end mt-10 pt-6 border-t border-slate-200 text-xs text-slate-400">
                <p>Issued: {new Date().toLocaleDateString()}</p>
                <div className="text-right">
                  <div className="border-t border-slate-400 w-32 mb-1"></div>
                  <p>Principal's Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportCardView;
