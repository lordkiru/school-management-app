// Information architecture for the school admin sidebar. The links themselves (route, icon,
// allowed roles) are declared once in components/Sidebar.jsx (navItems); this file only decides
// how they are grouped, in what order, and any label that differs here. Every school-role link
// must appear in exactly one group or it would silently disappear from the menu.
export const ADMIN_NAV_GROUPS = [
  { label: 'Overview', items: ['dashboard'] },
  { label: 'Academics', items: ['students', 'classes', 'subjects', 'timetable', 'promote', 'scores', 'cbt', 'reportcards', 'remarks'] },
  { label: 'Finance', items: ['fees', 'feesetup', 'feebreakdown', 'feereport', 'subscription'] },
  { label: 'Engagement', items: ['attendance', 'notifications'] },
  { label: 'Administration', items: ['staff', 'parents', 'sessions', 'dataimport', 'auditlog', 'settings'] },
];

// Labels that differ from Sidebar.jsx's: the design calls Messaging "Notifications" and Audit Trail "Audit Log".
export const ADMIN_NAV_LABELS = {
  notifications: 'Notifications',
  auditlog: 'Audit Log',
};

// Role labels shown under the user's name (instead of a hardcoded "School Admin").
export const ROLE_LABELS = {
  proprietor: 'Proprietor',
  admin: 'Administrator',
  bursar: 'Bursar',
};
