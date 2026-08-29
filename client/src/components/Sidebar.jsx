import { useEffect, useState } from 'react';
import { X, ChevronDown, LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Wallet, Settings, History, UserCog, Calendar, ArrowUpCircle, FileText, CalendarRange, UserPlus, Shield, Building2, ListTree, BarChart3, ClipboardCheck, MessageSquare, PenLine, Upload, Monitor } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['proprietor', 'admin', 'bursar'] },
  { key: 'attendance', label: 'Attendance', icon: ClipboardCheck, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'students', label: 'Students', icon: Users, allowedRoles: ['proprietor', 'admin', 'bursar', 'teacher'] },
  { key: 'classes', label: 'Classes', icon: GraduationCap, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'subjects', label: 'Subjects', icon: BookOpen, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'scores', label: 'Scores', icon: ClipboardList, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'cbt', label: 'CBT Tests', icon: Monitor, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  {
    key: 'fees-menu',
    label: 'Fees',
    icon: Wallet,
    children: [
      { key: 'fees', label: 'Fees', icon: Wallet, allowedRoles: ['proprietor', 'bursar'] },
      { key: 'feesetup', label: 'Fee Setup', icon: ListTree, allowedRoles: ['proprietor', 'admin', 'bursar'] },
      { key: 'feedownown', label: 'Fee Breakdown', icon: BarChart3, allowedRoles: ['proprietor', 'admin', 'bursar'] },
      { key: 'feereport', label: 'Fee Report', icon: FileText, allowedRoles: ['proprietor', 'bursar'] },
    ],
  },
  { key: 'reportcards', label: 'Report Card', icon: FileText, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'timetable', label: 'Timetable', icon: Calendar, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'sessions', label: 'Sessions', icon: CalendarRange, allowedRoles: ['proprietor'] },
  { key: 'promote', label: 'Promote Class', icon: ArrowUpCircle, allowedRoles: ['proprietor', 'admin'] },
  { key: 'staff', label: 'Staff', icon: UserCog, allowedRoles: ['proprietor', 'admin'] },
  { key: 'parents', label: 'Parents', icon: UserPlus, allowedRoles: ['proprietor', 'admin'] },
  { key: 'remarks', label: 'Remarks', icon: PenLine, allowedRoles: ['proprietor', 'admin', 'teacher'] },
  { key: 'notifications', label: 'Messaging', icon: MessageSquare, allowedRoles: ['proprietor', 'admin'] },
  { key: 'dataimport', label: 'Data Import', icon: Upload, allowedRoles: ['proprietor', 'admin'] },
  { key: 'auditlog', label: 'Audit Trail', icon: History, allowedRoles: ['proprietor'] },
  { key: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['proprietor'] },
  // Super Admin Menu Items
  { key: 'superadmin', label: '🎯 Super Admin', icon: Shield, allowedRoles: ['super_admin'] },
  { key: 'superadmin-tenants', label: '🏫 Manage Schools', icon: Building2, allowedRoles: ['super_admin'] },
];

function Sidebar({ activePage, onSelectPage, userRole, mobileOpen, onClose }) {
  const visibleItems = navItems
    .map((item) => item.children
      ? { ...item, children: item.children.filter((child) => child.allowedRoles.includes(userRole)) }
      : item)
    .filter((item) => item.children ? item.children.length > 0 : item.allowedRoles.includes(userRole));
  const feesMenu = visibleItems.find((item) => item.key === 'fees-menu');
  const [feesOpen, setFeesOpen] = useState(Boolean(feesMenu?.children.some((item) => item.key === activePage)));

  useEffect(() => {
    if (feesMenu?.children.some((item) => item.key === activePage)) {
      setFeesOpen(true);
    }
  }, [activePage, feesMenu]);

  const navContent = (
    <nav className="flex flex-col gap-1 py-2">
      {visibleItems.map((item) => {
        if (item.children) {
          const isChildActive = item.children.some((child) => child.key === activePage);
          return (
            <div key={item.key}>
              <button
                onClick={() => setFeesOpen((open) => !open)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isChildActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="flex items-center gap-3"><item.icon size={18} />{item.label}</span>
                <ChevronDown size={16} className={`transition-transform ${feesOpen ? 'rotate-180' : ''}`} />
              </button>
              {feesOpen && (
                <div className="ml-4 border-l border-slate-200 dark:border-gray-700 pl-2">
                  {item.children.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => {
                        onSelectPage(key);
                        onClose?.();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        activePage === key
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => {
              onSelectPage(item.key);
              onClose?.();
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              activePage === item.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible on md+) ── */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 pt-16 px-3 shadow-sm print:hidden flex-shrink-0">
        {navContent}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          {/* Drawer panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-gray-700">
              <span className="font-bold text-slate-800 dark:text-white text-base">Menu</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              {navContent}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
