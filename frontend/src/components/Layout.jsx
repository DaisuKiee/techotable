import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, BookOpen, DoorOpen, Calendar,
  BarChart3, GraduationCap, LogOut, Menu, X, CalendarRange,
  User, Settings, FileText,
  Layers, Home, Activity, ChevronDown, Sun, Moon, AlertTriangle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLiveRefresh } from '../context/NotificationContext';
import { facultyAPI, termAPI } from '../services/api';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import AnimatedUserCheck from './AnimatedUserCheck';
import AIChatBubble from './AIChatBubble';
import NotificationBell from './NotificationBell';

/** Nav categories the user has collapsed. Remembered between visits. */
const COLLAPSED_GROUPS_KEY = 'layout.collapsedNavGroups';

const STAFF = ['admin', 'scheduling_officer', 'program_manager'];

const ROLE_LABELS = {
  admin: 'Administrator',
  scheduling_officer: 'Scheduling Officer',
  program_manager: 'Program Manager',
  faculty: 'Faculty',
  student: 'Student',
};

/** Header titles for pages that aren't in the nav. */
const EXTRA_TITLES = [
  { path: '/profile', name: 'My Profile' },
  { path: '/settings', name: 'Settings' },
  { path: '/analytics', name: 'Analytics' },
];

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    // Private windows and blocked site data both throw here
    return fallback;
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not worth surfacing: the nav still works, it just won't remember.
  }
};

