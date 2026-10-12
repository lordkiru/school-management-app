import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { navItems } from '../../constants/navItems';
import { ADMIN_NAV_GROUPS, ADMIN_NAV_LABELS, ROLE_LABELS } from '../../constants/adminNav';

const initialsOf = (name) =>
  (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

// An item is matched exactly (`end`) when another item lives beneath its path - Fees vs Fee
// Setup - so only the one you're actually on lights up. Students keeps its highlight on a
// student's detail page because nothing else sits under /dashboard/students.
const needsExactMatch = (item) =>
  item.end || navItems.some((other) => other !== item && other.to.startsWith(`${item.to}/`));

const isItemActive = (item, pathname) =>
  needsExactMatch(item) ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

// Dark navigation column: grouped real links (filtered to this user's role), user chip pinned at
// the bottom. Each group heading is a dropdown: the group you're in is open, the rest are folded.
// Above 700px it stays in view beside the content; below that it sits on top and its menu folds
// away behind a button so the page content isn't pushed a screen down.
function AdminSidebar({ user, darkMode, setDarkMode, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const groups = ADMIN_NAV_GROUPS
    .map((group) => ({
      label: group.label,
      items: group.items
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item) => item && item.allowedRoles.includes(user.role)),
    }))
    .filter((group) => group.items.length > 0);

  const { pathname } = useLocation();
  const activeGroup = groups.find((g) => g.items.some((item) => isItemActive(item, pathname)))?.label;

  // Which groups are open: by default only the one you're in. Clicking a heading overrides that for
  // the group. Moving to a page inside a group clears its override so it always opens to show where
  // you are (adjusted while rendering rather than in an effect).
  const [overrides, setOverrides] = useState({});
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (activeGroup && activeGroup in overrides) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[activeGroup];
        return next;
      });
    }
  }
  const isOpen = (label) => overrides[label] ?? label === activeGroup;
  const toggleGroup = (label) => setOverrides((prev) => ({ ...prev, [label]: !isOpen(label) }));

  const linkClass = ({ isActive }) =>
    `flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[13.5px] font-semibold transition ${
      isActive ? 'bg-white/10 text-white' : 'text-[#C3C1E6] hover:bg-white/[0.06] hover:text-white'
    }`;

  return (
    <aside className="flex-none bg-lem-sidebar px-3.5 py-6 font-body text-white print:hidden min-[700px]:sticky min-[700px]:top-0 min-[700px]:flex min-[700px]:h-screen min-[700px]:w-60 min-[700px]:flex-col">
      {/* Logo mark + menu button (mobile) */}
      <div className="flex items-center justify-between px-2.5 py-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-lem-brand">
            <span className="font-display text-base font-bold text-white">L</span>
          </div>
          <div className="leading-[1.15]">
            <div className="font-display text-[15.5px] font-bold text-white">Lemida</div>
            <div className="text-[10.5px] tracking-[0.06em] text-[#9793D1]">SCHOOL MANAGER</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="admin-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="rounded-lg p-2 text-[#C3C1E6] transition hover:bg-white/10 hover:text-white min-[700px]:hidden"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div id="admin-nav" className={`${menuOpen ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col pt-[30px] min-[700px]:flex`}>
        {/* Only the nav scrolls (the real menu is long); the user chip below stays pinned. */}
        <nav
          aria-label="Main"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]"
        >
          {groups.map((group) => {
            const open = isOpen(group.label);
            const panelId = `nav-group-${group.label.toLowerCase()}`;
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 pb-2 pt-1 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8783BD] transition hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    {group.label}
                    {/* a folded group that holds the page you're on keeps a dot, so you never lose your place */}
                    {!open && group.label === activeGroup && (
                      <span role="img" aria-label="Contains the current page" className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </span>
                  <ChevronDown size={14} className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {open && (
                  <div id={panelId} className="flex flex-col gap-px">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.key}
                        to={item.to}
                        end={needsExactMatch(item)}
                        onClick={() => setMenuOpen(false)}
                        className={linkClass}
                      >
                        {({ isActive }) => (
                          <>
                            <span className={`h-1.5 w-1.5 flex-none rounded-full ${isActive ? 'bg-indigo-400' : 'bg-transparent'}`} aria-hidden="true" />
                            <span>{ADMIN_NAV_LABELS[item.key] || item.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User chip */}
        <div className="mt-5 flex flex-none items-center gap-2.5 rounded-[13px] border border-white/[0.12] bg-white/[0.08] p-[11px] backdrop-blur-[14px]">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-lem-brand text-[12.5px] font-bold text-white">
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-bold text-white">{user.name}</div>
            <div className="text-[10.5px] text-[#A9A5DE]">{ROLE_LABELS[user.role] || user.role}</div>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle dark mode"
            className="flex-none rounded-lg p-1.5 text-[#C3C1E6] transition hover:bg-white/10 hover:text-white"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className="flex-none rounded-lg p-1.5 text-[#C3C1E6] transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
