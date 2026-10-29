import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, Users, UserCheck, UserX, Clock, AlertTriangle, AlertCircle, CheckCircle2,
  RefreshCw, Table2, ChevronDown, ChevronUp, Hourglass, Briefcase,
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import { facultyAPI, scheduleAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ---------- Load rules: same as the Faculty page ---------- */
const STANDARD_LOAD = 36;
const LOAD_ALLOWANCE = 4; // over their own max by up to this is "near limit"
const POSITION_HOURS = { Chairman: 12, Dean: 9, CD: 6 };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Status palette (fixed roles, never reused as series colours). Always shown
// with an icon and a label, never colour alone.
const STATUS = {
  overload: { label: 'Overload', Icon: AlertCircle, color: 'var(--fa-critical)', text: 'text-red-700 dark:text-red-300' },
  warning: { label: 'Near limit', Icon: AlertTriangle, color: 'var(--fa-warning)', text: 'text-amber-700 dark:text-amber-300' },
  normal: { label: 'Normal', Icon: CheckCircle2, color: 'var(--fa-good)', text: 'text-emerald-700 dark:text-emerald-300' },
  idle: { label: 'No classes', Icon: Hourglass, color: 'var(--fa-idle)', text: 'text-gray-600 dark:text-gray-300' },
};
const STATUS_ORDER = ['overload', 'warning', 'normal', 'idle'];

const nameOf = (f) => `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim() || f.employeeId || 'Unknown';
const hours = (n) => `${Math.round(n * 10) / 10}h`;

const loadOf = (f) => {
  const teaching = f.currentTeachingHours || 0;
  const admin = POSITION_HOURS[f.position] || 0;
  const total = teaching + admin;
  const max = f.maxTeachingHours || STANDARD_LOAD;
  const classes = f.assignedClasses || 0;
  const key = classes === 0 && teaching === 0
    ? 'idle'
    : total > max + LOAD_ALLOWANCE ? 'overload' : total > max ? 'warning' : 'normal';
  return { teaching, admin, total, max, classes, units: f.assignedUnits || 0, key, spare: Math.max(0, max - total) };
};

const minutes = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/* ---------- Chart pieces ---------- */

// Colour roles for the charts, light and dark (the app uses the `dark` class)
const VizStyles = () => (
  <style>{`
    .fa-root {
      --fa-good: #0ca30c; --fa-warning: #fab219; --fa-critical: #d03b3b; --fa-idle: #c3c2b7;
      --fa-series: #2a78d6; --fa-series-soft: #cde2fb; --fa-grid: #e7e6e2; --fa-marker: #52514e;
    }
    .dark .fa-root {
      --fa-idle: #52514e; --fa-series: #3987e5; --fa-series-soft: #184f95;
      --fa-grid: #2e2e2b; --fa-marker: #c3c2b7;
    }
  `}</style>
);

const Card = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5 ${className}`}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Floating tooltip that follows the hovered/focused mark inside a chart. */
const useTooltip = () => {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const box = ref.current?.getBoundingClientRect();
    const target = e.currentTarget.getBoundingClientRect();
    if (!box) return;
    const x = (e.clientX || target.left + target.width / 2) - box.left;
    const y = (e.clientY || target.top) - box.top;
    setTip({ x: Math.min(Math.max(x, 80), box.width - 80), y, content });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
      style={{ left: tip.x, top: tip.y - 10 }}
    >
      {tip.content}
    </div>
  );
  return { ref, show, hide, node };
};

const TipRow = ({ label, value }) => (
  <div className="flex justify-between gap-4 whitespace-nowrap">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
  </div>
);

