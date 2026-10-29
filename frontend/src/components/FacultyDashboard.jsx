import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Calendar, Clock, DoorOpen, Users, GraduationCap, AlertTriangle, ArrowRight,
  RefreshCw, CalendarDays, Coffee, Megaphone, FileText, Briefcase, User, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { facultyAPI, classSpaceAPI, getErrorMessage } from '../services/api';
import StatCard from './StatCard';
import AnimatedClock from './AnimatedClock';
import dashboardBg from '../assets/images/backgrounds/bg.jpg';
import { useLiveRefresh } from '../context/NotificationContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Same rules as the Faculty page: over max by up to 4h is "near limit"
const STANDARD_LOAD = 36;
const LOAD_ALLOWANCE = 4;
const POSITION_HOURS = { Chairman: 12, Dean: 9, CD: 6 };

const FILE_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const toMinutes = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtTime = (t) => {
  const mins = toMinutes(t);
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const fmtSpan = (mins) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? 's' : ''}`;
};
const hours = (n) => `${Math.round(n * 10) / 10}h`;
const greetingFor = (d) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

// Same slug as the class pages, so links open that class directly
const classSlug = (cs) => [cs?.subject?.subjectCode || cs?.sectionCode || 'class', cs?.sectionCode || '']
  .filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const studentsIn = (cs) => (cs.enrolledStudents || []).length;

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

const HeaderAvatar = ({ user }) => {
  const [failed, setFailed] = useState(false);
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  if (user?.profilePicture && !failed) {
    return <img src={`${FILE_BASE}${user.profilePicture}`} alt="" onError={() => setFailed(true)} className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-2 ring-white/40" />;
  }
  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-bold text-white ring-2 ring-white/30">
      {initials || <User className="h-7 w-7" />}
    </div>
  );
};

const FacultyDashboard = ({ user }) => {
  const facultyId = user?.facultyProfile?._id || user?.facultyProfile;
  const [faculty, setFaculty] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!facultyId) { setLoading(false); return; }
    setRefreshing(true);
    try {
      const [fac, cls] = await Promise.all([facultyAPI.getById(facultyId), classSpaceAPI.getMyClasses()]);
      setFaculty(fac.data.data || null);
      setClasses(cls.data.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [facultyId]);

  useEffect(() => { load(); }, [load]);

  // Schedule or class changes pushed from the server
  useLiveRefresh(['schedule', 'classes', 'profile'], load);

  const todayName = DAYS[now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const meetings = useMemo(() => classes.flatMap((cs) => (cs.schedule?.timeSlots || []).map((slot) => ({
    cs,
    day: slot.day,
    start: toMinutes(slot.startTime),
    end: toMinutes(slot.endTime),
    startTime: slot.startTime,
    endTime: slot.endTime,
  }))), [classes]);

  const today = useMemo(
    () => meetings.filter((m) => m.day === todayName).sort((a, b) => a.start - b.start),
    [meetings, todayName]
  );
  const current = today.find((m) => nowMins >= m.start && nowMins < m.end);
  const nextToday = today.find((m) => m.start > nowMins);
  const nextLater = useMemo(() => {
    if (nextToday || current) return null;
    for (let i = 1; i <= 7; i += 1) {
      const day = DAYS[(now.getDay() + i) % 7];
      const list = meetings.filter((m) => m.day === day).sort((a, b) => a.start - b.start);
      if (list.length) return { ...list[0], inDays: i };
    }
    return null;
  }, [meetings, now, nextToday, current]);

  const week = useMemo(() => WEEK.map((day) => {
    const list = meetings.filter((m) => m.day === day).sort((a, b) => a.start - b.start);
    return { day, list, hours: list.reduce((s, m) => s + (m.end - m.start), 0) / 60 };
  }), [meetings]);

  // Load: teaching hours from the actual timetable + position hours
  const load_ = useMemo(() => {
    const teaching = week.reduce((s, d) => s + d.hours, 0);
    const admin = POSITION_HOURS[faculty?.position] || 0;
    const total = teaching + admin;
    const max = faculty?.maxTeachingHours || STANDARD_LOAD;
    const key = total > max + LOAD_ALLOWANCE ? 'overload' : total > max ? 'warning' : 'normal';
    return { teaching, admin, total, max, key, scale: Math.max(max + LOAD_ALLOWANCE, total) };
  }, [week, faculty]);

  const totals = useMemo(() => ({
    students: classes.reduce((s, cs) => s + studentsIn(cs), 0),
    units: classes.reduce((s, cs) => s + (cs.subject?.units || 0), 0),
    sections: new Set(classes.map((cs) => cs.sectionCode).filter(Boolean)).size,
    todayHours: today.reduce((s, m) => s + (m.end - m.start), 0) / 60,
  }), [classes, today]);

  const LOAD_STYLE = {
    normal: { label: 'Within your load', Icon: CheckCircle2, bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    warning: { label: 'Near your limit', Icon: AlertTriangle, bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    overload: { label: 'Overloaded', Icon: AlertCircle, bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
  }[load_.key];

  /* ---------- Header ---------- */
  const header = (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center px-5 py-6 text-white shadow-lg sm:px-8 sm:py-7"
      style={{ backgroundImage: `linear-gradient(100deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.45) 100%), url(${dashboardBg})` }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <HeaderAvatar user={user} />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-300 ring-1 ring-white/20">
              <GraduationCap className="h-3.5 w-3.5" /> CTU Daanbantayan Campus
            </span>
            <h1 className="mt-2 truncate text-2xl font-bold text-white sm:text-3xl">{greetingFor(now)}, {user?.firstName || 'there'}</h1>
            <p className="mt-1 text-sm font-medium text-white/85">
              {loading ? 'Loading your day…'
                : !classes.length ? 'No classes assigned to you yet.'
                : current ? `You’re teaching ${current.cs.subject?.subjectCode} (${current.cs.sectionCode}) right now.`
                : nextToday ? `Next: ${nextToday.cs.subject?.subjectCode} with ${nextToday.cs.sectionCode} at ${fmtTime(nextToday.startTime)}.`
                : today.length ? 'You’re done teaching for today.'
                : 'No classes today.'}
            </p>
            {faculty && (
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
                {[faculty.position, faculty.employmentType, faculty.employeeId, faculty.department, ...(faculty.programs || []).slice(0, 2)]
                  .filter(Boolean)
                  .map((chip) => <span key={chip} className="rounded-full bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/25">{chip}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm md:flex-shrink-0">
          <AnimatedClock className="h-9 w-9 text-yellow-300" time={now} title={null} />
          <div>
            <p className="text-2xl font-bold tabular-nums leading-none text-white">
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="mt-1 text-xs text-white/75">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>
    </div>
  );

  /* ---------- No faculty profile ---------- */
  if (!facultyId) {
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800/60 dark:bg-amber-900/20 sm:p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 font-semibold text-gray-900 dark:text-white">Your account isn’t linked to a faculty profile</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">
            Ask the scheduling office to link your account. Until then you won’t see classes or a timetable here.
          </p>
          <Link to="/profile" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            View my profile
          </Link>
        </div>
      </div>
    );
  }

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading your dashboard">
        {header}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Bone className="h-3 w-16" /><Bone className="mt-4 h-7 w-12" /><Bone className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <Bone className="h-4 w-40" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-5 flex gap-4"><Bone className="h-10 w-16" /><div className="flex-1 space-y-2"><Bone className="h-4 w-1/2" /><Bone className="h-3 w-1/3" /></div></div>
            ))}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <Bone className="h-4 w-28" /><Bone className="mt-5 h-3 w-full" /><Bone className="mt-3 h-3 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !classes.length && !faculty) {
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={CalendarDays} label="Today" value={today.length} hint={today.length ? `${fmtSpan(Math.round(totals.todayHours * 60))} of teaching` : 'no classes today'} tone="blue" />
        <StatCard icon={Clock} label="Weekly load" value={hours(load_.total)} hint={`of ${load_.max}h max`} tone={load_.key === 'normal' ? 'violet' : load_.key === 'warning' ? 'amber' : 'red'} />
        <StatCard icon={BookOpen} label="Classes" value={classes.length} hint={`${totals.sections} section${totals.sections === 1 ? '' : 's'} · ${totals.units} units`} tone="emerald" />
        <StatCard icon={Users} label="Students" value={totals.students} hint="across your classes" tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today */}
        <Panel
          className="lg:col-span-2"
          icon={Calendar}
          title="Today’s classes"
          subtitle={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          action={(
            <Link to="/schedules" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              Full schedule <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        >
          {current ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/20">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Teaching now
                </p>
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{fmtSpan(current.end - nowMins)} left</p>
              </div>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {current.cs.subject?.subjectCode} · {current.cs.sectionCode} · {current.cs.schedule?.roomLabel || 'Room TBA'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((nowMins - current.start) / (current.end - current.start)) * 100}%` }} />
              </div>
            </div>
          ) : nextToday ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/60 dark:bg-blue-900/20">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Next class</p>
                <p className="mt-0.5 truncate font-semibold text-gray-900 dark:text-white">
                  {nextToday.cs.subject?.subjectCode} · {nextToday.cs.sectionCode} · {nextToday.cs.schedule?.roomLabel || 'Room TBA'}
                </p>
              </div>
              <p className="whitespace-nowrap text-sm font-semibold text-blue-700 dark:text-blue-300">in {fmtSpan(nextToday.start - nowMins)}</p>
            </div>
          ) : null}

          {today.length === 0 ? (
            <div className="py-8 text-center">
              <Coffee className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="mt-2 font-medium text-gray-900 dark:text-white">No classes today</p>
              {nextLater && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Next: <strong>{nextLater.cs.subject?.subjectCode}</strong> with {nextLater.cs.sectionCode} {nextLater.inDays === 1 ? 'tomorrow' : `on ${nextLater.day}`} at {fmtTime(nextLater.startTime)}
                </p>
              )}
            </div>
          ) : (
            <ol className="space-y-2">
              {today.map((m) => {
                const state = nowMins >= m.end ? 'done' : nowMins >= m.start ? 'now' : 'next';
                return (
                  <li key={`${m.cs._id}-${m.start}`}>
                    <Link
                      to={`/classes/${classSlug(m.cs)}`}
                      className={`flex gap-4 rounded-xl border p-3 transition-colors sm:p-4 ${
                        state === 'now'
                          ? 'border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-700 dark:ring-emerald-700'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10'
                      } ${state === 'done' ? 'opacity-60' : ''}`}
                    >
                      <div className="w-20 flex-shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtTime(m.startTime)}</p>
                        <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtTime(m.endTime)}</p>
                      </div>
                      <div className={`w-1 flex-shrink-0 rounded-full ${state === 'now' ? 'bg-emerald-500' : state === 'done' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{m.cs.subject?.subjectCode}</p>
                          <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{m.cs.sectionCode}</span>
                          {state === 'done' && <span className="text-xs text-gray-500 dark:text-gray-400">Done</span>}
                          {state === 'now' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Now</span>}
                        </div>
                        <p className="truncate text-sm text-gray-600 dark:text-gray-300">{m.cs.subject?.subjectName}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{m.cs.schedule?.roomLabel || 'Room TBA'}</span>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{studentsIn(m.cs)} student{studentsIn(m.cs) === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <div className="min-w-0 space-y-4">
          {/* Workload */}
          <Panel icon={Briefcase} title="Your workload" subtitle="Teaching + position hours this week">
            <div className="flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {hours(load_.total)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ {load_.max}h</span>
              </p>
              <span className={`flex items-center gap-1 text-xs font-semibold ${LOAD_STYLE.text}`}>
                <LOAD_STYLE.Icon className="h-3.5 w-3.5" /> {LOAD_STYLE.label}
              </span>
            </div>
            <div className="relative mt-2 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700">
              <div className={`h-full rounded-full ${LOAD_STYLE.bar}`} style={{ width: `${Math.min(100, (load_.total / load_.scale) * 100)}%` }} />
              <div className="absolute -inset-y-1 w-0.5 rounded bg-gray-500 dark:bg-gray-300" style={{ left: `${(load_.max / load_.scale) * 100}%` }} title={`Max ${load_.max}h`} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-gray-500 dark:text-gray-400">Teaching</dt><dd className="font-semibold text-gray-900 dark:text-white">{hours(load_.teaching)}</dd></div>
              <div><dt className="text-gray-500 dark:text-gray-400">{faculty?.position && load_.admin ? `${faculty.position} duties` : 'Position duties'}</dt><dd className="font-semibold text-gray-900 dark:text-white">{load_.admin ? hours(load_.admin) : '—'}</dd></div>
            </dl>
          </Panel>

          {/* Week */}
          <Panel icon={CalendarDays} title="This week" subtitle="Classes per day">
            <ul className="space-y-1">
              {week.map(({ day, list, hours: h }) => {
                const isToday = day === todayName;
                return (
                  <li key={day} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 ${isToday ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800' : ''}`}>
                    <span className={`text-sm font-medium ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {day}{isToday && <span className="ml-1.5 text-xs font-semibold">· today</span>}
                    </span>
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {list.length ? `${list.length} class${list.length > 1 ? 'es' : ''} · ${hours(h)}` : 'Free'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Classes */}
      <Panel
        icon={BookOpen}
        title="My classes"
        subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'} · ${totals.students} student${totals.students === 1 ? '' : 's'}`}
        action={(
          <Link to="/classes" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Class spaces <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      >
        {classes.length === 0 ? (
          <div className="py-8 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 font-medium text-gray-900 dark:text-white">No classes assigned yet</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Your classes appear here once the scheduling office assigns them.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...classes]
              .sort((a, b) => `${a.sectionCode}${a.subject?.subjectCode}`.localeCompare(`${b.sectionCode}${b.subject?.subjectCode}`))
              .map((cs) => {
                const slots = cs.schedule?.timeSlots || [];
                return (
                  <Link
                    key={cs._id}
                    to={`/classes/${classSlug(cs)}`}
                    className="flex flex-col rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{cs.subject?.subjectCode}</p>
                      <span className="flex-shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{cs.sectionCode}</span>
                    </div>
                    <p className="line-clamp-1 text-sm text-gray-600 dark:text-gray-300">{cs.subject?.subjectName}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      {slots.length ? slots.map((s) => `${s.day.slice(0, 3)} ${fmtTime(s.startTime)}`).join(', ') : 'Not scheduled yet'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <DoorOpen className="h-3.5 w-3.5" /> {cs.schedule?.roomLabel || 'Room TBA'}
                    </p>
                    <div className="mt-3 flex gap-3 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{studentsIn(cs)}</span>
                      <span className="flex items-center gap-1"><Megaphone className="h-3.5 w-3.5" />{cs.announcements?.length || 0}</span>
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{cs.materials?.length || 0}</span>
                      <span className="ml-auto">{cs.subject?.units || 0} units</span>
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default FacultyDashboard;
