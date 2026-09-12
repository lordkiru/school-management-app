import { useState, useEffect } from 'react';
import { Users, GraduationCap, ClipboardList, Wallet } from 'lucide-react';
import { SCHOOL_LEVELS } from '../constants/schoolLevels';

const SECTIONS = SCHOOL_LEVELS;

function Dashboard({ userRole }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const canSeeFees = userRole === 'proprietor' || userRole === 'bursar';

        const fetchPromises = [
          fetch(`${import.meta.env.VITE_API_URL}/students`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/classes`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/school`, { headers }),
        ];
        if (canSeeFees) {
          fetchPromises.push(fetch(`${import.meta.env.VITE_API_URL}/fees`, { headers }));
        }

        const results = await Promise.all(fetchPromises);
        const students = await results[0].json();
        const classes = await results[1].json();
        const school = results[2].ok ? await results[2].json() : null;
        const fees = canSeeFees ? await results[3].json() : [];

        const enabledSections = Array.isArray(school?.schoolLevels) && school.schoolLevels.length > 0
          ? SECTIONS.filter((s) => school.schoolLevels.includes(s))
          : SECTIONS;

        const classSectionMap = {};
        classes.forEach((cls) => {
          classSectionMap[cls._id] = cls.section;
        });

        const studentSectionMap = {};
        students.forEach((student) => {
          const classId = student.classId?._id || student.classId;
          studentSectionMap[student._id] = classSectionMap[classId];
        });

        // A student/fee with no section at all (not yet linked to a class) is kept in
        // the totals — it's unclassified, not deselected. Only records whose section
        // is a real value the school has since turned OFF are excluded.
        const isVisibleSection = (section) => !section || enabledSections.includes(section);

        const visibleClasses = classes.filter((cls) => isVisibleSection(cls.section));
        const visibleStudents = students.filter((student) => isVisibleSection(studentSectionMap[student._id]));
        const visibleFees = fees.filter((fee) => {
          const studentId = fee.studentId?._id || fee.studentId;
          return isVisibleSection(studentSectionMap[studentId]);
        });

        const studentsBySection = {};
        SECTIONS.forEach((s) => (studentsBySection[s] = 0));
        let unassignedStudents = 0;

        students.forEach((student) => {
          const section = studentSectionMap[student._id];
          if (section && studentsBySection[section] !== undefined) {
            studentsBySection[section]++;
          } else {
            unassignedStudents++;
          }
        });

        const feesBySection = {};
        SECTIONS.forEach((s) => (feesBySection[s] = { expected: 0, paid: 0 }));

        fees.forEach((fee) => {
          const studentId = fee.studentId?._id || fee.studentId;
          const section = studentSectionMap[studentId];
          if (section && feesBySection[section]) {
            feesBySection[section].expected += fee.amountExpected;
            feesBySection[section].paid += fee.amountPaid;
          }
        });

        const totalExpected = visibleFees.reduce((sum, f) => sum + f.amountExpected, 0);
        const totalPaid = visibleFees.reduce((sum, f) => sum + f.amountPaid, 0);
        const totalOutstanding = totalExpected - totalPaid;

        setStats({
          totalStudents: visibleStudents.length,
          totalClasses: visibleClasses.length,
          studentsBySection,
          unassignedStudents,
          feesBySection,
          totalExpected,
          totalPaid,
          totalOutstanding,
          canSeeFees,
          enabledSections,
        });
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userRole]);

  if (loading) return <p className="p-6">Loading dashboard...</p>;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;

  const summaryCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: Users,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500',
    },
    {
      label: 'Total Classes',
      value: stats.totalClasses,
      icon: GraduationCap,
      iconColor: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-500',
    },
  ];

  if (stats.canSeeFees) {
    summaryCards.push(
      {
        label: 'Fees Collected',
        value: `₦${stats.totalPaid.toLocaleString()}`,
        icon: Wallet,
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-500',
      },
      {
        label: 'Fees Outstanding',
        value: `₦${stats.totalOutstanding.toLocaleString()}`,
        icon: ClipboardList,
        iconColor: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-500',
      }
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Overview</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {summaryCards.map(({ label, value, icon: Icon, iconColor, border }) => (
          <div
            key={label}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 border-l-4 ${border} p-5 flex flex-col gap-2`}
          >
            <Icon className={iconColor} size={22} />
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{value}</span>
            <span className="text-sm text-slate-500 dark:text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Students by Section</h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {stats.enabledSections.map((section) => (
          <div
            key={section}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 p-5 flex flex-col gap-1"
          >
            <span className="text-2xl font-bold text-slate-800 dark:text-white">
              {stats.studentsBySection[section]}
            </span>
            <span className="text-sm text-slate-500 dark:text-gray-400">{section}</span>
          </div>
        ))}
      </div>

      {stats.canSeeFees && (
        <>
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Fees by Section</h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700">
                  <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Section</th>
                  <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Expected</th>
                  <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Collected</th>
                  <th className="py-3 px-4 text-slate-500 dark:text-gray-400 text-sm font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {stats.enabledSections.map((section) => {
                  const { expected, paid } = stats.feesBySection[section];
                  return (
                    <tr key={section} className="border-b border-slate-50 dark:border-gray-700 last:border-0">
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">{section}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">₦{expected.toLocaleString()}</td>
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">
                        ₦{paid.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-rose-600 dark:text-rose-400 font-medium">
                        ₦{(expected - paid).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stats.unassignedStudents > 0 && (
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-4">
          {stats.unassignedStudents} student(s) not yet linked to a section.
        </p>
      )}
    </div>
  );
}

export default Dashboard;