import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Calendar, Clock, DoorOpen, User, GraduationCap, AlertTriangle, ArrowRight,
  RefreshCw, KeyRound, CheckCircle2, Megaphone, FileText, CalendarDays, Coffee,
} from 'lucide-react';
import { studentAPI, classSpaceAPI, getErrorMessage } from '../services/api';
import StatCard from './StatCard';
import AnimatedClock from './AnimatedClock';
import dashboardBg from '../assets/images/backgrounds/bg.jpg';
import { useLiveRefresh } from '../context/NotificationContext';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
const greetingFor = (d) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');

// Same slug as the class pages (subjectcode-section), so links open the class
const classSlug = (cs) => [cs?.subject?.subjectCode || cs?.sectionCode || 'class', cs?.sectionCode || '']
  .filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// The class's teacher arrives either as a User (class spaces) or a Faculty with .user
const teacherOf = (cs) => {
  const u = cs.faculty?.user || cs.faculty;
  const name = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
  return name || null;
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

const EmptyState = ({ icon: Icon, tone = 'gray', title, children, action }) => (
  <div className={`rounded-xl border p-6 text-center sm:p-8 ${
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-900/20'
      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
  }`}
  >
    <Icon className={`mx-auto h-10 w-10 ${tone === 'amber' ? 'text-amber-500' : 'text-gray-400'}`} />
    <p className="mt-3 font-semibold text-gray-900 dark:text-white">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">{children}</p>
    {action}
  </div>
);

const StudentDashboard = ({ user }) => {
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  // Keep "happening now" and countdowns current
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [prof, cls] = await Promise.all([
        studentAPI.getMyProfile().catch((e) => (e.response?.status === 404 ? { data: { data: null } } : Promise.reject(e))),
        classSpaceAPI.getMyClasses(),
      ]);
      setProfile(prof.data.data || cls.data.profile || null);
      setClasses(cls.data.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Schedule or class changes pushed from the server
  useLiveRefresh(['schedule', 'classes', 'profile'], load);

  const todayName = DAYS[now.getDay()];
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Every meeting of every class, as flat entries
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

  // First meeting after today, for "next class" when today is done
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

  const totals = useMemo(() => ({
    units: classes.reduce((s, cs) => s + (cs.subject?.units || 0), 0),
    weekHours: week.reduce((s, d) => s + d.hours, 0),
    todayHours: today.reduce((s, m) => s + (m.end - m.start), 0) / 60,
    announcements: classes.reduce((s, cs) => s + (cs.announcements?.length || 0), 0),
  }), [classes, week, today]);

  const isIrregular = profile?.studentType === 'irregular';
  const joined = classes.length > 0;
  const firstName = user?.firstName || 'there';

  /* ---------- Header ---------- */
  const header = (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center px-5 py-6 text-white shadow-lg sm:px-8 sm:py-7"
      // Black wash, darkest behind the text and lighter to the right so the
      // campus photo still shows through
      style={{ backgroundImage: `linear-gradient(100deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0.45) 100%), url(${dashboardBg})` }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-300 ring-1 ring-white/20">
            <GraduationCap className="h-3.5 w-3.5" /> CTU Daanbantayan Campus
          </span>
          <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{greetingFor(now)}, {firstName}</h1>
          <p className="mt-1 text-sm font-medium text-white/85">
            {loading ? 'Loading your day…'
              : !joined ? 'Let’s get you into your classes.'
              : current ? `You’re in ${current.cs.subject?.subjectCode || 'class'} right now.`
              : nextToday ? `Next up: ${nextToday.cs.subject?.subjectCode} at ${fmtTime(nextToday.startTime)}.`
              : today.length ? 'You’re done with classes for today.'
              : 'No classes today.'}
          </p>
          {profile && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
              {[
                profile.program,
                profile.yearLevel ? `Year ${profile.yearLevel}` : null,
                profile.sectionCode,
                profile.studentType ? `${profile.studentType[0].toUpperCase()}${profile.studentType.slice(1)}` : null,
                profile.academicYear ? `AY ${profile.academicYear} · Sem ${profile.semester}` : null,
              ].filter(Boolean).map((chip) => (
                <span key={chip} className="rounded-full bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/25">{chip}</span>
              ))}
            </div>
          )}
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
            <Bone className="h-4 w-28" />
            {[0, 1, 2, 3, 4, 5].map((i) => <Bone key={i} className="mt-4 h-3 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Error / not enrolled ---------- */
  let gate = null;
  if (error && !classes.length) {
    gate = (
      <EmptyState icon={AlertTriangle} title={error} action={(
        <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
      >
        Check your connection and try again.
      </EmptyState>
    );
  } else if (!profile) {
    gate = (
      <EmptyState icon={User} tone="amber" title="No student record yet">
        Your account isn’t linked to a student record. Please contact your program’s office so they can set it up.
      </EmptyState>
    );
  } else if (!joined) {
    gate = (
      <EmptyState
        icon={KeyRound}
        tone="amber"
        title={isIrregular ? 'Join your subjects' : 'Join your section'}
        action={(
          <Link to="/classes" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <KeyRound className="h-4 w-4" /> {isIrregular ? 'Enter a class code' : 'Enter enrollment code'}
          </Link>
        )}
      >
        {isIrregular
          ? 'Ask each instructor for the class code of their subject and enter it in My Classes.'
          : 'Ask your program office for your section’s enrollment code. Once you join, your classes and schedule appear here.'}
      </EmptyState>
    );
  }

  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-80' : ''}`}>
      {header}

      {gate || (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <StatCard icon={CalendarDays} label="Today" value={today.length} hint={today.length ? `${fmtSpan(Math.round(totals.todayHours * 60))} of class` : 'no classes today'} tone="blue" />
            <StatCard icon={Clock} label="This week" value={`${Math.round(totals.weekHours * 10) / 10}h`} hint={`${meetings.length} class meetings`} tone="violet" />
            <StatCard icon={BookOpen} label="Subjects" value={classes.length} hint={`${totals.units} units total`} tone="emerald" />
            <StatCard
              icon={profile.enrollmentStatus === 'enrolled' ? CheckCircle2 : AlertTriangle}
              label="Status"
              value={profile.enrollmentStatus === 'enrolled' ? 'Enrolled' : (profile.enrollmentStatus || 'Unknown').replace('_', ' ')}
              hint={profile.sectionCode || `${(profile.subjectCodes || []).length} subjects`}
              tone={profile.enrollmentStatus === 'enrolled' ? 'emerald' : 'amber'}
            />
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
              {/* Now / next banner */}
              {current ? (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Happening now
                    </p>
                    <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{fmtSpan(current.end - nowMins)} left</p>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {current.cs.subject?.subjectCode} · {current.cs.subject?.subjectName}
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
                      {nextToday.cs.subject?.subjectCode} · {nextToday.cs.subject?.subjectName}
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
                      Next: <strong>{nextLater.cs.subject?.subjectCode}</strong> on {nextLater.inDays === 1 ? 'tomorrow' : nextLater.day} at {fmtTime(nextLater.startTime)}
                    </p>
                  )}
                </div>
              ) : (
                <ol className="relative space-y-2">
                  {today.map((m) => {
                    const state = nowMins >= m.end ? 'done' : nowMins >= m.start ? 'now' : 'next';
                    const teacher = teacherOf(m.cs);
                    return (
                      <li key={`${m.cs._id}-${m.start}`}>
                        <Link
                          to={`/classes/${classSlug(m.cs)}`}
                          className={`flex gap-4 rounded-xl border p-3 transition-colors sm:p-4 ${
                            state === 'now'
                              ? 'border-emerald-300 bg-white ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-gray-800 dark:ring-emerald-700'
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
                              <p className="font-semibold text-gray-900 dark:text-white">{m.cs.subject?.subjectCode || m.cs.sectionCode}</p>
                              {state === 'done' && <span className="text-xs text-gray-500 dark:text-gray-400">Done</span>}
                              {state === 'now' && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Now</span>}
                            </div>
                            <p className="truncate text-sm text-gray-600 dark:text-gray-300">{m.cs.subject?.subjectName}</p>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" />{m.cs.schedule?.roomLabel || 'Room TBA'}</span>
                              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{teacher || 'Instructor TBA'}</span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>

            {/* Week at a glance */}
            <Panel icon={CalendarDays} title="This week" subtitle="Classes per day">
              <ul className="space-y-1">
                {week.map(({ day, list, hours }) => {
                  const isToday = day === todayName;
                  return (
                    <li key={day} className={`rounded-lg px-3 py-2 ${isToday ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                          {day}{isToday && <span className="ml-1.5 text-xs font-semibold">· today</span>}
                        </span>
                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {list.length ? `${list.length} class${list.length > 1 ? 'es' : ''} · ${Math.round(hours * 10) / 10}h` : 'Free'}
                        </span>
                      </div>
                      {list.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {list.map((m) => `${fmtTime(m.startTime).replace(':00', '')} ${m.cs.subject?.subjectCode}`).join(' · ')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          {/* Subjects */}
          <Panel
            icon={BookOpen}
            title="My subjects"
            subtitle={`${classes.length} subjects · ${totals.units} units${totals.announcements ? ` · ${totals.announcements} announcements` : ''}`}
            action={(
              <Link to="/classes" className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                My classes <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...classes]
                .sort((a, b) => (a.subject?.subjectCode || '').localeCompare(b.subject?.subjectCode || ''))
                .map((cs) => {
                  const slots = cs.schedule?.timeSlots || [];
                  return (
                    <Link
                      key={cs._id}
                      to={`/classes/${classSlug(cs)}`}
                      className="group flex flex-col rounded-xl border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white">{cs.subject?.subjectCode}</p>
                        <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {cs.subject?.units || 0} units
                        </span>
                      </div>
                      <p className="line-clamp-1 text-sm text-gray-600 dark:text-gray-300">{cs.subject?.subjectName}</p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <User className="h-3.5 w-3.5" /> {teacherOf(cs) || 'Instructor TBA'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="h-3.5 w-3.5" />
                        {slots.length
                          ? slots.map((s) => `${s.day.slice(0, 3)} ${fmtTime(s.startTime)}`).join(', ')
                          : 'Schedule to be announced'}
                      </p>
                      {(cs.announcements?.length > 0 || cs.materials?.length > 0) && (
                        <div className="mt-3 flex gap-3 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          {cs.announcements?.length > 0 && <span className="flex items-center gap-1"><Megaphone className="h-3.5 w-3.5" />{cs.announcements.length}</span>}
                          {cs.materials?.length > 0 && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{cs.materials.length}</span>}
                        </div>
                      )}
                    </Link>
                  );
                })}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};

export default StudentDashboard;
