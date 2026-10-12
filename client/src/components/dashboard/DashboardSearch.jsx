import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

// Searches the students and classes the dashboard has already loaded - no extra API calls.
// Students open their detail page; classes open the Classes screen (only offered to roles that
// are allowed there).
function DashboardSearch({ students, classes, canOpenClasses }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const matchedStudents = students
      .filter((s) => s.name?.toLowerCase().includes(q) || s.admissionNumber?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({
        key: `s-${s._id}`,
        kind: 'Student',
        label: s.name,
        sub: [s.admissionNumber, s.classId?.name].filter(Boolean).join(' · '),
        to: `/dashboard/students/${s._id}`,
      }));
    const matchedClasses = canOpenClasses
      ? classes
        .filter((c) => c.name?.toLowerCase().includes(q))
        .slice(0, 3)
        .map((c) => ({ key: `c-${c._id}`, kind: 'Class', label: c.name, sub: c.section, to: '/dashboard/classes' }))
      : [];
    return [...matchedStudents, ...matchedClasses];
  }, [query, students, classes, canOpenClasses]);

  // Close on a click anywhere else
  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (to) => {
    setOpen(false);
    setQuery('');
    navigate(to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && results[0]) { e.preventDefault(); go(results[0].to); }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full min-[520px]:w-[220px]">
      <label htmlFor="dash-search" className="sr-only">Search students or classes</label>
      <input
        id="dash-search"
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        autoComplete="off"
        className="w-full rounded-[11px] border border-lem-ink/10 bg-white/75 py-2.5 pl-9 pr-3.5 font-body text-[13.5px] text-lem-ink outline-none backdrop-blur-[12px] placeholder:text-lem-muted focus:border-lem-brand focus:ring-2 focus:ring-lem-brand/20 dark:border-white/10 dark:bg-gray-800/75 dark:text-white dark:placeholder:text-gray-400"
      />
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lem-muted dark:text-gray-400" aria-hidden="true" />

      {showPanel && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-lem-ink/10 bg-white shadow-lg dark:border-white/10 dark:bg-gray-800">
          {results.length === 0 ? (
            <p className="px-3.5 py-3 text-[13px] text-lem-muted dark:text-gray-400">No students or classes match “{query.trim()}”.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => go(r.to)}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition hover:bg-lem-canvas dark:hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-lem-ink dark:text-white">{r.label}</span>
                      {r.sub && <span className="block truncate text-xs text-lem-muted dark:text-gray-400">{r.sub}</span>}
                    </span>
                    <span className="flex-none rounded-full bg-lem-brand/[0.08] px-2 py-0.5 text-[11px] font-semibold text-lem-brand dark:bg-indigo-400/15 dark:text-indigo-300">
                      {r.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default DashboardSearch;
