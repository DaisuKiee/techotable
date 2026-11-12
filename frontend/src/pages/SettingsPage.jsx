import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Layout from '../components/Layout';
import { authAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import {
  Settings, Bell, Palette, Shield, Key, Mail, CheckCircle, AlertCircle, Info,
  Moon, Sun, Monitor, Eye, EyeOff, Check, Loader2, Phone, Calendar, BookOpen,
  Megaphone, AlertTriangle, Newspaper, UserCircle, Clock, BadgeCheck, X,
  Smartphone, LogOut, ShieldCheck, ShieldAlert, History, RefreshCw, AlarmClock, ChevronRight,
  Fingerprint,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import ClassReminderPrompt from '../components/ClassReminderPrompt';
import TwoFactorSettings from '../components/settings/TwoFactorSettings';

/* ---------- Reusable UI pieces ---------- */

const inputCls =
  'w-full px-4 py-2.5 bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text-primary border border-gray-300 dark:border-dark-border-default rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-shadow';

const STAFF = ['admin', 'scheduling_officer', 'program_manager'];

const ROLE_LABELS = {
  admin: 'Administrator',
  scheduling_officer: 'Scheduling Officer',
  program_manager: 'Program Manager',
  faculty: 'Faculty',
  student: 'Student',
};

const TAB_KEY = 'settingsActiveTab';

/**
 * Which tab to open on.
 *
 * `?tab=` wins over the remembered one, so a link from the two-step banner,
 * a reminder notification or a reminder e-mail lands on the thing it is
 * asking the person to do rather than on whatever they looked at last.
 */
const readTab = () => {
  try {
    const asked = new URLSearchParams(window.location.search).get('tab');
    if (asked) return asked;
  } catch {
    /* no query string available; fall through to the remembered tab */
  }
  try {
    return localStorage.getItem(TAB_KEY) || 'account';
  } catch {
    return 'account';
  }
};

const formatDate = (value, withTime = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
};

/** "5 minutes ago", "yesterday", or a date for older times. */
const timeAgo = (value) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
};

const isPhone = (device = '') => /Android|iOS/.test(device);

const NETWORK_LABEL = { internet: 'Internet', 'local network': 'Local network', 'this computer': 'This computer' };

/** "IP 122.54.97.10 · Internet": the device's address and where it connected from. */
const ipText = (ip, network) => {
  if (!ip) return 'IP not recorded';
  const shown = /^127\./.test(ip) ? 'this computer (localhost)' : ip;
  return `IP ${shown}${network && !/^127\./.test(ip) ? ` · ${NETWORK_LABEL[network] || network}` : ''}`;
};

/** What each failed sign-in reason means, in plain words. */
const LOGIN_REASONS = {
  ok: 'Signed in',
  bad_password: 'Wrong password',
  locked: 'Blocked: too many failed attempts',
  inactive: 'Blocked: account deactivated',
  unverified: 'Blocked: email not verified',
};

/** On/off switch. A real button with role="switch", so it works with the keyboard. */
const Toggle = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-40 ${
      checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
    }`}
  >
    <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 dark:bg-white ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
  </button>
);

const SettingRow = ({ icon: Icon, title, description, checked, onChange, disabled, note }) => (
  <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
    disabled
      ? 'border-gray-100 bg-gray-50/50 dark:border-dark-border-subtle dark:bg-dark-elevated/30'
      : 'border-gray-100 bg-gray-50/70 hover:border-blue-200 dark:border-dark-border-subtle dark:bg-dark-elevated/60 dark:hover:border-blue-800'
  }`}
  >
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <div className="rounded-lg border border-gray-100 bg-white p-2 dark:border-dark-border-subtle dark:bg-dark-card">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      )}
      <div className="min-w-0">
        <h4 className={`font-medium ${disabled ? 'text-gray-400 dark:text-dark-text-muted' : 'text-gray-900 dark:text-dark-text-primary'}`}>{title}</h4>
        <p className="text-sm text-gray-500 dark:text-dark-text-muted">{description}</p>
        {note && <p className="mt-1 text-xs text-orange-700 dark:text-orange-400">{note}</p>}
      </div>
    </div>
    <Toggle checked={!!checked} onChange={onChange} label={title} disabled={disabled} />
  </div>
);

