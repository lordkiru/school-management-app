import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X, ChevronDown, Users, GraduationCap, ClipboardList, Wallet, Settings } from 'lucide-react';
import { navItems } from '../constants/navItems';

// Fixed display order for groups — unrelated to the order links are declared in constants/navItems.js.
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
    : 'text-slate-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'
}`;

const childNavLinkClass = ({ isActive }) => `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
  isActive
    ? 'bg-indigo-600 text-white shadow-sm'
    : 'text-slate-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'
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
  const TEACHER_ORDER = ['dashboard', 'attendance', 'scores', 'cbt', 'mocks', 'reportcards', 'timetable', 'remarks'];
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
                        ? 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-3"><GroupIcon size={18} />{group.label}</span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-4 border-l border-slate-300/60 dark:border-white/10 pl-2">
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
      <aside className="glass-card glass-card-quiet hidden md:flex flex-col w-56 min-h-screen rounded-none border-0 border-r border-slate-200/70 dark:border-white/10 pt-16 px-3 print:hidden flex-shrink-0">
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
          <aside className="glass-card glass-card-strong absolute left-0 top-0 bottom-0 w-64 rounded-none border-0 border-r border-slate-200/70 dark:border-white/10 shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200/70 dark:border-white/10">
              <span className="font-bold text-slate-800 dark:text-white text-base">Menu</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 transition"
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
