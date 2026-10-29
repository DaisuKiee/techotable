import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, BookOpen, Users, GraduationCap, Layers, DoorOpen, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowRight, UserPlus, Wand2, ShieldAlert, ClipboardCheck, BarChart3, Clock, Coffee,
  FileEdit, User,
} from 'lucide-react';
import { dashboardAPI, scheduleAPI, getErrorMessage } from '../services/api';
import StatCard from './StatCard';
import AnimatedClock from './AnimatedClock';
import dashboardBg from '../assets/images/backgrounds/bg.jpg';
import { useLiveRefresh } from '../context/NotificationContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROLE_LABEL = { admin: 'Administrator', scheduling_officer: 'Scheduling Office', program_manager: 'Program Manager' };

const toMinutes = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtTime = (t) => {
  const mins = toMinutes(t);
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const greetingFor = (d) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const teacherOf = (s) => {
  const u = s.faculty?.user || s.faculty;
  return `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || 'No teacher yet';
};

const Bone = ({ className = '' }) => <span className={`block rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;

const Panel = ({ icon: Icon, title, subtitle, action, children, className = '' }) => (
  <section className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5 ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const StaffDashboard = ({ user }) => {
  const isManager = user?.role === 'program_manager';
  const canSeeConflicts = user?.role === 'admin' || user?.role === 'scheduling_officer';
  const [stats, setStats] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [conflicts, setConflicts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [st, sch, con] = await Promise.all([
        dashboardAPI.getStats(),
        scheduleAPI.getAll(isManager && user?.program ? { program: user.program } : {}).catch(() => ({ data: { data: [] } })),
        canSeeConflicts ? scheduleAPI.getConflicts(true).catch(() => null) : Promise.resolve(null),
      ]);
      setStats(st.data.data);
      setSchedules((sch.data.data || []).filter((s) => s.isActive !== false));
      setConflicts(con ? con.data.data || con.data : null);
      setError('');
      setUpdatedAt(new Date());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isManager, user?.program, canSeeConflicts]);

  useEffect(() => { load(); }, [load]);

  useLiveRefresh(['schedule', 'approvals', 'students'], load);

  const todayName = DAYS[now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Today's class meetings across the program / campus
  const today = useMemo(() => schedules.flatMap((s) => (s.timeSlots || [])
    .filter((t) => t.day === todayName)
    .map((t) => ({ s, start: toMinutes(t.startTime), end: toMinutes(t.endTime), startTime: t.startTime, endTime: t.endTime })))
    .sort((a, b) => a.start - b.start), [schedules, todayName]);
  const runningNow = today.filter((m) => nowMins >= m.start && nowMins < m.end);
  const upcoming = today.filter((m) => m.start > nowMins);
  const roomsInUse = new Set(runningNow.map((m) => m.s.roomLabel || m.s.room).filter(Boolean)).size;

  const conflictCount = conflicts?.totalConflicts || 0;

  // Things that need someone to act, with where to go
  const todos = stats ? [
    canSeeConflicts && conflictCount > 0 && {
      icon: ShieldAlert, tone: 'red', to: '/schedules',
      title: `${conflictCount} schedule conflict${conflictCount === 1 ? '' : 's'}`,
      detail: conflicts?.highSeverity ? `${conflicts.highSeverity} high priority` : 'Overlapping rooms, teachers or sections',
    },
    !isManager && stats.pendingFaculty > 0 && {
      icon: ClipboardCheck, tone: 'amber', to: '/faculty/approvals',
      title: `${stats.pendingFaculty} faculty sign-up${stats.pendingFaculty === 1 ? '' : 's'} to approve`,
      detail: 'They can’t log in until approved',
    },
    stats.unassignedStudents > 0 && {
      icon: GraduationCap, tone: 'amber', to: '/students',
      title: `${stats.unassignedStudents} student${stats.unassignedStudents === 1 ? '' : 's'} without a section`,
      detail: 'Assign them so their timetable appears',
    },
    stats.totalSubjects - stats.scheduledSubjects > 0 && {
      icon: BookOpen, tone: 'blue', to: '/schedules',
      title: `${stats.totalSubjects - stats.scheduledSubjects} subjects not scheduled yet`,
      detail: stats.term ? `Semester ${stats.term.semester}, AY ${stats.term.academicYear}` : `${stats.scheduledSubjects} of ${stats.totalSubjects} have classes`,
    },
    stats.draftSchedules > 0 && {
      icon: FileEdit, tone: 'blue', to: '/schedules',
      title: `${stats.draftSchedules} schedule${stats.draftSchedules === 1 ? '' : 's'} still in draft`,
      detail: 'Publish when the timetable is final',
    },
  ].filter(Boolean) : [];

  const TODO_TONE = {
    red: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  };

  const actions = [
    { icon: Wand2, label: 'Generate schedule', to: '/schedules' },
    { icon: GraduationCap, label: 'Students', to: '/students' },
    { icon: UserPlus, label: 'Faculty & invites', to: '/faculty' },
    { icon: Layers, label: 'Sections', to: '/sections' },
    { icon: BookOpen, label: 'Subjects', to: '/subjects' },
    { icon: BarChart3, label: 'Faculty analytics', to: '/faculty-analytics' },
  ];

  const header = (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center px-5 py-6 text-white shadow-lg sm:px-8 sm:py-7"
      style={{ backgroundImage: `linear-gradient(100deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.45) 100%), url(${dashboardBg})` }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-300 ring-1 ring-white/20">
            <GraduationCap className="h-3.5 w-3.5" /> CTU Daanbantayan Campus
          </span>
          <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{greetingFor(now)}, {user?.firstName || 'there'}</h1>
          <p className="mt-1 text-sm font-medium text-white/85">
            {loading ? 'Loading today’s overview…'
              : runningNow.length ? `${runningNow.length} class${runningNow.length === 1 ? ' is' : 'es are'} running now${isManager ? ` in ${user.program}` : ''}.`
              : upcoming.length ? `${upcoming.length} more class${upcoming.length === 1 ? '' : 'es'} today; the next starts at ${fmtTime(upcoming[0].startTime)}.`
              : today.length ? 'All of today’s classes are done.'
              : 'No classes scheduled today.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
            {[ROLE_LABEL[user?.role], isManager && user?.program ? `${user.program} program` : 'All programs']
              .filter(Boolean)
              .map((chip) => <span key={chip} className="rounded-full bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/25">{chip}</span>)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
            <AnimatedClock className="h-9 w-9 text-yellow-300" time={now} title={null} />
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none text-white">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              <p className="mt-1 text-xs text-white/75">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Refresh'}
            aria-label="Refresh dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading dashboard">
        {header}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Bone className="h-3 w-16" /><Bone className="mt-4 h-7 w-12" /><Bone className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <Bone className="h-4 w-40" />{[0, 1, 2, 3].map((i) => <Bone key={i} className="mt-5 h-10 w-full" />)}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <Bone className="h-4 w-28" />{[0, 1, 2].map((i) => <Bone key={i} className="mt-5 h-8 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-white">{error}</p>
          <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-80' : ''}`}>
      {header}

      {/* Conflicts: calm, but impossible to miss when there are any */}
      {canSeeConflicts && conflicts && (conflictCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/60 dark:bg-red-900/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100">
                {conflictCount} schedule conflict{conflictCount === 1 ? '' : 's'}{conflicts.highSeverity ? ` · ${conflicts.highSeverity} high priority` : ''}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-red-800 dark:text-red-200">
                {(conflicts.criticalConflicts || []).slice(0, 3).map((c, i) => (
                  <li key={i}>
                    {c.day} {c.timeRange}: {c.type === 'FACULTY_DOUBLE_BOOKING' ? `${c.faculty?.name || 'A teacher'} is double-booked`
                      : c.type === 'ROOM_DOUBLE_BOOKING' ? `room ${c.room} is double-booked`
                      : c.type === 'SECTION_DOUBLE_BOOKING' ? `${c.section} has overlapping classes`
                      : String(c.type || '').replace(/_/g, ' ').toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link to="/schedules" className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Review conflicts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> No schedule conflicts: rooms, teachers and sections are all clear.
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        <StatCard icon={Calendar} label="Schedules" value={stats.totalSchedules} hint={`${stats.publishedSchedules} published · ${stats.draftSchedules} draft`} tone="blue" />
        <StatCard icon={BookOpen} label="Subjects" value={`${pct(stats.scheduledSubjects, stats.totalSubjects)}%`} hint={`${stats.scheduledSubjects} of ${stats.totalSubjects} scheduled${stats.term ? ` · sem ${stats.term.semester}` : ''}`} tone="emerald" />
        <StatCard icon={Users} label="Faculty" value={stats.activeFaculty} hint={`${stats.teachingFaculty} teaching`} tone="indigo" />
        <StatCard icon={GraduationCap} label="Students" value={stats.totalStudents} hint={stats.unassignedStudents ? `${stats.unassignedStudents} need a section` : 'all placed'} tone={stats.unassignedStudents ? 'amber' : 'sky'} />
        <StatCard icon={Layers} label="Sections" value={stats.totalSections} hint={`${stats.totalClasses} class spaces`} tone="violet" />
        <StatCard icon={DoorOpen} label="Rooms" value={stats.totalRooms} hint={today.length ? `${roomsInUse} in use right now` : 'none in use today'} tone="orange" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today on campus */}
        <Panel
          className="lg:col-span-2"
          icon={Clock}
          title={isManager ? `Today in ${user.program}` : 'Today on campus'}
          subtitle={`${today.length} class meeting${today.length === 1 ? '' : 's'} · ${runningNow.length} running now`}
          action={(
            <Link to="/schedules" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              Schedules <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        >
          {today.length === 0 ? (
            <div className="py-8 text-center">
              <Coffee className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 font-medium text-gray-900 dark:text-white">No classes today</p>
            </div>
          ) : (
            <ol className="space-y-1.5">
              {[...runningNow, ...upcoming].slice(0, 8).map((m) => {
                const live = nowMins >= m.start;
                return (
                  <li key={`${m.s._id}-${m.start}`} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${live ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="w-[4.5rem] flex-shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtTime(m.startTime)}</p>
                      <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{fmtTime(m.endTime)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {m.s.subject?.subjectCode} <span className="text-gray-500 dark:text-gray-400">· {m.s.sectionCode}</span>
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3" />{m.s.roomLabel || 'Room TBA'}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{teacherOf(m.s)}</span>
                      </p>
                    </div>
                    {live && <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Now</span>}
                  </li>
                );
              })}
              {runningNow.length + upcoming.length === 0 && (
                <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">All {today.length} of today’s classes are done.</li>
              )}
              {runningNow.length + upcoming.length > 8 && (
                <li className="pt-1 text-center text-xs text-gray-500 dark:text-gray-400">+{runningNow.length + upcoming.length - 8} more later today</li>
              )}
            </ol>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel icon={ClipboardCheck} title="Needs attention" subtitle={todos.length ? `${todos.length} item${todos.length === 1 ? '' : 's'}` : 'Nothing waiting'}>
            {todos.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> All clear.</p>
            ) : (
              <ul className="space-y-1">
                {todos.map((t) => (
                  <li key={t.title}>
                    <Link to={t.to} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${TODO_TONE[t.tone]}`}><t.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{t.title}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{t.detail}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={Wand2} title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <Link key={a.label} to={a.to} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-900/10">
                  <a.icon className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
