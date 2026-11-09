import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import { activityLogAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import {
  Activity, Download, RefreshCw, XCircle, AlertTriangle, CheckCircle2, Search, ChevronLeft,
  ChevronRight, ChevronDown, X, Globe, Monitor, Timer, Hash, CalendarDays,
} from 'lucide-react';

const PAGE_SIZE = 50;

/* ---------- Words ---------- */

const NOUN = {
  schedule: 'a class schedule', subject: 'a subject', section: 'a section', room: 'a room', faculty: 'a faculty record',
  student: 'a student', user: 'a user account', classSpace: 'a class space', announcement: 'an announcement',
  material: 'a class file', program: 'a program', term: 'a semester', notification: 'notifications', ai: 'AI tools',
  import: 'an import', auth: 'their account', system: 'the system',
};
const AREA = {
  schedule: 'Schedules', subject: 'Subjects', section: 'Sections', room: 'Rooms', faculty: 'Faculty', student: 'Students',
  user: 'Users', classSpace: 'Class spaces', announcement: 'Announcements', material: 'Class files', program: 'Programs',
  term: 'Semesters', notification: 'Notifications', ai: 'AI', import: 'Imports', auth: 'Account', system: 'Other',
  'analyze-subject-compatibility': 'AI matching', 'background-summary': 'AI summaries',
};

/* Specific endpoints read better as their own sentence */
const SPECIAL = [
  [/\/publish$/, 'published schedules'],
  [/\/unpublish$/, 'withdrew published schedules'],
  [/batch-delete$/, (r) => `deleted several ${(AREA[r] || 'items').toLowerCase()}`],
  [/home-rooms/, 'assigned home rooms to sections'],
  [/assign-section$/, 'moved a student to a section'],
  [/\/restore$/, (r) => `restored ${NOUN[r] || 'an item'}`],
  [/(re)?generate-code$/, 'generated a new join code'],
  [/\/join$/, 'joined a class with a code'],
  [/accept-terms$/, 'accepted the terms of use'],
  [/change-password$/, 'changed their password'],
  [/\/profile$/, 'updated their profile'],
  [/\/settings$/, 'changed their settings'],
  [/faculty-invite/, 'invited a faculty member'],
  [/analyze-subject-compatibility$/, 'ran an AI subject match for a teacher'],
  [/recommend-faculty$/, 'asked AI to recommend teachers'],
  [/check-conflicts$/, 'checked a class for conflicts'],
  [/school-year\/preview$/, 'previewed a new school year'],
  [/school-year$/, 'started a new school year'],
  [/save-preview$/, 'saved a generated timetable'],
  [/\/preview$/, 'previewed a generated timetable'],
  [/\/leave$/, 'left a class'],
];

const VERB = {
  create: 'created', update: 'updated', delete: 'deleted', read: 'looked up', login: 'signed in', logout: 'signed out',
  register: 'signed up', schedule_generate: 'generated a timetable', schedule_publish: 'published schedules',
  schedule_export: 'exported schedules', faculty_assign: 'assigned a teacher', faculty_workload_update: 'updated a teaching load',
  faculty_ai_analysis: 'ran an AI analysis', student_enroll: 'enrolled a student', student_bulk_import: 'imported students',
  announcement_post: 'posted an announcement', material_upload: 'uploaded a class file', settings_update: 'changed their settings',
  data_export: 'exported data', data_import: 'imported data',
};
const OBJECTLESS = new Set(['login', 'logout', 'register', 'schedule_generate', 'schedule_publish', 'schedule_export', 'faculty_assign',
  'faculty_workload_update', 'faculty_ai_analysis', 'student_enroll', 'student_bulk_import', 'announcement_post',
  'material_upload', 'settings_update', 'data_export', 'data_import']);

/** "updated a section", "published schedules"... */
const describe = (log) => {
  if (log.details?.description) return log.details.description;
  const path = log.details?.path || '';
  const hit = SPECIAL.find(([re]) => re.test(path));
  if (hit) return typeof hit[1] === 'function' ? hit[1](log.resource) : hit[1];
  const verb = VERB[log.action] || log.action.replace(/_/g, ' ');
  if (OBJECTLESS.has(log.action)) return verb;
  return log.resource === 'system' ? `${verb} something` : `${verb} ${NOUN[log.resource] || log.resource}`;
};

const nameOf = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : 'Deleted user');
const roleLabel = (r) => ({ admin: 'Admin', scheduling_officer: 'Scheduler', program_manager: 'Program manager', faculty: 'Faculty', student: 'Student' }[r] || r);
const avatarSrc = (p) => (p ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${p}` : null);

const deviceOf = (ua = '') => {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' on ');
};

/* ---------- Time ---------- */

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const RANGES = [
  { key: 'today', label: 'Today', from: () => startOfDay(new Date()) },
  { key: '7d', label: '7 days', from: () => new Date(startOfDay(new Date()).getTime() - 6 * 86400000) },
  { key: '30d', label: '30 days', from: () => new Date(startOfDay(new Date()).getTime() - 29 * 86400000) },
  { key: 'all', label: 'All time', from: () => null },
  { key: 'custom', label: 'Custom' },
];

const dayLabel = (date) => {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(date))) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', ...(new Date(date).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};
const clock = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const STATUS = {
  success: { label: 'Success', Icon: CheckCircle2, dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  warning: { label: 'Warning', Icon: AlertTriangle, dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  failure: { label: 'Failed', Icon: XCircle, dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
};

/* ---------- Pieces ---------- */

const Bone = ({ className = '' }) => <span className={`block rounded bg-gray-100 dark:bg-gray-700/70 ${className}`} />;

const Chip = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

const Avatar = ({ user, size = 36 }) => {
  const [broken, setBroken] = useState(false);
  const src = avatarSrc(user?.profilePicture);
  const initials = nameOf(user).split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src && !broken ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : initials}
    </span>
  );
};

const Card = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
    {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

/** Static skeleton (no pulse). */
const FeedSkeleton = () => (
  <div className="space-y-2" aria-label="Loading activity">
    <Bone className="mb-3 h-3 w-24" />
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-800">
        <Bone className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2"><Bone className="h-3.5 w-2/3" /><Bone className="h-3 w-1/3" /></div>
        <Bone className="h-3 w-12" />
      </div>
    ))}
  </div>
);

const toCsv = (logs) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Time', 'Person', 'Email', 'Role', 'What happened', 'Area', 'Action', 'Status', 'HTTP', 'Path', 'Duration ms', 'IP', 'Error'];
  const rows = logs.map((l) => [
    new Date(l.createdAt).toISOString(), nameOf(l.user), l.user?.email, l.user?.role, describe(l), AREA[l.resource] || l.resource,
    l.action, l.status, l.details?.statusCode, `${l.details?.method || ''} ${l.details?.path || ''}`.trim(), l.duration, l.ipAddress, l.errorMessage,
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
};

/* ---------- Page ---------- */

const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('7d');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [status, setStatus] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [person, setPerson] = useState(null); // { _id, name }
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  // Date window sent to the server
  const window_ = useMemo(() => {
    if (range === 'custom') {
      const [sy, sm, sd] = custom.start.split('-').map(Number);
      const [ey, em, ed] = custom.end.split('-').map(Number);
      return {
        startDate: custom.start ? new Date(sy, sm - 1, sd).toISOString() : undefined,
        endDate: custom.end ? new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString() : undefined,
      };
    }
    const from = RANGES.find((r) => r.key === range)?.from();
    return { startDate: from ? from.toISOString() : undefined, endDate: undefined };
  }, [range, custom]);

  const load = useCallback(async ({ quiet } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const params = {
        ...window_,
        ...(status && { status }),
        ...(resource && { resource }),
        ...(action && { action }),
        ...(person && { userId: person._id }),
        limit: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      };
      const [list, st] = await Promise.all([
        activityLogAPI.getAll(params),
        activityLogAPI.getStats({ ...window_, ...(person && { userId: person._id }), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).catch(() => null),
      ]);
      const body = list.data.data;
      setLogs(body.logs || body || []);
      setTotal(body.total ?? (body.logs || body || []).length);
      if (st) setStats(st.data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load activity'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [window_, status, resource, action, person, page]);

  useEffect(() => { load(); }, [load]);

  const resetPage = (fn) => (...args) => { fn(...args); setPage(1); setOpenId(null); };
  const pickRange = resetPage(setRange);
  const pickStatus = resetPage((s) => setStatus((cur) => (cur === s ? '' : s)));
  const pickResource = resetPage((r) => setResource((cur) => (cur === r ? '' : r)));
  const pickPerson = resetPage((p) => setPerson((cur) => (cur?._id === p?._id ? null : p)));
  const pickAction = resetPage(setAction);
  const clearAll = resetPage(() => { setStatus(''); setResource(''); setAction(''); setPerson(null); setSearch(''); });

  // Search narrows the page that's loaded (names, sentences, paths)
  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter((l) => [nameOf(l.user), l.user?.email, describe(l), l.details?.path, AREA[l.resource], l.errorMessage]
      .some((v) => (v || '').toLowerCase().includes(q)));
  }, [logs, search]);

  const days = useMemo(() => {
    const out = [];
    shown.forEach((l) => {
      const label = dayLabel(l.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(l); else out.push({ label, items: [l] });
    });
    return out;
  }, [shown]);

  const perDay = useMemo(() => {
    const map = Object.fromEntries((stats?.activitiesPerDay || []).map((d) => [d._id, d.count]));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfDay(new Date()).getTime() - (6 - i) * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), count: map[key] || 0, today: i === 6 };
    });
  }, [stats]);
  const perDayMax = Math.max(1, ...perDay.map((d) => d.count));

  const successRate = stats?.totalActivities ? Math.round((stats.successCount / stats.totalActivities) * 1000) / 10 : null;
  const activeFilters = [status && STATUS[status].label, resource && AREA[resource], action && (VERB[action] || action), person?.name].filter(Boolean);
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    if (!shown.length) return;
    const blob = new Blob([toCsv(shown)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Audit trail</p>
              <h1 className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Activity Log</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {stats
                  ? `${stats.totalActivities.toLocaleString()} actions${successRate != null ? ` · ${successRate}% successful` : ''} · ${stats.uniqueUsers} ${stats.uniqueUsers === 1 ? 'person' : 'people'} active`
                  : 'Who changed what, and when'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportCsv} disabled={!shown.length} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" title="Download this page as CSV">
                <Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span>
              </button>
              <button type="button" onClick={() => load({ quiet: true })} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Time range */}
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map((r) => <Chip key={r.key} on={range === r.key} onClick={() => pickRange(r.key)}>{r.key === 'custom' && <CalendarDays className="h-3.5 w-3.5" />}{r.label}</Chip>)}
            {range === 'custom' && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <input type="date" value={custom.start} max={custom.end || undefined} onChange={(e) => { setCustom((c) => ({ ...c, start: e.target.value })); setPage(1); }} className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="From" />
                to
                <input type="date" value={custom.end} min={custom.start || undefined} onChange={(e) => { setCustom((c) => ({ ...c, end: e.target.value })); setPage(1); }} className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" aria-label="To" />
              </span>
            )}
          </div>

          {/* Headline numbers */}
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-4 sm:divide-x sm:divide-gray-100 dark:sm:divide-gray-700">
            {[
              { label: 'Actions', value: stats?.totalActivities?.toLocaleString(), hint: RANGES.find((r) => r.key === range)?.label.toLowerCase() },
              { label: 'Successful', value: successRate != null ? `${successRate}%` : '—', hint: `${(stats?.successCount || 0).toLocaleString()} completed`, dot: 'bg-emerald-500', onClick: () => pickStatus('success'), on: status === 'success' },
              { label: 'Failed', value: (stats?.failureCount || 0).toLocaleString(), hint: stats?.failureCount ? 'click to review' : 'nothing failed', dot: 'bg-red-500', onClick: () => pickStatus('failure'), on: status === 'failure' },
              { label: 'People', value: stats?.uniqueUsers ?? '—', hint: 'did something' },
            ].map((k) => {
              const Tag = k.onClick ? 'button' : 'div';
              return (
                <Tag key={k.label} {...(k.onClick ? { type: 'button', onClick: k.onClick, 'aria-pressed': k.on } : {})} className={`min-w-0 px-4 py-3.5 text-left sm:px-5 ${k.onClick ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''} ${k.on ? 'bg-gray-50 dark:bg-gray-700/40' : ''}`}>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{k.dot && <span className={`h-2 w-2 rounded-full ${k.dot}`} />}{k.label}</p>
                  {!stats ? <Bone className="mt-2 h-7 w-16" /> : <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{k.value}</p>}
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{k.hint || ' '}</p>
                </Tag>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* ---------- Feed ---------- */}
            <main className="min-w-0 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search this page: person, action, path, error"
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <select
                  value={action}
                  onChange={(e) => pickAction(e.target.value)}
                  aria-label="Action"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="">Any action</option>
                  <option value="create">Created</option>
                  <option value="update">Updated</option>
                  <option value="delete">Deleted</option>
                  <option value="schedule_publish">Published schedules</option>
                  <option value="schedule_generate">Generated timetables</option>
                  <option value="announcement_post">Posted announcements</option>
                  <option value="material_upload">Uploaded files</option>
                  <option value="faculty_ai_analysis">AI analysis</option>
                  <option value="data_import">Imports</option>
                  <option value="settings_update">Settings changes</option>
                  <option value="logout">Sign-outs</option>
                </select>
              </div>

              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Filtered by</span>
                  {status && <button type="button" onClick={() => pickStatus(status)} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900">{STATUS[status].label}<X className="h-3 w-3" /></button>}
                  {resource && <button type="button" onClick={() => pickResource(resource)} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900">{AREA[resource] || resource}<X className="h-3 w-3" /></button>}
                  {action && <button type="button" onClick={() => pickAction('')} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900">{VERB[action] || action}<X className="h-3 w-3" /></button>}
                  {person && <button type="button" onClick={() => pickPerson(person)} className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-gray-900">{person.name}<X className="h-3 w-3" /></button>}
                  <button type="button" onClick={clearAll} className="text-xs font-medium text-gray-500 underline hover:text-gray-900 dark:hover:text-white">Clear</button>
                </div>
              )}

              {loading ? <FeedSkeleton /> : shown.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
                  <Activity className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium text-gray-700 dark:text-gray-200">No activity here</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{activeFilters.length || search ? 'Try removing a filter or widening the time range.' : 'Nothing was recorded in this time range.'}</p>
                </div>
              ) : (
                <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
                  {days.map((day) => (
                    <section key={day.label}>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{day.label}</span>
                        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                        <span className="text-xs text-gray-400">{day.items.length}</span>
                      </div>
                      <ul className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                        {day.items.map((l, i) => {
                          const st = STATUS[l.status] || STATUS.success;
                          const open = openId === l._id;
                          const device = deviceOf(l.userAgent);
                          return (
                            <li key={l._id} className={i ? 'border-t border-gray-100 dark:border-gray-700/70' : ''}>
                              <button
                                type="button"
                                onClick={() => setOpenId(open ? null : l._id)}
                                aria-expanded={open}
                                className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${l.status === 'failure' ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}
                              >
                                <span className="relative">
                                  <Avatar user={l.user} />
                                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-800 ${st.dot}`} title={st.label} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-sm text-gray-700 dark:text-gray-200 sm:line-clamp-1">
                                    <strong className="font-semibold text-gray-900 dark:text-white">{nameOf(l.user)}</strong> {describe(l)}
                                  </span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                                    {l.user?.role && <span>{roleLabel(l.user.role)}</span>}
                                    <span className="rounded bg-gray-100 px-1.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{AREA[l.resource] || l.resource}</span>
                                    {l.status === 'failure' && <span className={`font-medium ${st.text}`}>{l.errorMessage || `Failed (${l.details?.statusCode || 'error'})`}</span>}
                                  </span>
                                </span>
                                <span className="flex flex-shrink-0 items-center gap-1.5 text-xs tabular-nums text-gray-400">
                                  {clock(l.createdAt)}
                                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                                </span>
                              </button>
                              {open && (
                                <div className="grid gap-x-6 gap-y-2 border-t border-dashed border-gray-200 bg-gray-50/70 px-4 py-3 text-xs dark:border-gray-700 dark:bg-gray-900/30 sm:grid-cols-2 sm:pl-[62px]">
                                  <p className="flex items-center gap-2 text-gray-600 dark:text-gray-300 sm:col-span-2">
                                    <span className={`inline-flex items-center gap-1 font-semibold ${st.text}`}><st.Icon className="h-3.5 w-3.5" />{st.label}</span>
                                    <code className="truncate rounded bg-white px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                                      {l.details?.method} {l.details?.path}{l.details?.statusCode ? ` → ${l.details.statusCode}` : ''}
                                    </code>
                                  </p>
                                  <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><CalendarDays className="h-3.5 w-3.5" />{new Date(l.createdAt).toLocaleString()}</p>
                                  {l.user?.email && <p className="truncate text-gray-500 dark:text-gray-400">{l.user.email}</p>}
                                  {l.duration != null && <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Timer className="h-3.5 w-3.5" />{l.duration < 1000 ? `${l.duration} ms` : `${(l.duration / 1000).toFixed(1)} s`}</p>}
                                  {device && <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Monitor className="h-3.5 w-3.5" />{device}</p>}
                                  {l.ipAddress && <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"><Globe className="h-3.5 w-3.5" />{l.ipAddress.replace('::ffff:', '')}</p>}
                                  {l.resourceId && <p className="flex items-center gap-1.5 truncate font-mono text-gray-500 dark:text-gray-400"><Hash className="h-3.5 w-3.5" />{l.resourceId}</p>}
                                  {l.user?._id && (
                                    <p className="sm:col-span-2">
                                      <button type="button" onClick={() => pickPerson({ _id: l.user._id, name: nameOf(l.user) })} className="font-medium text-gray-600 underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                                        {person?._id === l.user._id ? 'Show everyone' : `Only show ${nameOf(l.user)}`}
                                      </button>
                                    </p>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}

              {!loading && total > 0 && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
                    {search && ` · ${shown.length} match${shown.length === 1 ? '' : 'es'} on this page`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { setPage((p) => Math.max(1, p - 1)); setOpenId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page === 1} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <ChevronLeft className="h-4 w-4" /> Newer
                    </button>
                    <span className="px-2 text-xs text-gray-400">{page} / {pages}</span>
                    <button type="button" onClick={() => { setPage((p) => Math.min(pages, p + 1)); setOpenId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page >= pages} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      Older <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </main>

            {/* ---------- Side ---------- */}
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <Card title="Last 7 days" subtitle={person ? `Activity by ${person.name}` : 'Actions recorded per day'}>
                {!stats ? <Bone className="h-24 w-full" /> : (
                  <div className="flex h-28 items-end gap-1.5">
                    {perDay.map((d) => (
                      <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.count} actions`}>
                        <span className="text-[10px] tabular-nums text-gray-400">{d.count || ''}</span>
                        <span className={`w-full rounded-t-md ${d.today ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-600'}`} style={{ height: `${(d.count / perDayMax) * 100}%`, minHeight: d.count ? 3 : 0 }} />
                        <span className={`text-[10px] ${d.today ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400'}`}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Most active" subtitle="Click someone to see only their actions">
                {!stats ? <div className="space-y-2">{[0, 1, 2].map((i) => <Bone key={i} className="h-7 w-full" />)}</div> : (stats.activitiesByUser || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No one yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {stats.activitiesByUser.slice(0, 6).map((u) => (
                      <li key={u._id}>
                        <button type="button" onClick={() => pickPerson({ _id: u._id, name: u.name })} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40 ${person?._id === u._id ? 'bg-gray-100 dark:bg-gray-700/60' : ''}`}>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                            <span className="block text-xs text-gray-400">{roleLabel(u.role)}</span>
                          </span>
                          <span className="tabular-nums text-gray-500 dark:text-gray-400">{u.count.toLocaleString()}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="By area" subtitle="Click to filter">
                {!stats ? <Bone className="h-16 w-full" /> : (
                  <div className="flex flex-wrap gap-1.5">
                    {(stats.activitiesByResource || []).map((r) => (
                      <button
                        key={r._id}
                        type="button"
                        onClick={() => pickResource(r._id)}
                        aria-pressed={resource === r._id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${resource === r._id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}`}
                      >
                        {AREA[r._id] || r._id}<span className="opacity-60">{r.count.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ActivityLogPage;
