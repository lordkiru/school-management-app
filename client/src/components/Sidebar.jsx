import { LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Wallet } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'classes', label: 'Classes', icon: GraduationCap },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'scores', label: 'Scores', icon: ClipboardList },
  { key: 'fees', label: 'Fees', icon: Wallet },
];

function Sidebar({ activePage, onSelectPage }) {
  return (
    <aside className="w-56 min-h-screen bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 pt-16 px-3 shadow-sm">
      <nav className="flex flex-col gap-1">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onSelectPage(key)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activePage === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;