/** One stacked bar of how many faculty sit in each load status. */
const StatusStrip = ({ counts, total, onPick, picked }) => {
  const tt = useTooltip();
  return (
    <div className="relative" ref={tt.ref}>
      <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded" aria-hidden="true">
        {STATUS_ORDER.filter((k) => counts[k]).map((k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            onClick={() => onPick(k)}
            onMouseMove={(e) => tt.show(e, (
              <>
                <p className="mb-1 font-semibold text-gray-900 dark:text-white">{STATUS[k].label}</p>
                <TipRow label="Faculty" value={counts[k]} />
                <TipRow label="Share" value={`${Math.round((counts[k] / total) * 100)}%`} />
              </>
            ))}
            onMouseLeave={tt.hide}
            className={`h-full transition-opacity ${picked && picked !== k ? 'opacity-40' : ''}`}
            style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS[k].color }}
          />
        ))}
      </div>
      {tt.node}
      {/* Legend doubles as the filter and as the direct labels */}
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_ORDER.map((k) => {
          const { label, Icon, color } = STATUS[k];
          const active = picked === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/30'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
              <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-200">{label}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{counts[k] || 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Hours per teacher, with each teacher's own max marked on the track. */
const WorkloadBars = ({ rows }) => {
  const tt = useTooltip();
  const scale = Math.max(STANDARD_LOAD + LOAD_ALLOWANCE, ...rows.map((r) => Math.max(r.load.total, r.load.max + LOAD_ALLOWANCE)));
  return (
    <div className="relative" ref={tt.ref}>
      <ul className="space-y-1.5">
        {rows.map(({ f, load }) => {
          const st = STATUS[load.key];
          const tip = (
            <>
              <p className="mb-1 font-semibold text-gray-900 dark:text-white">{nameOf(f)}</p>
              <TipRow label="Teaching" value={hours(load.teaching)} />
              {load.admin > 0 && <TipRow label={`${f.position} duties`} value={hours(load.admin)} />}
              <TipRow label="Total / max" value={`${hours(load.total)} / ${hours(load.max)}`} />
              <TipRow label="Classes · units" value={`${load.classes} · ${load.units}`} />
              <p className={`mt-1 flex items-center gap-1 font-semibold ${st.text}`}><st.Icon className="h-3 w-3" />{st.label}</p>
            </>
          );
          return (
            <li
              key={f._id}
              tabIndex={0}
              onMouseMove={(e) => tt.show(e, tip)}
              onMouseLeave={tt.hide}
              onFocus={(e) => tt.show(e, tip)}
              onBlur={tt.hide}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded px-1 py-0.5 outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700/40 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
            >
              <span className="truncate text-sm text-gray-700 dark:text-gray-200" title={nameOf(f)}>{nameOf(f)}</span>
              <span className="relative h-3 rounded-sm" style={{ background: 'var(--fa-grid)' }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-r"
                  style={{ width: `${(load.total / scale) * 100}%`, background: st.color }}
                />
                <span
                  className="absolute -inset-y-1 w-0.5 rounded"
                  style={{ left: `${(load.max / scale) * 100}%`, background: 'var(--fa-marker)' }}
                  aria-hidden="true"
                />
              </span>
              <span className="flex w-24 items-center justify-end gap-1 text-right text-sm tabular-nums text-gray-900 dark:text-white">
                {load.key !== 'normal' && <st.Icon className={`h-3.5 w-3.5 ${st.text}`} aria-label={st.label} />}
                {hours(load.total)}
                <span className="text-xs text-gray-500 dark:text-gray-400">/{load.max}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {tt.node}
    </div>
  );
};

/** Simple single-series horizontal bars (one hue). */
const HBars = ({ rows, format = (v) => v, unit }) => {
  const tt = useTooltip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="relative" ref={tt.ref}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.label}
            tabIndex={0}
            onMouseMove={(e) => tt.show(e, (
              <>
                <p className="mb-1 font-semibold text-gray-900 dark:text-white">{r.label}</p>
                <TipRow label={unit} value={format(r.value)} />
                {r.detail && Object.entries(r.detail).map(([k, v]) => <TipRow key={k} label={k} value={v} />)}
              </>
            ))}
            onMouseLeave={tt.hide}
            className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="truncate text-sm text-gray-700 dark:text-gray-200">{r.label}</span>
            <span className="h-3">
              <span className="block h-full rounded-r" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: 'var(--fa-series)' }} />
            </span>
            <span className="w-14 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-white">{format(r.value)}</span>
          </li>
        ))}
      </ul>
      {tt.node}
    </div>
  );
};

