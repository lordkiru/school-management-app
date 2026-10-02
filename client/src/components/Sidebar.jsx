import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ChevronDown, LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Wallet, Settings, History, UserCog, Calendar, ArrowUpCircle, FileText, CalendarRange, UserPlus, Shield, Building2, ListTree, BarChart3, ClipboardCheck, MessageSquare, PenLine, Upload, Monitor, CreditCard } from 'lucide-react';

// Every leaf item is declared once. `group` assigns it to a collapsible
// section for roles that use grouped navigation; items with no `group`
// (Dashboard, Attendance, and the two Super Admin items) always render as
// standalone top-level links. The teacher role ignores `group` entirely and
// renders its handful of allowed items flat, in this same declared order —
// see the render logic below.
const navItems = [
  { key: 'dashboard', to: '/dashboard', end: true, label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['proprietor', 'admin', 'bursar', 'teacher'] },
  { key: 'attendance', to: '/dashboard/attendance', label: 'Attendance', icon: ClipboardCheck, allowedRoles: ['proprietor', 'admin', 'teacher'] },

  { key: 'students', to: '/dashboard/students', label: 'Students', icon: Users, allowedRoles: ['proprietor', 'admin', 'bursar'], group: 'academics' },
  { key: 'classes', to: '/dashboard/classes', label: 'Classes', icon: GraduationCap, allowedRoles: ['proprietor', 'admin'], group: 'academics' },
  { key: 'subjects', to: '/dashboard/subjects', label: 'Subjects', icon: BookOpen, allowedRoles: ['proprietor', 'admin'], group: 'academics' },
  { key: 'timetable', to: '/dashboard/timetable', label: 'Timetable', icon: Calendar, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'academics' },
  { key: 'promote', to: '/dashboard/promote', label: 'Promote Class', icon: ArrowUpCircle, allowedRoles: ['proprietor', 'admin'], group: 'academics' },

  { key: 'scores', to: '/dashboard/scores', label: 'Scores', icon: ClipboardList, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },
  { key: 'cbt', to: '/dashboard/cbt', label: 'CBT Tests', icon: Monitor, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },
  { key: 'reportcards', to: '/dashboard/reportcards', label: 'Report Card', icon: FileText, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },
  { key: 'remarks', to: '/dashboard/remarks', label: 'Remarks', icon: PenLine, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },

  { key: 'fees', to: '/dashboard/fees', label: 'Fees', icon: Wallet, allowedRoles: ['proprietor', 'bursar'], group: 'billing' },
  { key: 'feesetup', to: '/dashboard/fees/setup', label: 'Fee Setup', icon: ListTree, allowedRoles: ['proprietor', 'admin', 'bursar'], group: 'billing' },
  { key: 'feebreakdown', to: '/dashboard/fees/breakdown', label: 'Fee Breakdown', icon: BarChart3, allowedRoles: ['proprietor', 'admin', 'bursar'], group: 'billing' },
  { key: 'feereport', to: '/dashboard/fees/report', label: 'Fee Report', icon: FileText, allowedRoles: ['proprietor', 'bursar'], group: 'billing' },
  { key: 'subscription', to: '/dashboard/subscription', label: 'My Subscription', icon: CreditCard, allowedRoles: ['proprietor'], group: 'billing' },

  { key: 'staff', to: '/dashboard/staff', label: 'Staff', icon: UserCog, allowedRoles: ['proprietor', 'admin'], group: 'people' },
  { key: 'parents', to: '/dashboard/parents', label: 'Parents', icon: UserPlus, allowedRoles: ['proprietor', 'admin'], group: 'people' },

  { key: 'sessions', to: '/dashboard/sessions', label: 'Sessions', icon: CalendarRange, allowedRoles: ['proprietor'], group: 'admin' },
  { key: 'notifications', to: '/dashboard/notifications', label: 'Messaging', icon: MessageSquare, allowedRoles: ['proprietor', 'admin'], group: 'admin' },
  { key: 'dataimport', to: '/dashboard/dataimport', label: 'Data Import', icon: Upload, allowedRoles: ['proprietor', 'admin'], group: 'admin' },
  { key: 'auditlog', to: '/dashboard/auditlog', label: 'Audit Trail', icon: History, allowedRoles: ['proprietor'], group: 'admin' },
  { key: 'settings', to: '/dashboard/settings', label: 'Settings', icon: Settings, allowedRoles: ['proprietor'], group: 'admin' },

  // Super Admin Menu Items — standalone, not grouped
  { key: 'superadmin', to: '/dashboard/superadmin', end: true, label: 'Super Admin', icon: Shield, allowedRoles: ['super_admin'] },
  { key: 'superadmin-tenants', to: '/dashboard/superadmin/tenants', label: 'Manage Schools', icon: Building2, allowedRoles: ['super_admin'] },
];

// Fixed display order for groups — unrelated to declaration order above.
const GROUP_DEFS = [
  { key: 'academics', label: 'Academics', icon: GraduationCap },
  { key: 'assessment', label: 'Assessment', icon: ClipboardList },
  { key: 'billing', label: 'Billing', icon: Wallet },
  { key: 'people', label: 'People', icon: Users },
  { key: 'admin', label: 'Admin', icon: Settings },
];

const navLinkClass = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
  isActive
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
}`;

const childNavLinkClass = ({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
  isActive
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
}`;

function Sidebar({ userRole, mobileOpen, onClose }) {
  const location = useLocation();

  // Teacher keeps its existing short flat list exactly as-is — every allowed
  // item rendered top-level, in declared order, ignoring `group` entirely.
  const isFlatRole = userRole === 'teacher';

  const standaloneItems = navItems.filter((item) => !item.group && item.allowedRoles.includes(userRole));

  // Teacher's exact existing order — not read off declaration order in
  // navItems (which is organized by group for the other roles' benefit),
  // so grouping the array differently can never silently reshuffle this.
  const TEACHER_ORDER = ['dashboard', 'attendance', 'scores', 'cbt', 'reportcards', 'timetable', 'remarks'];
  const flatItems = TEACHER_ORDER
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item) => item && item.allowedRoles.includes(userRole));

  const groups = GROUP_DEFS
    .map((def) => ({
      ...def,
      children: navItems.filter((item) => item.group === def.key && item.allowedRoles.includes(userRole)),
    }))
    .filter((group) => group.children.length > 0);

  const isGroupActive = (group) => group.children.some((c) => location.pathname.startsWith(c.to));

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    groups.forEach((group) => {
      if (isGroupActive(group)) initial[group.key] = true;
    });
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (isGroupActive(group)) next[group.key] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const navContent = (
    <nav className="flex flex-col gap-1 py-2">
      {isFlatRole
        ? flatItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.key} to={item.to} end={item.end} onClick={onClose} className={navLinkClass}>
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })
        : (
          <>
            {standaloneItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.key} to={item.to} end={item.end} onClick={onClose} className={navLinkClass}>
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}

            {groups.map((group) => {
              const isOpen = !!openGroups[group.key];
              const active = isGroupActive(group);
              const GroupIcon = group.icon;
              return (
                <div key={group.key}>
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-3"><GroupIcon size={18} />{group.label}</span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-4 border-l border-slate-200 dark:border-gray-700 pl-2">
                      {group.children.map(({ key, to, label, icon: Icon }) => (
                        <NavLink key={key} to={to} onClick={onClose} className={childNavLinkClass}>
                          <Icon size={16} />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
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
