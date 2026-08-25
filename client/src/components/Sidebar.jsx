import { LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Wallet, Settings, History, UserCog, Calendar, ArrowUpCircle, FileText, CalendarRange, UserPlus, Shield, Building2, ListTree, BarChart3, ClipboardCheck, MessageSquare, PenLine, Upload } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['proprietor', 'admin', 'bursar'] },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'students', label: 'Students', icon: Users, allowedRoles: ['proprietor', 'admin', 'bursar', 'teacher'] },
  { key: 'classes', label: 'Classes', icon: GraduationCap, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'subjects', label: 'Subjects', icon: BookOpen, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'scores', label: 'Scores', icon: ClipboardList, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'fees', label: 'Fees', icon: Wallet, allowedRoles: ['proprietor', 'bursar'] },
  { key: 'feesetup', label: 'Fee Setup', icon: ListTree, allowedRoles: ['proprietor', 'admin', 'bursar'] },
  { key: 'feedownown', label: 'Fee Breakdown', icon: BarChart3, allowedRoles: ['proprietor', 'admin', 'bursar'] },
  { key: 'reportcards', label: 'Report Card', icon: FileText, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'feereport', label: 'Fee Report', icon: FileText, allowedRoles: ['proprietor', 'bursar'] },
  { key: 'timetable', label: 'Timetable', icon: Calendar, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'sessions', label: 'Sessions', icon: CalendarRange, allowedRoles: ['proprietor'] },
  { key: 'promote', label: 'Promote Class', icon: ArrowUpCircle, allowedRoles: ['proprietor', 'admin'] },
  { key: 'staff', label: 'Staff', icon: UserCog, allowedRoles: ['proprietor', 'admin'] },
  { key: 'parents', label: 'Parents', icon: UserPlus, allowedRoles: ['proprietor', 'admin'] },
  { key: 'remarks', label: 'Remarks', icon: PenLine, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'notifications', label: 'WhatsApp', icon: MessageSquare, allowedRoles: ['proprietor', 'admin'] },
  { key: 'dataimport', label: 'Data Import', icon: Upload, allowedRoles: ['proprietor', 'admin'] },
  { key: 'auditlog', label: 'Audit Trail', icon: History, allowedRoles: ['proprietor'] },
  { key: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['proprietor'] },
  // Super Admin Menu Items
  { key: 'superadmin', label: '🎯 Super Admin', icon: Shield, allowedRoles: ['super_admin'] },
  { key: 'superadmin-tenants', label: '🏫 Manage Schools', icon: Building2, allowedRoles: ['super_admin'] },
];

function Sidebar({ activePage, onSelectPage, userRole }) {
  const visibleItems = navItems.filter((item) => item.allowedRoles.includes(userRole));

  return (
    <aside className="w-56 min-h-screen bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 pt-16 px-3 shadow-sm print:hidden">
      <nav className="flex flex-col gap-1">
        {visibleItems.map(({ key, label, icon: Icon }) => (
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