/** Teaching hours per weekday (one hue, columns). */
const DayColumns = ({ rows }) => {
  const tt = useTooltip();
  const max = Math.max(1, ...rows.map((r) => r.hours));
  const ticks = [0, 0.5, 1].map((p) => Math.round(max * p));
  return (
    <div className="relative" ref={tt.ref}>
      <div className="relative h-56 sm:h-64">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-8 text-right text-[10px] tabular-nums text-gray-400">{t}h</span>
            <span className="h-px flex-1" style={{ background: 'var(--fa-grid)' }} />
          </div>
        ))}
        <div className="absolute inset-y-0 left-10 right-0 flex items-end gap-3">
          {rows.map((r) => (
            <div
              key={r.day}
              tabIndex={0}
              onMouseMove={(e) => tt.show(e, (
                <>
                  <p className="mb-1 font-semibold text-gray-900 dark:text-white">{r.day}</p>
                  <TipRow label="Teaching hours" value={hours(r.hours)} />
                  <TipRow label="Class meetings" value={r.meetings} />
                  <TipRow label="Faculty teaching" value={r.faculty} />
                </>
              ))}
              onMouseLeave={tt.hide}
              className="flex h-full flex-1 flex-col items-center justify-end outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="mb-1 text-xs font-medium tabular-nums text-gray-700 dark:text-gray-200">{r.hours ? hours(r.hours) : ''}</span>
              <span className="w-full max-w-[3rem] rounded-t" style={{ height: `${(r.hours / max) * 100}%`, minHeight: r.hours ? 2 : 0, background: 'var(--fa-series)' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="ml-10 mt-2 flex gap-3">
        {rows.map((r) => <span key={r.day} className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400">{r.day.slice(0, 3)}</span>)}
      </div>
      {tt.node}
    </div>
  );
};

const Bone = ({ className = '', style }) => <span style={style} className={`block rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;

/* ---------- Page ---------- */

const FacultyAnalyticsPage = () => {
  const { user } = useAuth();
  const lockedProgram = user?.role === 'program_manager' ? user?.program || '' : '';
  const [faculty, setFaculty] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = { isActive: true, ...(lockedProgram && { program: lockedProgram }) };
      const [fac, sch] = await Promise.all([
        facultyAPI.getAll(params),
        scheduleAPI.getAll({ ...(lockedProgram && { program: lockedProgram }) }).catch(() => ({ data: { data: [] } })),
      ]);
      setFaculty(fac.data.data || []);
      setSchedules((sch.data.data || []).filter((s) => s.isActive !== false));
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load faculty analytics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lockedProgram]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(
    () => faculty.map((f) => ({ f, load: loadOf(f) })),
    [faculty]
  );

  const stats = useMemo(() => {
    const counts = { overload: 0, warning: 0, normal: 0, idle: 0 };
    rows.forEach((r) => { counts[r.load.key] += 1; });
    const teaching = rows.filter((r) => r.load.key !== 'idle');
    const avg = teaching.length ? teaching.reduce((s, r) => s + r.load.total, 0) / teaching.length : 0;
    const spare = rows.reduce((s, r) => s + r.load.spare, 0);
    return { counts, teaching: teaching.length, avg, spare, total: rows.length };
  }, [rows]);

  const workloadRows = useMemo(() => {
    const list = rows
      .filter((r) => (statusFilter ? r.load.key === statusFilter : r.load.key !== 'idle'))
      .sort((a, b) => b.load.total - a.load.total || nameOf(a.f).localeCompare(nameOf(b.f)));
    return list;
  }, [rows, statusFilter]);
  const visibleWorkload = showAll ? workloadRows : workloadRows.slice(0, 15);

  const byProgram = useMemo(() => {
    const map = new Map();
    rows.forEach(({ f, load: l }) => {
      (f.programs?.length ? f.programs : ['Unassigned']).forEach((p) => {
        const e = map.get(p) || { label: p, faculty: 0, teaching: 0, hoursSum: 0 };
        e.faculty += 1;
        if (l.key !== 'idle') { e.teaching += 1; e.hoursSum += l.total; }
        map.set(p, e);
      });
    });
    return [...map.values()]
      .map((e) => ({ label: e.label, value: e.faculty, detail: { Teaching: e.teaching, 'Avg load': e.teaching ? hours(e.hoursSum / e.teaching) : '—' } }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const byDay = useMemo(() => {
    const map = Object.fromEntries(DAYS.map((d) => [d, { day: d, hours: 0, meetings: 0, faculty: new Set() }]));
    schedules.forEach((s) => {
      (s.timeSlots || []).forEach((t) => {
        const e = map[t.day];
        if (!e) return;
        e.hours += Math.max(0, minutes(t.endTime) - minutes(t.startTime)) / 60;
        e.meetings += 1;
        if (s.faculty?._id || s.faculty) e.faculty.add(String(s.faculty?._id || s.faculty));
      });
    });
    return DAYS.map((d) => ({ ...map[d], faculty: map[d].faculty.size }));
  }, [schedules]);

  const composition = useMemo(() => {
    const count = (key) => {
      const m = new Map();
      rows.forEach(({ f }) => m.set(f[key] || 'Not set', (m.get(f[key] || 'Not set') || 0) + 1));
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    return { employment: count('employmentType'), position: count('position') };
  }, [rows]);

  const attention = rows.filter((r) => r.load.key === 'overload' || r.load.key === 'warning')
    .sort((a, b) => (b.load.total - b.load.max) - (a.load.total - a.load.max));
  // Teachers already carrying classes who could take more. Faculty with no
  // classes at all are counted separately (and would crowd this list out).
  const available = rows.filter((r) => r.load.key !== 'idle' && r.load.spare > 0)
    .sort((a, b) => b.load.spare - a.load.spare)
    .slice(0, 7);

  const pickStatus = (k) => { setStatusFilter((cur) => (cur === k ? '' : k)); setShowAll(false); };

  return (
    <Layout>
      <VizStyles />
      <div className="fa-root mx-auto max-w-7xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Faculty Analytics</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Teaching loads, capacity and coverage{lockedProgram ? ` for ${lockedProgram}` : ' across all programs'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Updated {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={load}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error && !faculty.length ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-900/20">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-3 font-semibold text-red-900 dark:text-red-200">{error}</p>
            <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : (
          <>
            {/* Headline numbers */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
              <StatCard icon={Users} label="Faculty" value={stats.total} hint="active members" tone="indigo" loading={loading} />
              <StatCard icon={UserCheck} label="Teaching" value={stats.teaching} hint={`${stats.counts.idle} with no classes`} tone="emerald" loading={loading} />
              <StatCard icon={Clock} label="Avg load" value={hours(stats.avg)} hint="per teaching member / week" tone="blue" loading={loading} />
              <StatCard
                icon={AlertTriangle}
                label="Over limit"
                value={stats.counts.overload + stats.counts.warning}
                hint={`${stats.counts.overload} overload · ${stats.counts.warning} near`}
                tone={stats.counts.overload ? 'red' : 'amber'}
                loading={loading}
              />
              <StatCard icon={Hourglass} label="Spare capacity" value={hours(stats.spare)} hint="unassigned hours / week" tone="violet" loading={loading} className="col-span-2 lg:col-span-1" />
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-3" role="status" aria-label="Loading analytics">
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
                  <Bone className="mb-5 h-4 w-48" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="mb-3 grid grid-cols-[9rem_1fr_4rem] items-center gap-3">
                      <Bone className="h-3 w-28" /><Bone className="h-3" style={{ width: `${90 - i * 7}%` }} /><Bone className="h-3 w-12" />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                  <Bone className="mb-5 h-4 w-32" /><Bone className="h-8 w-full" />
                  <div className="mt-4 space-y-2">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-7 w-40" />)}</div>
                </div>
              </div>
            ) : stats.total === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-600 dark:bg-gray-800">
                <Users className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="font-semibold text-gray-900 dark:text-white">No active faculty{lockedProgram ? ` in ${lockedProgram}` : ''} yet</p>
                <Link to="/faculty" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Go to Faculty Management</Link>
              </div>
            ) : (
              <div className={`space-y-4 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Workload per faculty */}
                  <Card
                    className="lg:col-span-2"
                    title="Weekly load per faculty"
                    subtitle={`Teaching + position hours. The line on each bar is that teacher's own max; up to ${LOAD_ALLOWANCE}h over is "near limit".`}
                    action={(
                      <button
                        type="button"
                        onClick={() => setAsTable((v) => !v)}
                        aria-pressed={asTable}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        {asTable ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                        {asTable ? 'Chart' : 'Table'}
                      </button>
                    )}
                  >
                    {statusFilter && (
                      <p className="mb-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        Showing <strong>{STATUS[statusFilter].label}</strong> only
                        <button type="button" onClick={() => setStatusFilter('')} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Show all</button>
                      </p>
                    )}
                    {workloadRows.length === 0 ? (
                      <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        {statusFilter === 'idle' || !statusFilter ? 'No faculty have classes assigned yet.' : `No faculty are ${STATUS[statusFilter].label.toLowerCase()}.`}
                      </p>
                    ) : statusFilter === 'idle' || asTable ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                              <th className="py-2 pr-3 font-semibold">Faculty</th>
                              <th className="py-2 pr-3 text-right font-semibold">Teaching</th>
                              <th className="py-2 pr-3 text-right font-semibold">Position</th>
                              <th className="py-2 pr-3 text-right font-semibold">Total / max</th>
                              <th className="py-2 pr-3 text-right font-semibold">Classes</th>
                              <th className="py-2 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {visibleWorkload.map(({ f, load: l }) => {
                              const st = STATUS[l.key];
                              return (
                                <tr key={f._id} className="text-gray-800 dark:text-gray-200">
                                  <td className="py-2 pr-3">{nameOf(f)}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{hours(l.teaching)}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{l.admin ? hours(l.admin) : '—'}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{hours(l.total)} / {l.max}h</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{l.classes}</td>
                                  <td className={`py-2 ${st.text}`}><span className="inline-flex items-center gap-1"><st.Icon className="h-3.5 w-3.5" />{st.label}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <WorkloadBars rows={visibleWorkload} />
                    )}
                    {workloadRows.length > 15 && (
                      <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      >
                        {showAll ? <>Show top 15 <ChevronUp className="h-4 w-4" /></> : <>Show all {workloadRows.length} <ChevronDown className="h-4 w-4" /></>}
                      </button>
                    )}
                  </Card>

                  <div className="min-w-0 space-y-4">
                    <Card title="Load status" subtitle="Click a status to list those faculty">
                      <StatusStrip counts={stats.counts} total={stats.total} onPick={pickStatus} picked={statusFilter} />
                    </Card>

                    <Card title="Needs attention" subtitle="Over their own weekly max">
                      {attention.length === 0 ? (
                        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" /> Everyone is within their limit.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {attention.slice(0, 6).map(({ f, load: l }) => {
                            const st = STATUS[l.key];
                            return (
                              <li key={f._id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                  <st.Icon className={`h-4 w-4 flex-shrink-0 ${st.text}`} aria-label={st.label} />
                                  <span className="truncate text-gray-800 dark:text-gray-200">{nameOf(f)}</span>
                                </span>
                                <span className="whitespace-nowrap tabular-nums text-gray-900 dark:text-white">
                                  +{hours(l.total - l.max)} <span className="text-xs text-gray-500 dark:text-gray-400">over {l.max}h</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </Card>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card title="Teaching hours by day" subtitle={`All scheduled class meetings${lockedProgram ? ` in ${lockedProgram}` : ''}`} className="lg:col-span-2">
                    {byDay.every((d) => d.hours === 0)
                      ? <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No classes scheduled yet.</p>
                      : <DayColumns rows={byDay} />}
                  </Card>

                  <Card title="Room for more classes" subtitle={`Teaching faculty with the most spare hours${stats.counts.idle ? ` · plus ${stats.counts.idle} with no classes` : ''}`}>
                    {available.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No teaching faculty have spare hours.</p>
                    ) : (
                      <ul className="space-y-2">
                        {available.map(({ f, load: l }) => (
                          <li key={f._id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate text-gray-800 dark:text-gray-200">{nameOf(f)}</span>
                              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{(f.specializations || []).slice(0, 2).join(', ') || f.position}</span>
                            </span>
                            <span className="whitespace-nowrap tabular-nums font-medium text-gray-900 dark:text-white">{hours(l.spare)} free</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link to="/faculty" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open Faculty Management →</Link>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {!lockedProgram && byProgram.length > 1 && (
                    <Card title="Faculty by program" subtitle="A teacher qualified for several programs counts in each">
                      <HBars rows={byProgram} unit="Faculty" />
                    </Card>
                  )}
                  <Card title="Employment type" subtitle="Active faculty">
                    <HBars rows={composition.employment} unit="Faculty" />
                  </Card>
                  <Card title="Position" subtitle="Chairman, Dean and CD carry admin hours">
                    <HBars rows={composition.position} unit="Faculty" />
                  </Card>
                </div>

                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Briefcase className="h-3.5 w-3.5" />
                  Loads come from saved schedules. Position hours: Chairman 12h, Dean 9h, CD 6h.
                  {stats.counts.idle > 0 && <> <UserX className="ml-2 h-3.5 w-3.5" /> {stats.counts.idle} faculty have no classes this term.</>}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default FacultyAnalyticsPage;
