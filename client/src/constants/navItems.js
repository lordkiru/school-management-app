import { LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, Wallet, Settings, History, UserCog, Calendar, ArrowUpCircle, FileText, CalendarRange, UserPlus, Shield, Building2, ListTree, BarChart3, ClipboardCheck, MessageSquare, PenLine, Upload, Monitor, CreditCard, UserX, Target } from 'lucide-react';

// Every leaf item is declared once. `group` assigns it to a collapsible
// section for roles that use grouped navigation; items with no `group`
// (Dashboard, Attendance, and the two Super Admin items) always render as
// standalone top-level links. The teacher role ignores `group` entirely and
// renders its handful of allowed items flat, in this same declared order —
// see the render logic in components/Sidebar.jsx.
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
  { key: 'mocks', to: '/dashboard/mocks', label: 'Mock & Practice', icon: Target, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },
  { key: 'reportcards', to: '/dashboard/reportcards', label: 'Report Card', icon: FileText, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },
  { key: 'remarks', to: '/dashboard/remarks', label: 'Remarks', icon: PenLine, allowedRoles: ['proprietor', 'admin', 'teacher'], group: 'assessment' },

  { key: 'fees', to: '/dashboard/fees', label: 'Fees', icon: Wallet, allowedRoles: ['proprietor', 'bursar'], group: 'billing' },
  { key: 'feesetup', to: '/dashboard/fees/setup', label: 'Fee Setup', icon: ListTree, allowedRoles: ['proprietor', 'admin', 'bursar'], group: 'billing' },
  { key: 'feebreakdown', to: '/dashboard/fees/breakdown', label: 'Fee Breakdown', icon: BarChart3, allowedRoles: ['proprietor', 'admin', 'bursar'], group: 'billing' },
  { key: 'feereport', to: '/dashboard/fees/report', label: 'Fee Report', icon: FileText, allowedRoles: ['proprietor', 'bursar'], group: 'billing' },
  { key: 'debtors', to: '/dashboard/fees/debtors', label: 'Debtors List', icon: UserX, allowedRoles: ['proprietor', 'bursar'], group: 'billing' },
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

export { navItems };