const readCollapsedGroups = () => {
  const parsed = readStored(COLLAPSED_GROUPS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

/**
 * Light/dark switch for the header. The theme used to be reachable only from
 * Settings, so checking a page in the other mode meant a detour every time.
 */
export const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:bg-dark-hover"
    >
      {/* Both icons are rendered and swapped with a rotate, so the switch
          animates rather than popping. */}
      <Sun
        className={`absolute h-5 w-5 transition-all duration-300 motion-reduce:transition-none ${
          dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
        }`}
      />
      <Moon
        className={`absolute h-5 w-5 transition-all duration-300 motion-reduce:transition-none ${
          dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      />
    </button>
  );
};

/** Count pill next to a nav label, or a dot with the number on the icon rail. */
const NavBadge = ({ count, expanded }) => {
  if (!count) return null;
  const text = count > 99 ? '99+' : count;
  return expanded ? (
    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold leading-none text-white">
      {text}
    </span>
  ) : (
    <span className="absolute right-2 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-blue-700 dark:ring-[#0B1120]">
      {text}
    </span>
  );
};

/**
 * The current semester, with a progress bar. Program managers see their own
 * program's term; admins and the scheduling office how many programs have
 * their semesters set up. Shrinks to "days left" on the icon rail.
 */
const TermCard = ({ info, expanded, compact = false, onNavigate }) => {
  if (!info) return null;
  const { term, isSet, summary } = info;
  const unset = !summary && !isSet;
  const current = isSet && term?.status === 'current';

  return (
    <Link
      to="/semesters"
      onClick={onNavigate}
      title={expanded ? undefined : (summary ? `Semesters: ${summary.configured}/${summary.total} programs` : term?.label)}
      className={`mx-3 mb-3 block rounded-xl transition-colors ${
        expanded ? (compact ? 'px-3 py-2.5' : 'p-3') : 'px-0 py-2'
      } ${unset ? 'bg-amber-400/15 hover:bg-amber-400/25' : 'bg-white/10 hover:bg-white/15 dark:bg-dark-elevated dark:hover:bg-dark-hover'}`}
    >
      {expanded && compact && !summary && !unset ? (
        // One row on desktop, so the nav above keeps its room
        <>
          <div className="flex items-center gap-2 text-xs">
            <CalendarRange className="h-4 w-4 flex-shrink-0 text-blue-200 dark:text-dark-text-muted" />
            <span className="truncate font-semibold text-white dark:text-dark-text-primary">{term.label.replace('Semester', 'Sem')}</span>
            <span className="ml-auto whitespace-nowrap text-blue-200 dark:text-dark-text-muted">
              {current ? `${term.daysLeft}d left` : term.status === 'upcoming' ? `in ${term.daysUntilStart}d` : 'ended'}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15 dark:bg-dark-border-subtle">
            <div className="h-full rounded-full bg-yellow-400 dark:bg-dark-blue-primary" style={{ width: `${term.progress || 0}%` }} />
          </div>
        </>
      ) : expanded ? (
        <>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-blue-200/80 dark:text-dark-text-muted">
            {unset ? <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> : <CalendarRange className="h-3.5 w-3.5" />}
            Current term
          </div>
          {summary ? (
            <p className="mt-1 text-sm text-white dark:text-dark-text-primary">
              Set up for <strong>{summary.configured} of {summary.total}</strong> programs
            </p>
          ) : unset ? (
            <p className="mt-1 text-sm text-amber-100">
              {term?.academicYear} semesters aren’t set up yet
            </p>
          ) : (
            <>
              <p className="mt-1 truncate text-sm font-semibold text-white dark:text-dark-text-primary">{term.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15 dark:bg-dark-border-subtle">
                <div className="h-full rounded-full bg-yellow-400 dark:bg-dark-blue-primary" style={{ width: `${term.progress || 0}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-blue-200 dark:text-dark-text-muted">
                {current
                  ? `${term.daysLeft} days left · ${term.progress}% done`
                  : term.status === 'upcoming' ? `Starts in ${term.daysUntilStart} days` : 'Between terms'}
              </p>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-0.5 text-blue-100 dark:text-dark-text-secondary">
          {unset ? <AlertTriangle className="h-5 w-5 text-amber-300" /> : <CalendarRange className="h-5 w-5" />}
          <span className="text-[10px] font-semibold leading-tight">
            {summary ? `${summary.configured}/${summary.total}` : current ? `${term.daysLeft}d` : unset ? 'Set up' : '—'}
          </span>
        </div>
      )}
    </Link>
  );
};

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [termInfo, setTermInfo] = useState(null);
  const userMenuRef = useRef(null);
  const mobileUserMenuRef = useRef(null);
  const hoverTimer = useRef(null);

  const isStaff = STAFF.includes(user?.role);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(event.target)) {
        setMobileUserMenuOpen(false);
      }
    };

    if (userMenuOpen || mobileUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen, mobileUserMenuOpen]);

  // Collapse the hover sidebar and close menus when the route changes
  useEffect(() => {
    clearTimeout(hoverTimer.current);
    setSidebarExpanded(false);
    setUserMenuOpen(false);
    setMobileUserMenuOpen(false);
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => { writeStored(COLLAPSED_GROUPS_KEY, collapsedGroups); }, [collapsedGroups]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Escape closes the phone menu
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The page behind the phone menu shouldn't scroll
  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileSidebarOpen]);

  // Badge: faculty sign-ups waiting for approval
  const loadPending = useCallback(() => {
    if (!isStaff) return;
    facultyAPI.getPending()
      .then((res) => setPendingCount(res.data.count ?? (res.data.data || []).length))
      .catch(() => {});
  }, [isStaff]);

  const loadTerm = useCallback(() => {
    if (!isStaff) return;
    termAPI.current()
      .then((res) => setTermInfo({
        term: res.data.data,
        isSet: res.data.isSet,
        summary: res.data.perProgram ? { configured: res.data.configured, total: res.data.perProgram.length } : null,
      }))
      .catch(() => {});
  }, [isStaff]);

  useEffect(() => { loadTerm(); }, [loadTerm]);
  // Re-count after leaving the approvals page, where the count changes
  useEffect(() => { loadPending(); }, [loadPending, location.pathname]);
  useLiveRefresh(['approvals'], loadPending);
  useLiveRefresh(['term'], loadTerm);

  // Hover intent: a short delay so sweeping the pointer across the rail on
  // the way to the page doesn't fling the sidebar open
  const onSidebarEnter = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setSidebarExpanded(true), 120);
  };
  const onSidebarLeave = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setSidebarExpanded(false), 200);
  };
  // Keyboard users get the labels too: expand while focus is inside
  const onSidebarFocus = () => {
    clearTimeout(hoverTimer.current);
    setSidebarExpanded(true);
  };
  const onSidebarBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setSidebarExpanded(false);
  };

  // Get avatar URL
  const getAvatarUrl = () => {
    if (user?.profilePicture) {
      return `${process.env.REACT_APP_API_URL?.replace('/api', '')}${user.profilePicture}`;
    }
    return null;
  };

  const avatarUrl = getAvatarUrl();
  const roleLabel = ROLE_LABELS[user?.role] || user?.role?.replace(/_/g, ' ');
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  /**
   * Navigation grouped by what each destination is *for*, rather than one flat
   * list of eleven links. A group with `label: null` renders without a heading -
   * used for Dashboard, and for the short faculty/student menus where
   * categorising three items would add more chrome than it removes.
   */
  const getNavGroups = () => {
    if (isStaff) {
      return [
        {
          label: null,
          items: [{ name: 'Dashboard', path: '/dashboard', icon: Home }],
        },
        // Scheduling leads: building and publishing timetables is what the
        // system is for, so it sits closest to Dashboard.
        {
          label: 'Scheduling',
          items: [
            { name: 'Schedules', path: '/schedules', icon: Calendar },
            { name: 'Semesters', path: '/semesters', icon: CalendarRange },
            { name: 'Class Spaces', path: '/classes', icon: FileText },
          ],
        },
        {
          label: 'People',
          items: [
            { name: 'Faculty', path: '/faculty', icon: Users },
            { name: 'Pending Approvals', path: '/faculty/approvals', icon: AnimatedUserCheck, badge: pendingCount },
            { name: 'Students', path: '/students', icon: GraduationCap },
          ],
        },
        {
          label: 'Academics',
          items: [
            { name: 'Subjects', path: '/subjects', icon: BookOpen },
            { name: 'Sections', path: '/sections', icon: Layers },
            { name: 'Rooms', path: '/rooms', icon: DoorOpen },
          ],
        },
        {
          label: 'System',
          items: [
            { name: 'Faculty Analytics', path: '/faculty-analytics', icon: BarChart3 },
            { name: 'Activity Log', path: '/activity', icon: Activity },
          ],
        },
      ];
    }

    if (user?.role === 'faculty' || user?.role === 'student') {
      return [
        {
          label: null,
          items: [
            { name: 'Dashboard', path: '/dashboard', icon: Home },
            { name: 'My Classes', path: '/classes', icon: GraduationCap },
            { name: 'My Schedule', path: '/schedules', icon: Calendar },
          ],
        },
      ];
    }

    return [{ label: null, items: [{ name: 'Dashboard', path: '/dashboard', icon: Home }] }];
  };

  const navGroups = getNavGroups();
  const navItems = navGroups.flatMap(group => group.items);

  // The nav item for this page: the longest path that matches, so
  // /classes/bsit-2a highlights Class Spaces and /faculty/approvals doesn't
  // also light up Faculty.
  const matches = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const activePath = [...navItems, ...EXTRA_TITLES]
    .filter(item => matches(item.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
  const isActive = (path) => path === activePath;
  const currentPage = [...navItems, ...EXTRA_TITLES].find(item => item.path === activePath)?.name || 'Dashboard';

  /** Does this group contain the page currently being viewed? */
  const groupHasActive = (group) => group.items.some(item => isActive(item.path));

  /**
   * Whether a group's links are shown.
   *
   * Collapsed groups are stored rather than open ones, so the default - nothing
   * stored - leaves everything open and no link is hidden on first use.
   *
   * The choice applies in both widths: a group folded away while the sidebar is
   * expanded stays folded on the minimised rail, where its icons give way to a
   * chevron marking the hidden set.
   *
   * One case still overrides it - the group holding the current page, which
   * stays open so the active marker is never hidden behind a closed header.
   */
  const isGroupOpen = (group) =>
    !group.label ||
    groupHasActive(group) ||
    !collapsedGroups.includes(group.label);

  const toggleGroup = (label) =>
    setCollapsedGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );

  /** Badge total for a group, shown on its heading while it's folded. */
  const groupBadge = (group) => group.items.reduce((sum, item) => sum + (item.badge || 0), 0);

  // Desktop rows are a little tighter so every group fits a laptop screen
  // without scrolling; the phone menu keeps the larger touch targets.
  const navLinkClass = (active, compact = false) => `flex items-center gap-4 px-4 ${compact ? 'py-2' : 'py-3'} rounded-xl transition-all duration-200 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 dark:focus-visible:ring-dark-blue-primary ${
    active
      ? 'bg-yellow-400 dark:bg-dark-blue-hover text-blue-900 dark:text-white shadow-lg shadow-yellow-500/30 dark:shadow-none'
      : 'text-blue-100 dark:text-dark-text-secondary hover:bg-white/10 dark:hover:bg-dark-hover hover:text-white'
  }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#060913]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-dark-main border-b border-gray-200 dark:border-dark-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open menu"
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700 dark:text-dark-text-secondary" />
            {pendingCount > 0 && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-dark-main" />
            )}
          </button>

          <div className="flex items-center gap-3">
            <img src={ctuLogo} alt="CTU" className="w-8 h-8" />
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-dark-text-primary">CTU Daanbantayan</h1>
              <p className="text-xs text-gray-500 dark:text-dark-text-muted">{currentPage}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Notification Bell for Mobile */}
            <NotificationBell />

            {/* Profile Picture with Dropdown */}
            <div ref={mobileUserMenuRef} className="relative">
              <button
                onClick={() => setMobileUserMenuOpen(!mobileUserMenuOpen)}
                aria-label="Account menu"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-300 transition-all"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Mobile Dropdown Menu */}
              {mobileUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border-default overflow-hidden animate-fadeIn z-50">
                  <div className="py-2">
                    <Link
                      to="/profile"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                    >
                      <User className="w-5 h-5" />
                      <span className="text-sm font-medium">My Profile</span>
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                    >
                      <Settings className="w-5 h-5" />
                      <span className="text-sm font-medium">Settings</span>
                    </Link>
                    <div className="h-px bg-gray-200 dark:bg-dark-border-default my-2" />
                    <button
                      onClick={() => {
                        setMobileUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-dark-error"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Main navigation"
        onMouseEnter={onSidebarEnter}
        onMouseLeave={onSidebarLeave}
        onFocus={onSidebarFocus}
        onBlur={onSidebarBlur}
        className={`hidden lg:flex fixed top-0 left-0 h-full bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 dark:bg-none dark:bg-[#0B1120] z-40 flex-col transition-[width,box-shadow] duration-300 ease-in-out ${
          sidebarExpanded ? 'w-64' : 'w-20'
        } shadow-2xl`}
      >
        {/* Logo Section */}
        <div className="relative flex items-center py-5 px-4 border-b border-blue-500/30 dark:border-dark-border-subtle">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-0" aria-label="Dashboard">
            <div className="w-12 h-12 flex-shrink-0 bg-white/10 dark:bg-dark-blue-primary rounded-xl flex items-center justify-center backdrop-blur-sm">
              <img src={ctuLogo} alt="CTU" className="w-8 h-8" />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${
              sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              <h1 className="text-white dark:text-dark-text-primary font-bold text-base whitespace-nowrap">CTU Daanbantayan</h1>
              <p className="text-blue-200 dark:text-dark-text-muted text-xs whitespace-nowrap">
                {user?.program ? `${user.program} · Timetable` : 'Timetable System'}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navGroups.map((group, groupIndex) => {
            const open = isGroupOpen(group);
            const panelId = `nav-group-${groupIndex}`;
            const hiddenBadge = !open ? groupBadge(group) : 0;

            return (
            <div key={group.label || `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-3' : ''}>
              {/* Group heading. The rail is only 80px wide when collapsed, far
                  too narrow for a word, so the heading cross-fades into a short
                  rule that keeps the grouping legible either way. The row holds
                  a fixed height so nothing shifts as the sidebar animates. */}
              {group.label && (
                <div className="relative h-6 mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    // Only a control while the labels are actually readable;
                    // on the icon rail it is inert and invisible.
                    tabIndex={sidebarExpanded ? 0 : -1}
                    className={`absolute inset-0 flex items-center gap-2 rounded-lg px-4 text-[10px] font-semibold uppercase tracking-wider text-blue-200/80 dark:text-dark-text-muted transition-opacity duration-200 hover:text-white hover:bg-white/5 dark:hover:bg-dark-hover ${
                      sidebarExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <span className="whitespace-nowrap">{group.label}</span>
                    {hiddenBadge > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-white">{hiddenBadge}</span>
                    )}
                    <ChevronDown
                      className={`ml-auto w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                        open ? '' : '-rotate-90'
                      }`}
                    />
                  </button>
                  {/* Minimised rail. An open group is just separated by a
                      rule; a closed one shows a chevron instead, so a folded
                      category still reads as "more behind here" rather than
                      silently missing icons. */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-opacity duration-200 ${
                      sidebarExpanded ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    {open ? (
                      <span className="block h-px w-8 rounded-full bg-white/25 dark:bg-dark-border-subtle" />
                    ) : (
                      <span className="relative">
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-blue-200/70 dark:text-dark-text-muted" />
                        {hiddenBadge > 0 && <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500" />}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div
                id={panelId}
                className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${
                  open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? 'page' : undefined}
                      title={sidebarExpanded ? undefined : (item.badge ? `${item.name} (${item.badge})` : item.name)}
                      tabIndex={open ? 0 : -1}
                      className={navLinkClass(active, true)}
                    >
                      <Icon
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          active ? 'scale-110' : 'group-hover:scale-110'
                        }`}
                      />
                      <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${
                        sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                      }`}>
                        {item.name}
                      </span>
                      <NavBadge count={item.badge} expanded={sidebarExpanded} />

                      {/* Active Indicator */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 dark:bg-dark-blue-primary rounded-r-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        <TermCard info={termInfo} expanded={sidebarExpanded} compact />

        {/* User Profile */}
        <div ref={userMenuRef} className="p-4 border-t border-blue-500/30 dark:border-dark-border-subtle relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen && sidebarExpanded}
            className="flex items-center gap-3 w-full hover:bg-white/10 dark:hover:bg-dark-hover rounded-xl p-2 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 dark:bg-dark-blue-primary flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white/20 dark:ring-dark-blue-primary/30">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : initials ? (
                <span className="text-sm font-bold text-blue-900 dark:text-white">{initials}</span>
              ) : (
                <User className="w-5 h-5 text-blue-900 dark:text-white" />
              )}
            </div>
            <div className={`overflow-hidden transition-all duration-300 flex-1 min-w-0 text-left ${
              sidebarExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              <p className="text-white dark:text-dark-text-primary font-semibold text-sm whitespace-nowrap truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-blue-200 dark:text-dark-text-muted text-xs whitespace-nowrap truncate">
                {roleLabel}{user?.program ? ` · ${user.program}` : ''}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 flex-shrink-0 text-blue-200 transition-all duration-200 dark:text-dark-text-muted ${
              sidebarExpanded ? 'opacity-100' : 'w-0 opacity-0'
            } ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && sidebarExpanded && (
            <div role="menu" className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border-default overflow-hidden animate-fadeIn">
              <div className="py-2">
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">My Profile</span>
                </Link>
                <Link
                  to="/settings"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors text-gray-700 dark:text-dark-text-secondary"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">Settings</span>
                </Link>
                <div className="h-px bg-gray-200 dark:bg-dark-border-default my-2" />
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-dark-error"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileSidebarOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />

        {/* Sidebar */}
        <aside
          aria-label="Main navigation"
          className={`absolute top-0 left-0 h-full w-80 max-w-[85vw] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 dark:bg-none dark:bg-[#0B1120] shadow-2xl flex flex-col transition-transform duration-300 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-blue-500/30 dark:border-dark-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 dark:bg-dark-blue-primary rounded-xl flex items-center justify-center">
                <img src={ctuLogo} alt="CTU" className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-white dark:text-dark-text-primary font-bold text-base">CTU Daanbantayan</h1>
                <p className="text-blue-200 dark:text-dark-text-muted text-xs">Timetable System</p>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close menu"
              tabIndex={mobileSidebarOpen ? 0 : -1}
              className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-dark-hover transition-colors"
            >
              <X className="w-5 h-5 text-white dark:text-dark-text-primary" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 bg-white/5 dark:bg-dark-elevated">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 dark:bg-dark-blue-primary flex items-center justify-center overflow-hidden ring-2 ring-white/20 dark:ring-dark-blue-primary/30">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
                ) : initials ? (
                  <span className="font-bold text-blue-900 dark:text-white">{initials}</span>
                ) : (
                  <User className="w-6 h-6 text-blue-900 dark:text-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white dark:text-dark-text-primary font-semibold text-sm truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-blue-200 dark:text-dark-text-muted text-xs">
                  {roleLabel}
                </p>
                {user?.program && (
                  <p className="text-yellow-400 text-xs font-medium mt-0.5">
                    {user.program}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation. Always full width here, so the group headings are
              plain text - no collapsed rail to account for. */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {navGroups.map((group, groupIndex) => {
              const open = isGroupOpen(group);
              const panelId = `mobile-nav-group-${groupIndex}`;
              const hiddenBadge = !open ? groupBadge(group) : 0;

              return (
              <div key={group.label || `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-3' : ''}>
                {group.label && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    tabIndex={mobileSidebarOpen ? 0 : -1}
                    className="flex w-full items-center gap-2 rounded-lg px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-200/80 dark:text-dark-text-muted transition-colors hover:text-white hover:bg-white/5 dark:hover:bg-dark-hover"
                  >
                    <span>{group.label}</span>
                    {hiddenBadge > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-white">{hiddenBadge}</span>
                    )}
                    <ChevronDown
                      className={`ml-auto w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                        open ? '' : '-rotate-90'
                      }`}
                    />
                  </button>
                )}
                <div
                  id={panelId}
                  className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${
                    open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        aria-current={active ? 'page' : undefined}
                        tabIndex={mobileSidebarOpen && open ? 0 : -1}
                        onClick={() => setMobileSidebarOpen(false)}
                        className={navLinkClass(active)}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium text-sm">{item.name}</span>
                        <NavBadge count={item.badge} expanded />
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 dark:bg-dark-blue-primary rounded-r-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
              );
            })}
            <div className="-mx-3 mt-4">
              <TermCard info={termInfo} expanded onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-blue-500/30 dark:border-dark-border-subtle space-y-2">
            <Link
              to="/profile"
              onClick={() => setMobileSidebarOpen(false)}
              tabIndex={mobileSidebarOpen ? 0 : -1}
              className={navLinkClass(isActive('/profile'))}
            >
              <User className="w-5 h-5" />
              <span className="text-sm font-medium">My Profile</span>
            </Link>
            <Link
              to="/settings"
              onClick={() => setMobileSidebarOpen(false)}
              tabIndex={mobileSidebarOpen ? 0 : -1}
              className={navLinkClass(isActive('/settings'))}
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              tabIndex={mobileSidebarOpen ? 0 : -1}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-300 dark:text-dark-error hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Main Content. Moves over while the sidebar is open, so the page
          resizes to the space left rather than sitting underneath it. */}
      <main className={`min-h-screen transition-[margin] duration-300 ease-in-out ${
        sidebarExpanded ? 'lg:ml-64' : 'lg:ml-20'
      }`}>
        {/* Page Header - Desktop */}
        <div className="hidden lg:block sticky top-0 z-30 bg-white dark:bg-dark-main border-b border-gray-200 dark:border-dark-border-subtle backdrop-blur-sm bg-white/80 dark:bg-dark-main/80">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                {currentPage}
              </h1>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted mt-1">
                {user?.program ? `${user.program} Program` : 'Management System'}
              </p>
            </div>

            {/* Theme switch + notification bell */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-4 lg:p-8 pt-20 lg:pt-4">
          {children}
        </div>
      </main>

      {/* AI Chat Bubble */}
      {/* Staff get the data assistant; students get B-LO in help mode (no records) */}
      {['admin', 'scheduling_officer', 'program_manager', 'student'].includes(user?.role) && (
        <AIChatBubble key={user?._id} />
      )}

      {/* Custom Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Layout;