const SectionHeader = ({ title, subtitle, right }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-dark-border-subtle">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">{title}</h2>
      <p className="mt-1 text-gray-500 dark:text-dark-text-muted">{subtitle}</p>
    </div>
    {right}
  </div>
);

const SubHeading = ({ icon: Icon, children, hint }) => (
  <div className="mb-3">
    <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-dark-text-primary">
      {Icon && <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
      {children}
    </h3>
    {hint && <p className="mt-0.5 text-sm text-gray-500 dark:text-dark-text-muted">{hint}</p>}
  </div>
);

/** "Saving…" / "Saved" next to a section's title, for switches that save on their own. */
const SaveState = ({ state }) => {
  if (state === 'idle') return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      state === 'saving'
        ? 'bg-gray-100 text-gray-600 dark:bg-dark-elevated dark:text-dark-text-secondary'
        : state === 'error'
          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    }`}
    role="status"
    >
      {state === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
      {state === 'saved' && <><Check className="h-3.5 w-3.5" /> Saved</>}
      {state === 'error' && <><AlertCircle className="h-3.5 w-3.5" /> Not saved</>}
    </span>
  );
};

const PasswordField = ({ id, label, value, onChange, autoComplete, describedBy }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-secondary">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          className={`${inputCls} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

const MIN_PASSWORD = 6;

/** Each rule is shown as a checklist under the new password. */
const passwordRules = (pw, current) => [
  { label: `At least ${MIN_PASSWORD} characters`, ok: pw.length >= MIN_PASSWORD, required: true },
  { label: 'Different from your current password', ok: !!pw && pw !== current, required: true },
  { label: 'Upper and lower case letters', ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
  { label: 'A number or symbol', ok: /[\d\W_]/.test(pw) },
  { label: '10 characters or more', ok: pw.length >= 10 },
];

const strengthMeta = [
  { label: 'Too weak', color: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { label: 'Weak', color: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { label: 'Fair', color: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400' },
  { label: 'Good', color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
];

/* ---------- Page ---------- */

const DEFAULT_NOTIFICATIONS = {
  emailNotifications: true,
  scheduleUpdates: true,
  facultyAssignments: true,
  systemAlerts: true,
  classPosts: true,
  weeklyDigest: false,
  classReminders: true,
};

const DEFAULT_PRIVACY = { showEmail: false, showPhone: false };

const SettingsPage = () => {
  const { user, setAuth } = useAuth();
  const { theme, language, timezone, updateTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(readTab);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [securityForm, setSecurityForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [privacy, setPrivacy] = useState(DEFAULT_PRIVACY);
  const [saveState, setSaveState] = useState({ notifications: 'idle', appearance: 'idle', privacy: 'idle' });
  const savedTimer = useRef({});

  const [sessions, setSessions] = useState(null); // null = loading
  const [sessionsTracked, setSessionsTracked] = useState(true);
  const [activity, setActivity] = useState(null);
  const [failedToday, setFailedToday] = useState(0);
  const [busySession, setBusySession] = useState(null); // session id or 'others'
  const [confirmOthers, setConfirmOthers] = useState(false);

  const role = user?.role;
  const isStaff = STAFF.includes(role);
  const isFaculty = role === 'faculty';
  const isStudent = role === 'student';

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, activeTab); } catch { /* not remembered; that's fine */ }
  }, [activeTab]);

  useEffect(() => () => Object.values(savedTimer.current).forEach(clearTimeout), []);

  // Load saved settings
  useEffect(() => {
    authAPI.getSettings()
      .then((res) => {
        const s = res.data.data || {};
        setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(s.notifications || {}) });
        setPrivacy({ ...DEFAULT_PRIVACY, showEmail: !!s.privacy?.showEmail, showPhone: !!s.privacy?.showPhone });
      })
      .catch((error) => toast.error(getErrorMessage(error, 'Could not load your settings. Showing the defaults.')))
      .finally(() => setSettingsLoaded(true));
  }, []);

  const loadSecurity = useCallback(() => {
    authAPI.getSessions()
      .then((res) => { setSessions(res.data.data || []); setSessionsTracked(res.data.currentTracked !== false); })
      .catch(() => setSessions([]));
    authAPI.getLoginActivity()
      .then((res) => { setActivity(res.data.data || []); setFailedToday(res.data.failedToday || 0); })
      .catch(() => setActivity([]));
  }, []);

  useEffect(() => { loadSecurity(); }, [loadSecurity]);

  /** A fresh token for this device (after signing others out or a new password). */
  const keepSignedIn = (token) => {
    if (token) setAuth(user, token);
  };

  const signOutSession = async (id) => {
    setBusySession(id);
    try {
      await authAPI.revokeSession(id);
      toast.success('Device signed out');
      setSessions((list) => (list || []).filter((s) => s._id !== id));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign out that device.'));
    } finally {
      setBusySession(null);
    }
  };

  const signOutOthers = async () => {
    setConfirmOthers(false);
    setBusySession('others');
    try {
      const res = await authAPI.revokeOtherSessions();
      keepSignedIn(res.data.data?.token);
      toast.success(res.data.message || 'Other devices signed out');
      loadSecurity();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign out other devices.'));
    } finally {
      setBusySession(null);
    }
  };

  /**
   * Switches save as soon as they're flipped (no Save button to forget).
   * The change shows at once and is rolled back if the server refuses it.
   */
  const saveGroup = async (group, next, previous, setter) => {
    setter(next);
    clearTimeout(savedTimer.current[group]);
    setSaveState((s) => ({ ...s, [group]: 'saving' }));
    try {
      await authAPI.updateSettings({ [group]: next });
      setSaveState((s) => ({ ...s, [group]: 'saved' }));
      savedTimer.current[group] = setTimeout(() => setSaveState((s) => ({ ...s, [group]: 'idle' })), 2500);
    } catch (error) {
      setter(previous);
      setSaveState((s) => ({ ...s, [group]: 'error' }));
      toast.error(getErrorMessage(error, 'Could not save that change. Try again.'));
    }
  };

  const setNotification = (key, value) => saveGroup('notifications', { ...notifications, [key]: value }, notifications, setNotifications);
  const setPrivacyValue = (key, value) => saveGroup('privacy', { ...privacy, [key]: value }, privacy, setPrivacy);

  // Theme applies immediately; saving follows it to other devices
  const chooseTheme = async (next) => {
    if (next === theme) return;
    const previous = theme;
    updateTheme(next);
    setSaveState((s) => ({ ...s, appearance: 'saving' }));
    try {
      await authAPI.updateSettings({ appearance: { theme: next, language, timezone } });
      setSaveState((s) => ({ ...s, appearance: 'saved' }));
      clearTimeout(savedTimer.current.appearance);
      savedTimer.current.appearance = setTimeout(() => setSaveState((s) => ({ ...s, appearance: 'idle' })), 2500);
    } catch (error) {
      updateTheme(previous);
      setSaveState((s) => ({ ...s, appearance: 'error' }));
      toast.error(getErrorMessage(error, 'Could not save your theme.'));
    }
  };

  const rules = passwordRules(securityForm.newPassword, securityForm.currentPassword);
  const strength = Math.min(4, rules.filter((r) => r.ok).length - (securityForm.newPassword ? 1 : 0));
  const requiredOk = rules.filter((r) => r.required).every((r) => r.ok);
  const passwordsMatch = !!securityForm.confirmPassword && securityForm.newPassword === securityForm.confirmPassword;
  const passwordsMismatch = !!securityForm.confirmPassword && securityForm.newPassword !== securityForm.confirmPassword;
  const canSubmitPassword = securityForm.currentPassword && requiredOk && passwordsMatch && !changingPassword;

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!canSubmitPassword) return;
    setChangingPassword(true);
    try {
      const res = await authAPI.changePassword({
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
      });
      // The new password ends every older sign-in; this device keeps going
      keepSignedIn(res.data.data?.token);
      toast.success(res.data.message || 'Password changed.');
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      loadSecurity();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not change your password.'));
    } finally {
      setChangingPassword(false);
    }
  };

  // Settings grouped by category, so no single page grows into a long scroll
  const groups = [
    {
      label: 'Account',
      items: [
        { id: 'account', label: 'Overview', icon: UserCircle },
        { id: 'password', label: 'Password', icon: Key },
        { id: 'twofactor', label: 'Two-step verification', icon: Fingerprint },
        { id: 'devices', label: 'Devices', icon: Monitor, count: sessions?.length || null },
        { id: 'activity', label: 'Sign-in activity', icon: History, count: failedToday || null, alert: failedToday > 0 },
      ],
    },
    {
      label: 'Preferences',
      items: [
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Appearance', icon: Palette },
      ],
    },
    {
      label: 'Privacy',
      items: [{ id: 'privacy', label: 'Contact info', icon: Shield }],
    },
  ];
  const tabs = groups.flatMap((g) => g.items);
  // 'security' was the old all-in-one tab; land on the overview instead
  const tab = tabs.some((t) => t.id === activeTab) ? activeTab : 'account';

  // Only the notices this role actually gets
  const appNotifications = [
    {
      key: 'scheduleUpdates', icon: Calendar, title: 'Schedule changes',
      description: isStudent ? 'When one of your classes is added, moved, or cancelled.' : 'When a class you teach or follow is moved or changed.',
      show: isStudent || isFaculty,
    },
    {
      key: 'facultyAssignments', icon: BookOpen, title: 'Teaching assignments',
      description: 'When a class is assigned to you, or moved to another teacher.',
      show: isFaculty,
    },
    {
      key: 'classReminders', icon: AlarmClock, title: 'Class reminders',
      description: 'Your classes for the day each morning, and a heads-up 15 minutes before each class starts.',
      show: isFaculty,
    },
    {
      key: 'classPosts', icon: Megaphone, title: 'Announcements & materials',
      description: 'When a new announcement or material is posted in one of your classes.',
      show: isStudent,
    },
    {
      key: 'systemAlerts', icon: AlertTriangle, title: 'Account requests & system alerts',
      description: 'Faculty sign-ups waiting for approval, and semester changes.',
      show: isStaff,
    },
  ].filter((n) => n.show);

  const emailOff = !notifications.emailNotifications;

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun, iconCls: 'text-yellow-500', preview: 'bg-white border-gray-200', bar: 'bg-gray-200' },
    { id: 'dark', label: 'Dark', icon: Moon, iconCls: 'text-blue-500', preview: 'bg-gray-800 border-gray-700', bar: 'bg-gray-600' },
    { id: 'system', label: 'Match my device', icon: Monitor, iconCls: 'text-gray-500', preview: 'bg-gradient-to-r from-white to-gray-800 border-gray-300', bar: 'bg-gray-400' },
  ];

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatar = user?.profilePicture ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${user.profilePicture}` : null;

  // Real account state, instead of an always-green card
  const verified = user?.isEmailVerified !== false || !isStudent; // only students verify by email
  const accountOk = user?.isActive !== false && verified;

  const accountDetails = [
    { icon: Mail, label: 'Email (your username)', value: user?.email },
    { icon: UserCircle, label: 'Role', value: `${ROLE_LABELS[role] || role || '—'}${user?.program ? ` · ${user.program}` : ''}` },
    { icon: BadgeCheck, label: 'Email verified', value: isStudent ? (user?.isEmailVerified ? 'Yes' : 'Not yet') : 'Not needed for staff and faculty' },
    { icon: Calendar, label: 'Member since', value: formatDate(user?.createdAt) },
    { icon: Clock, label: 'Last sign-in', value: formatDate(user?.lastLogin, true) },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-3 shadow-lg shadow-blue-600/20">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-dark-text-primary">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">Your password, notifications, theme and privacy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <aside className="space-y-4 self-start lg:sticky lg:top-24 lg:col-span-1">
            {/* Profile summary */}
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-200 dark:border-dark-border-subtle dark:bg-dark-card dark:hover:border-blue-800"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-600 font-semibold text-white">
                {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials || 'U'}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-dark-text-primary">{displayName}</p>
                <p className="truncate text-xs text-gray-500 dark:text-dark-text-muted">Edit profile →</p>
              </div>
            </Link>

            {/* Categories: one select on phones, grouped list on larger screens */}
            <label className="block lg:hidden">
              <span className="sr-only">Settings section</span>
              <select
                value={tab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-dark-border-subtle dark:bg-dark-card dark:text-dark-text-primary"
              >
                {groups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <nav
              className="hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-dark-border-subtle dark:bg-dark-card lg:block"
              role="tablist"
              aria-label="Settings sections"
              aria-orientation="vertical"
            >
              {groups.map((g, gi) => (
                <div key={g.label} className={gi ? 'mt-2 border-t border-gray-100 pt-2 dark:border-dark-border-subtle' : ''}>
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-text-muted">{g.label}</p>
                  {g.items.map(({ id, label, icon: Icon, count, alert }) => {
                    const active = tab === id;
                    return (
                      <button
                        key={id}
                        id={`tab-${id}`}
                        role="tab"
                        aria-selected={active}
                        aria-controls={`panel-${id}`}
                        onClick={() => setActiveTab(id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          active
                            ? 'bg-blue-600 font-semibold text-white shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:bg-dark-hover'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {count ? (
                          <span className={`rounded-full px-1.5 text-[11px] font-semibold ${
                            active ? 'bg-white/25 text-white'
                              : alert ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-dark-elevated dark:text-dark-text-secondary'
                          }`}
                          >
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Account status */}
            <div className={`rounded-2xl border p-4 ${
              accountOk
                ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-50 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-emerald-900/20'
                : 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
            }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                {accountOk
                  ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  : <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">
                  {accountOk ? 'Account active' : verified ? 'Account inactive' : 'Email not verified'}
                </h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-dark-text-secondary">
                {accountOk
                  ? `Signed in as ${ROLE_LABELS[role] || role}${user?.program ? ` (${user.program})` : ''}.`
                  : verified
                    ? 'Contact the scheduling office to reactivate it.'
                    : 'Check your inbox for the verification link.'}
              </p>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-dark-border-subtle dark:bg-dark-card sm:p-8">

              {/* Account overview */}
              {tab === 'account' && (
                <div role="tabpanel" id="panel-account" aria-labelledby="tab-account">
                  <SectionHeader title="Account" subtitle="Who you are signed in as, and the state of your account." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-5 dark:border-dark-border-subtle dark:bg-dark-elevated/60">
                      <SubHeading icon={UserCircle}>Details</SubHeading>
                      <dl className="space-y-3">
                        {accountDetails.map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                            <div className="min-w-0">
                              <dt className="text-xs text-gray-500 dark:text-dark-text-muted">{label}</dt>
                              <dd className="break-words text-sm font-medium text-gray-900 dark:text-dark-text-primary">{value || '—'}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                        <Info className="h-4 w-4 shrink-0" />
                        After 5 wrong passwords, sign-in is locked for 15 minutes and you’re notified.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {[
                        { id: 'password', icon: Key, title: 'Password', text: 'Change the password you sign in with.' },
                        { id: 'twofactor', icon: Fingerprint, title: 'Two-step verification', text: 'Fingerprint, an authenticator app or emailed codes.' },
                        { id: 'devices', icon: Monitor, title: 'Devices', text: sessions ? `${sessions.length} device${sessions.length === 1 ? '' : 's'} signed in.` : 'Devices signed in to your account.' },
                        { id: 'activity', icon: History, title: 'Sign-in activity', text: failedToday ? `${failedToday} failed sign-in${failedToday === 1 ? '' : 's'} in the last 24 hours.` : 'Recent attempts to sign in.' },
                      ].map(({ id, icon: Icon, title, text }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveTab(id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-dark-border-subtle dark:hover:border-blue-800 dark:hover:bg-blue-900/10"
                        >
                          <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><Icon className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-gray-900 dark:text-dark-text-primary">{title}</span>
                            <span className={`block text-sm ${id === 'activity' && failedToday ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-dark-text-muted'}`}>{text}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Password */}
              {tab === 'password' && (
                <div role="tabpanel" id="panel-password" aria-labelledby="tab-password">
                  <SectionHeader title="Password" subtitle="Use at least 8 characters. Other devices stay signed in until you sign them out." />
                  <div className="max-w-xl">
                      <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
                        <PasswordField
                          id="currentPassword"
                          label="Current password"
                          autoComplete="current-password"
                          value={securityForm.currentPassword}
                          onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                        />
                        <div>
                          <PasswordField
                            id="newPassword"
                            label="New password"
                            autoComplete="new-password"
                            describedBy="password-rules"
                            value={securityForm.newPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                          />
                          {securityForm.newPassword && (
                            <div className="mt-2">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthMeta[Math.max(strength, 0)].color : 'bg-gray-200 dark:bg-gray-700'}`} />
                                ))}
                              </div>
                              <p className={`mt-1 text-xs font-medium ${strengthMeta[Math.max(strength, 0)].text}`}>
                                {strengthMeta[Math.max(strength, 0)].label}
                              </p>
                            </div>
                          )}
                          <ul id="password-rules" className="mt-2 grid gap-1 sm:grid-cols-2">
                            {rules.map((r) => (
                              <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-dark-text-muted'}`}>
                                {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
                                {r.label}{r.required ? '' : ' (recommended)'}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <PasswordField
                            id="confirmPassword"
                            label="Confirm new password"
                            autoComplete="new-password"
                            value={securityForm.confirmPassword}
                            onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                          />
                          {passwordsMatch && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> Passwords match</p>
                          )}
                          {passwordsMismatch && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> Passwords don’t match</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <button
                            type="submit"
                            disabled={!canSubmitPassword}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-dark-card"
                          >
                            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                            {changingPassword ? 'Changing…' : 'Change password'}
                          </button>
                          <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                            Forgot your current password?
                          </Link>
                        </div>
                      </form>
                  </div>
                </div>
              )}

              {/* Devices */}
              {tab === 'twofactor' && <TwoFactorSettings />}

              {tab === 'devices' && (
                <div role="tabpanel" id="panel-devices" aria-labelledby="tab-devices">
                  <SectionHeader
                    title="Devices"
                    subtitle="Devices signed in to your account right now. Sign out any you don’t recognise."
                    right={(
                      <>
                        {sessions && sessions.filter((x) => !x.current).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setConfirmOthers(true)}
                          disabled={busySession === 'others'}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          {busySession === 'others' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                          Sign out all other devices
                        </button>
                      )}
                      </>
                    )}
                  />
                    {!sessionsTracked && (
                      <p className="mb-3 rounded-lg bg-orange-50 p-3 text-xs text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                        This browser signed in before device tracking started, so it isn’t listed. Sign out and back in to see it here.
                      </p>
                    )}
                    {sessions === null ? (
                      <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                    ) : sessions.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-dark-text-muted">No other devices are signed in.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-dark-border-subtle dark:border-dark-border-subtle">
                        {sessions.map((sess) => {
                          const Icon = isPhone(sess.device) ? Smartphone : Monitor;
                          return (
                            <li key={sess._id} className="flex flex-wrap items-center gap-3 p-4">
                              <div className={`rounded-lg p-2 ${sess.current ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-dark-elevated dark:text-dark-text-secondary'}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-dark-text-primary">
                                  {sess.device}
                                  {sess.current && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">This device</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-dark-text-muted">
                                  <span className="font-medium text-gray-700 dark:text-dark-text-secondary" title="The device's IP address">{ipText(sess.ip, sess.network)}</span>
                                  {' · '}{sess.current ? 'Active now' : `Last active ${timeAgo(sess.lastSeenAt)}`} · Signed in {formatDate(sess.createdAt)}
                                </p>
                              </div>
                              {!sess.current && (
                                <button
                                  type="button"
                                  onClick={() => signOutSession(sess._id)}
                                  disabled={busySession === sess._id}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50 dark:text-dark-text-secondary dark:hover:bg-dark-hover"
                                >
                                  {busySession === sess._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                  Sign out
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  
                </div>
              )}

              {/* Sign-in activity */}
              {tab === 'activity' && (
                <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
                  <SectionHeader
                    title="Sign-in activity"
                    subtitle="The last 15 attempts to sign in to your account."
                    right={<button type="button" onClick={loadSecurity} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:bg-dark-hover">
                        <RefreshCw className="h-4 w-4" /> Refresh
                      </button>}
                  />
                    {failedToday > 0 && (
                      <div className="mb-3 flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-200">
                        <ShieldAlert className="h-5 w-5 shrink-0" />
                        <span>
                          <strong>{failedToday} failed sign-in{failedToday === 1 ? '' : 's'}</strong> in the last 24 hours.
                          If these weren’t you, change your password and sign out all other devices.
                        </span>
                      </div>
                    )}
                    {activity === null ? (
                      <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                    ) : activity.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-dark-text-muted">No sign-ins recorded yet. New sign-ins appear here.</p>
                    ) : (
                      <ul className="space-y-2">
                        {activity.map((ev) => (
                          <li key={ev._id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-elevated/60">
                            {ev.success
                              ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                              : <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium ${ev.success ? 'text-gray-900 dark:text-dark-text-primary' : 'text-red-700 dark:text-red-300'}`}>
                                {LOGIN_REASONS[ev.reason] || (ev.success ? 'Signed in' : 'Failed sign-in')}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-dark-text-muted">{ev.device} · {ipText(ev.ip, ev.network)}</p>
                            </div>
                            <time className="shrink-0 text-xs text-gray-500 dark:text-dark-text-muted" dateTime={ev.createdAt} title={formatDate(ev.createdAt, true)}>
                              {timeAgo(ev.createdAt)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    )}

                </div>
              )}

              {/* Notifications */}
              {tab === 'notifications' && (
                <div role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications">
                  <SectionHeader
                    title="Notifications"
                    subtitle="Choose what you’re told about. Changes save automatically."
                    right={<SaveState state={saveState.notifications} />}
                  />
                  {!settingsLoaded ? (
                    <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                  ) : (
                    <div className="space-y-8">
                      <div>
                        <SubHeading icon={Bell} hint="Shown in the bell at the top of the page, as they happen.">In the app</SubHeading>
                        {appNotifications.length ? (
                          <div className="space-y-3">
                            {appNotifications.map(({ key, icon, title, description }) => (
                              <SettingRow
                                key={key}
                                icon={icon}
                                title={title}
                                description={description}
                                checked={notifications[key]}
                                onChange={(v) => setNotification(key, v)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">There are no optional notifications for your role.</p>
                        )}
                        {isFaculty && (
                          <div className="mt-3">
                            <ClassReminderPrompt variant="row" />
                          </div>
                        )}
                        <p className="mt-3 text-xs text-gray-500 dark:text-dark-text-muted">
                          Important account messages, like your account being approved, are always sent.
                        </p>
                      </div>

                      <div>
                        <SubHeading icon={Mail} hint={`Sent to ${user?.email || 'your school email'}.`}>Email</SubHeading>
                        <div className="space-y-3">
                          <SettingRow
                            icon={Mail}
                            title="Email me too"
                            description="Also send the notifications above by email. Off means in-app only."
                            checked={notifications.emailNotifications}
                            onChange={(v) => setNotification('emailNotifications', v)}
                          />
                          <SettingRow
                            icon={Newspaper}
                            title="Weekly summary"
                            description="One email every Monday morning listing the past week’s notifications."
                            checked={notifications.weeklyDigest && !emailOff}
                            disabled={emailOff}
                            note={emailOff ? 'Turn on “Email me too” to get the weekly summary.' : null}
                            onChange={(v) => setNotification('weeklyDigest', v)}
                          />
                        </div>
                        <p className="mt-3 text-xs text-gray-500 dark:text-dark-text-muted">
                          Password resets and email verification are always sent.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Appearance */}
              {tab === 'appearance' && (
                <div role="tabpanel" id="panel-appearance" aria-labelledby="tab-appearance">
                  <SectionHeader
                    title="Appearance"
                    subtitle="Pick a theme. It changes right away and follows you to other devices."
                    right={<SaveState state={saveState.appearance} />}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
                    {themeOptions.map(({ id, label, icon: Icon, iconCls, preview, bar }) => {
                      const selected = theme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => chooseTheme(id)}
                          className={`relative rounded-xl border-2 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            selected
                              ? 'border-blue-600 bg-blue-50 shadow-sm dark:bg-blue-900/20'
                              : 'border-gray-200 hover:border-gray-300 dark:border-dark-border-default dark:hover:border-dark-border-strong'
                          }`}
                        >
                          {selected && (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          <div className={`mb-3 flex h-14 flex-col gap-1.5 rounded-lg border p-2 ${preview}`}>
                            <div className={`h-2 w-2/3 rounded ${bar}`} />
                            <div className={`h-2 w-1/2 rounded ${bar}`} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${iconCls}`} />
                            <p className="font-medium text-gray-900 dark:text-dark-text-primary">{label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-sm text-gray-500 dark:text-dark-text-muted">
                    Tip: the sun/moon button at the top of every page switches between light and dark too.
                  </p>
                </div>
              )}

              {/* Privacy */}
              {tab === 'privacy' && (
                <div role="tabpanel" id="panel-privacy" aria-labelledby="tab-privacy">
                  <SectionHeader
                    title="Privacy"
                    subtitle="Control who can see your contact details."
                    right={isFaculty && <SaveState state={saveState.privacy} />}
                  />
                  {isFaculty ? (
                    !settingsLoaded ? (
                      <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <SubHeading hint="Students in your classes see these on the class page, under People.">Shared with your students</SubHeading>
                          <div className="space-y-3">
                            <SettingRow
                              icon={Mail}
                              title="Show my email"
                              description={user?.email ? `Students can see ${user.email}.` : 'Students can see your school email.'}
                              checked={privacy.showEmail}
                              onChange={(v) => setPrivacyValue('showEmail', v)}
                            />
                            <SettingRow
                              icon={Phone}
                              title="Show my phone number"
                              description={user?.phoneNumber ? `Students can see ${user.phoneNumber}.` : 'Students can see the phone number on your profile.'}
                              note={!user?.phoneNumber ? 'You haven’t added a phone number yet. Add one on your profile.' : null}
                              checked={privacy.showPhone}
                              onChange={(v) => setPrivacyValue('showPhone', v)}
                            />
                          </div>
                        </div>
                        <PrivacyNote />
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      <div className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-dark-border-subtle dark:bg-dark-elevated/60">
                        <Shield className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="text-sm text-gray-700 dark:text-dark-text-secondary">
                          <p className="font-medium text-gray-900 dark:text-dark-text-primary">Your contact details stay private</p>
                          <p className="mt-1">
                            {isStudent
                              ? 'Classmates never see your email or phone number. Only your teachers and the school’s staff can.'
                              : 'Your email and phone number are only visible to other staff.'}
                          </p>
                        </div>
                      </div>
                      <PrivacyNote />
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmOthers}
        title="Sign out all other devices?"
        message="Every other browser and phone signed in to your account will be signed out. You stay signed in here."
        confirmText="Sign them out"
        type="warning"
        footnote={null}
        onConfirm={signOutOthers}
        onClose={() => setConfirmOthers(false)}
      />
    </Layout>
  );
};

const PrivacyNote = () => (
  <p className="flex gap-2 text-xs text-gray-500 dark:text-dark-text-muted">
    <Info className="h-4 w-4 shrink-0" />
    The scheduling office and administrators can always see your contact details, so they can reach you about your classes.
  </p>
);

export default SettingsPage;
