import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { scheduleAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, MapPin, Users, BookOpen, List, Grid3x3,
  AlertTriangle, RefreshCw, Search, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Import background images (same as class spaces)
import bg1 from '../assets/images/class-spaces-bg/GOOGLE-BLUES.jpe';
import bg2 from '../assets/images/class-spaces-bg/Google-Green.jpe';
import bg3 from '../assets/images/class-spaces-bg/Google-Red.jpe';
import bg4 from '../assets/images/class-spaces-bg/Google-Yellows.jpe';

/**
 * A faculty member's teaching schedule - shows only classes they are teaching.
 *
 * Views:
 *   week  - weekly timetable grid (default on desktop)
 *   day   - one day at a time as an agenda (default on phones)
 *   list  - one card per class
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_DAYS = DAYS.slice(0, 5);

const CARD_BACKGROUNDS = [bg1, bg2, bg3, bg4];

const hashOf = (key) => {
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) {
    hash = String(key).charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

/**
 * Maps a subject code to a consistent background image.
 * Uses hashing to ensure the same subject always displays the same background.
 */
const backgroundFor = (key) => CARD_BACKGROUNDS[hashOf(key) % CARD_BACKGROUNDS.length];

const BLOCK_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];
const colorFor = (key) => BLOCK_COLORS[hashOf(key) % BLOCK_COLORS.length];

/** '08:00' -> 8.0, '13:30' -> 13.5 */
const toHours = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h + (m || 0) / 60;
};

const fmt12 = (t) => {
  const h = toHours(t);
  if (h === null) return t;
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
};

const hourLabel = (h) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

/** 1.5 -> '1h 30m', 3 -> '3h', 0.5 -> '30m' */
const fmtDuration = (hours) => {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const isValid = (m) => m.start !== null && m.end !== null && m.end > m.start;

/**
 * Lay out one day's meetings into side-by-side lanes. Each cluster of
 * overlapping classes gets its own lane count, so a lone class keeps its full
 * width even when another part of the day is crowded.
 */
const layoutDay = (list) => {
  const sorted = [...list].sort((a, b) => a.start - b.start || a.end - b.end);
  const result = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneCount = Math.max(1, laneEnds.length);
    cluster.forEach((c) => result.push({ ...c, laneCount }));
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((m) => {
    if (cluster.length && m.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= m.start);
    if (lane === -1) {
      laneEnds.push(m.end);
      lane = laneEnds.length - 1;
    } else {
      laneEnds[lane] = m.end;
    }
    cluster.push({ ...m, lane });
    clusterEnd = Math.max(clusterEnd, m.end);
  });
  flush();
  return result;
};

/* ─── Small presentational pieces ───────────────────────────────────────── */

const Skeleton = () => (
  <div className="space-y-4 animate-pulse" aria-label="Loading your schedule">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
    <div className="h-14 rounded-xl bg-gray-200 dark:bg-gray-700" />
    <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-700" />
  </div>
);

const StatTile = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
    </div>
  </div>
);

const MeetingModal = ({ meeting, conflictsWith, onClose }) => {
  const conflicted = conflictsWith.length > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative p-5 text-white bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.65)), url(${backgroundFor(meeting.subjectCode)})`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <p className="text-xs opacity-80">{meeting.day}</p>
          <h3 className="text-xl font-bold pr-8 break-words">{meeting.subjectCode}</h3>
          {meeting.subjectName && <p className="text-sm opacity-90">{meeting.subjectName}</p>}
        </div>

        <div className="p-5 space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>
              {fmt12(meeting.startTime)} – {fmt12(meeting.endTime)}
              {isValid(meeting) && (
                <span className="text-gray-400"> · {fmtDuration(meeting.end - meeting.start)}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{meeting.section || 'No section'}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{meeting.room || 'Room to be announced'}</span>
          </div>

          {conflicted && (
            <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200 mb-1">
                <AlertTriangle className="w-4 h-4" /> Overlaps with
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                {conflictsWith.map((c) => (
                  <li key={c.id}>
                    {c.subjectCode} ({c.section}) · {fmt12(c.startTime)} – {fmt12(c.endTime)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FacultySchedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [now, setNow] = useState(() => new Date());

  // Faculty ID from the user's facultyProfile
  const facultyId = user?.facultyProfile?._id || user?.facultyProfile;

  const load = useCallback(async () => {
    if (!facultyId) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await scheduleAPI.getAll({ isActive: true, faculty: facultyId });
      setSchedules(response.data.data || []);
    } catch (err) {
      console.error('Load faculty schedule error:', err);
      const message = err.response?.data?.message || 'Failed to load your schedule';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [facultyId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Keep "now" fresh so the time line and "up next" stay accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Escape closes the detail dialog
  useEffect(() => {
    if (!activeMeeting) return undefined;
    const onKey = (e) => e.key === 'Escape' && setActiveMeeting(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeMeeting]);

  const todayName = DAYS[(now.getDay() + 6) % 7];
  const nowHours = now.getHours() + now.getMinutes() / 60;

  // Flatten schedules into individual meetings
  const meetings = useMemo(() => {
    const out = [];
    schedules.forEach((schedule) => {
      (schedule.timeSlots || []).forEach((slot) => {
        out.push({
          id: `${schedule._id}-${slot.day}-${slot.startTime}`,
          scheduleId: schedule._id,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          start: toHours(slot.startTime),
          end: toHours(slot.endTime),
          subjectCode: schedule.subject?.subjectCode || schedule.sectionCode,
          subjectName: schedule.subject?.subjectName || '',
          room: schedule.roomLabel || '',
          section: schedule.sectionCode || '',
        });
      });
    });
    return out;
  }, [schedules]);

  // Overlapping meetings. Always computed on the full set so filtering the
  // view never hides a real conflict.
  const conflicts = useMemo(() => {
    const ids = new Set();
    const withMap = new Map();
    let pairs = 0;
    for (let i = 0; i < meetings.length; i++) {
      for (let j = i + 1; j < meetings.length; j++) {
        const a = meetings[i];
        const b = meetings[j];
        if (a.day !== b.day || !isValid(a) || !isValid(b)) continue;
        if (a.start < b.end && b.start < a.end) {
          pairs += 1;
          ids.add(a.id);
          ids.add(b.id);
          withMap.set(a.id, [...(withMap.get(a.id) || []), b]);
          withMap.set(b.id, [...(withMap.get(b.id) || []), a]);
        }
      }
    }
    const scheduleIds = new Set(
      meetings.filter((m) => ids.has(m.id)).map((m) => m.scheduleId)
    );
    return { ids, withMap, pairs, scheduleIds };
  }, [meetings]);

  const sectionCodes = useMemo(
    () => [...new Set(schedules.map((s) => s.sectionCode).filter(Boolean))].sort(),
    [schedules]
  );

  const matches = useCallback(
    (subjectCode, subjectName, section, room) => {
      if (sectionFilter && section !== sectionFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [subjectCode, subjectName, section, room].some((v) =>
        String(v || '').toLowerCase().includes(q)
      );
    },
    [query, sectionFilter]
  );

  const visibleMeetings = useMemo(
    () => meetings.filter((m) => matches(m.subjectCode, m.subjectName, m.section, m.room)),
    [meetings, matches]
  );

  const visibleSchedules = useMemo(
    () =>
      schedules.filter((s) =>
        matches(s.subject?.subjectCode, s.subject?.subjectName, s.sectionCode, s.roomLabel)
      ),
    [schedules, matches]
  );

  const schedulesWithoutTimes = useMemo(
    () => visibleSchedules.filter((s) => (s.timeSlots || []).length === 0),
    [visibleSchedules]
  );

  const filtersActive = !!(query.trim() || sectionFilter);

  // Grid extents come from ALL meetings so the grid doesn't jump around while filtering
  const { dayStart, hours } = useMemo(() => {
    const starts = meetings.map((m) => m.start).filter((n) => n !== null);
    const ends = meetings.map((m) => m.end).filter((n) => n !== null);
    const first = starts.length ? Math.floor(Math.min(...starts)) : 7;
    const last = ends.length ? Math.ceil(Math.max(...ends)) : 18;
    const list = [];
    for (let h = first; h < Math.max(last, first + 1); h++) list.push(h);
    return { dayStart: first, hours: list };
  }, [meetings]);

  const activeDays = useMemo(
    () => DAYS.filter((d) => meetings.some((m) => m.day === d)),
    [meetings]
  );
  const shownDays = activeDays.length > 0 ? activeDays : DEFAULT_DAYS;

  const layoutByDay = useMemo(() => {
    const out = {};
    shownDays.forEach((day) => {
      out[day] = layoutDay(visibleMeetings.filter((m) => m.day === day && isValid(m)));
    });
    return out;
  }, [shownDays, visibleMeetings]);

  // Day view: default to today when there are classes today, else the first day
  const dayForAgenda =
    selectedDay && shownDays.includes(selectedDay)
      ? selectedDay
      : shownDays.includes(todayName)
      ? todayName
      : shownDays[0];

  const agendaMeetings = useMemo(
    () =>
      visibleMeetings
        .filter((m) => m.day === dayForAgenda)
        .sort((a, b) => (a.start ?? 0) - (b.start ?? 0)),
    [visibleMeetings, dayForAgenda]
  );

  // Summary numbers
  const stats = useMemo(() => {
    const weeklyHours = meetings.filter(isValid).reduce((sum, m) => sum + (m.end - m.start), 0);
    return {
      classes: schedules.length,
      sections: sectionCodes.length,
      weeklyHours,
      days: activeDays.length,
    };
  }, [meetings, schedules, sectionCodes, activeDays]);

  // "Today" panel: what is on now / next, or the next day with classes
  const todayInfo = useMemo(() => {
    const today = meetings
      .filter((m) => m.day === todayName && isValid(m))
      .sort((a, b) => a.start - b.start);
    const current = today.find((m) => m.start <= nowHours && nowHours < m.end) || null;
    const next = today.find((m) => m.start > nowHours) || null;

    let upcoming = null;
    if (!current && !next) {
      const todayIdx = DAYS.indexOf(todayName);
      for (let i = 1; i <= 7 && !upcoming; i++) {
        const day = DAYS[(todayIdx + i) % 7];
        const first = meetings
          .filter((m) => m.day === day && isValid(m))
          .sort((a, b) => a.start - b.start)[0];
        if (first) upcoming = first;
      }
    }
    return { today, current, next, upcoming };
  }, [meetings, todayName, nowHours]);

  const ROW_H = 80;
  const gridCols = `72px repeat(${shownDays.length}, minmax(0, 1fr))`;
  const canvasHeight = hours.length * ROW_H;

  const clearFilters = () => {
    setQuery('');
    setSectionFilter('');
  };

  const openMeeting = (m) => setActiveMeeting(m);

  /* ─── States ──────────────────────────────────────────────────────────── */

  if (loading) return <Skeleton />;

  if (!facultyId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          No faculty profile linked
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Your account isn't linked to a faculty profile yet, so there is no teaching schedule to show. Contact an administrator to have it set up.
        </p>
      </div>
    );
  }

  if (error && schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Couldn't load your schedule
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-5">{error}</p>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          No teaching assignments yet
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          You have not been assigned any classes this semester. Contact the scheduling officer if you believe this is an error.
        </p>
      </div>
    );
  }

  const viewButtons = [
    { key: 'week', label: 'Week', icon: Grid3x3 },
    { key: 'day', label: 'Day', icon: Calendar },
    { key: 'list', label: 'Classes', icon: List },
  ];

  const noMatches = filtersActive && visibleMeetings.length === 0;

  return (
    <div className="space-y-4">
      {/* Conflict Warning Banner */}
      {conflicts.pairs > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 mb-1">
                Schedule conflicts detected
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {conflicts.pairs} overlapping {conflicts.pairs === 1 ? 'pair' : 'pairs'} of classes in your schedule.
                Conflicting classes are marked in red with a warning icon; tap one to see what it overlaps with.
                Please contact the scheduling officer to resolve them.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={BookOpen}
          label={stats.classes === 1 ? 'Class' : 'Classes'}
          value={stats.classes}
          tone="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <StatTile
          icon={Users}
          label={stats.sections === 1 ? 'Section' : 'Sections'}
          value={stats.sections}
          tone="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
        />
        <StatTile
          icon={Clock}
          label="Teaching per week"
          value={stats.weeklyHours ? fmtDuration(stats.weeklyHours) : '—'}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <StatTile
          icon={Calendar}
          label="Teaching days"
          value={stats.days}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300"
        />
      </div>

      {/* Today / up next */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {todayName} ·{' '}
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
            {todayInfo.current ? (
              <p className="text-sm text-gray-900 dark:text-white mt-1">
                <span className="inline-flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Now
                </span>
                <span className="font-semibold">{todayInfo.current.subjectCode}</span>
                {' · '}{todayInfo.current.section}
                {todayInfo.current.room && ` · ${todayInfo.current.room}`}
                {' · until '}{fmt12(todayInfo.current.endTime)}
              </p>
            ) : todayInfo.next ? (
              <p className="text-sm text-gray-900 dark:text-white mt-1">
                <span className="mr-2 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  Up next
                </span>
                <span className="font-semibold">{todayInfo.next.subjectCode}</span>
                {' · '}{todayInfo.next.section}
                {todayInfo.next.room && ` · ${todayInfo.next.room}`}
                {' · '}{fmt12(todayInfo.next.startTime)}
              </p>
            ) : todayInfo.upcoming ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {todayInfo.today.length > 0 ? 'Done for today. ' : 'No classes today. '}
                Next class: <span className="font-semibold">{todayInfo.upcoming.subjectCode}</span>
                {' on '}{todayInfo.upcoming.day}{' at '}{fmt12(todayInfo.upcoming.startTime)}
              </p>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">No upcoming classes.</p>
            )}
          </div>
          {todayInfo.today.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {todayInfo.today.length} {todayInfo.today.length === 1 ? 'class' : 'classes'} today
            </p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, section or room..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              {viewButtons.map(({ key, label, icon: Icon }, i) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  title={`${label} view`}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                    i > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''
                  } ${
                    view === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={load}
              title="Refresh"
              className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {sectionCodes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex-shrink-0">
              Section
            </span>
            {['', ...sectionCodes].map((code) => (
              <button
                key={code || 'all'}
                onClick={() => setSectionFilter(code)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sectionFilter === code
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {code || 'All'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── No matches (week/day) ── */}
      {view !== 'list' && noMatches && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No classes match your filters.</p>
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Week grid ── */}
      {view === 'week' && meetings.length > 0 && !noMatches && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]" style={{ display: 'grid', gridTemplateColumns: gridCols }}>
              {/* Corner */}
              <div className="bg-gray-100 dark:bg-gray-700 border-r border-b border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 py-3 sticky left-0 z-30">
                Time
              </div>

              {/* Day headers */}
              {shownDays.map((day) => {
                const isToday = day === todayName;
                const count = meetings.filter((m) => m.day === day).length;
                return (
                  <div
                    key={day}
                    className={`border-r border-b border-gray-200 dark:border-gray-600 py-3 text-center ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <p className="text-sm font-bold">{day}</p>
                    <p className={`text-[11px] ${isToday ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isToday ? 'Today · ' : ''}{count} {count === 1 ? 'class' : 'classes'}
                    </p>
                  </div>
                );
              })}

              {/* Time labels */}
              <div
                className="relative bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 sticky left-0 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                style={{ height: `${canvasHeight}px` }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-2 text-xs font-semibold text-gray-600 dark:text-gray-400"
                    style={{ top: `${i * ROW_H + 6}px` }}
                  >
                    {hourLabel(h)}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {shownDays.map((day) => {
                const isToday = day === todayName;
                const showNow = isToday && nowHours >= dayStart && nowHours <= dayStart + hours.length;
                return (
                  <div
                    key={day}
                    className={`relative isolate border-r border-gray-200 dark:border-gray-600 ${
                      isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-900'
                    }`}
                    style={{ height: `${canvasHeight}px` }}
                  >
                    {/* Hour + half-hour guide lines */}
                    {hours.map((h, i) => (
                      <React.Fragment key={h}>
                        <div
                          className="absolute inset-x-0 border-t border-gray-200 dark:border-gray-700"
                          style={{ top: `${i * ROW_H}px` }}
                        />
                        <div
                          className="absolute inset-x-0 border-t border-dashed border-gray-100 dark:border-gray-800"
                          style={{ top: `${i * ROW_H + ROW_H / 2}px` }}
                        />
                      </React.Fragment>
                    ))}

                    {/* Current time */}
                    {showNow && (
                      <div
                        className="absolute inset-x-0 z-30 pointer-events-none"
                        style={{ top: `${(nowHours - dayStart) * ROW_H}px` }}
                      >
                        <div className="relative border-t-2 border-red-500">
                          <span className="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500" />
                        </div>
                      </div>
                    )}

                    {/* Class blocks */}
                    {layoutByDay[day].map((m) => {
                      const top = (m.start - dayStart) * ROW_H;
                      const height = Math.max((m.end - m.start) * ROW_H - 4, 28);
                      const isConflicted = conflicts.ids.has(m.id);
                      const laneWidth = 100 / m.laneCount;
                      const roomy = height >= 76;
                      const tall = height >= 100;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => openMeeting(m)}
                          className={`absolute z-20 text-white rounded-lg overflow-hidden shadow-md hover:shadow-xl hover:z-30 transition-all border-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            isConflicted
                              ? 'border-yellow-400 ring-2 ring-red-400/50'
                              : 'border-white/20'
                          }`}
                          style={{
                            top: `${top + 2}px`,
                            height: `${height}px`,
                            left: `${m.lane * laneWidth}%`,
                            width: `calc(${laneWidth}% - 4px)`,
                            marginLeft: '2px',
                            backgroundImage: `url(${backgroundFor(m.subjectCode)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                          title={`${m.subjectCode} - ${m.subjectName}\nSection: ${m.section}\nRoom: ${m.room || 'TBA'}\n${fmt12(m.startTime)} - ${fmt12(m.endTime)}${
                            isConflicted ? '\n⚠️ SCHEDULE CONFLICT!' : ''
                          }`}
                        >
                          <div className={`absolute inset-0 ${isConflicted ? 'bg-red-900/80' : 'bg-black/40'}`} />
                          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-2">
                            {isConflicted && (
                              <AlertTriangle className="absolute top-1 right-1 w-4 h-4 text-yellow-300 animate-pulse" />
                            )}
                            <div className="font-bold text-sm truncate w-full">{m.subjectCode}</div>
                            {roomy && <div className="text-xs opacity-90 truncate w-full">{m.section}</div>}
                            {tall && m.room && (
                              <div className="text-xs opacity-75 mt-1 flex items-center justify-center gap-1 w-full">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{m.room}</span>
                              </div>
                            )}
                            <div className="text-[11px] opacity-80 mt-0.5 truncate w-full">
                              {fmt12(m.startTime)} – {fmt12(m.endTime)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Day agenda ── */}
      {view === 'day' && meetings.length > 0 && !noMatches && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shownDays.map((day) => {
              const count = visibleMeetings.filter((m) => m.day === day).length;
              const active = day === dayForAgenda;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {day.slice(0, 3)}
                  {day === todayName && (
                    <span className={`ml-1.5 text-[10px] ${active ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>
                      today
                    </span>
                  )}
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded-full text-[11px] ${
                      active ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {agendaMeetings.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
              No classes on {dayForAgenda}.
            </div>
          ) : (
            <div className="space-y-3">
              {agendaMeetings.map((m) => {
                const isConflicted = conflicts.ids.has(m.id);
                const live = m.day === todayName && isValid(m) && m.start <= nowHours && nowHours < m.end;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => openMeeting(m)}
                    className={`w-full text-left flex items-stretch gap-4 bg-white dark:bg-gray-800 rounded-xl border p-4 hover:shadow-md transition-shadow ${
                      isConflicted
                        ? 'border-red-300 dark:border-red-700'
                        : live
                        ? 'border-green-300 dark:border-green-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="w-20 flex-shrink-0 text-sm">
                      <p className="font-bold text-gray-900 dark:text-white">{fmt12(m.startTime)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{fmt12(m.endTime)}</p>
                    </div>
                    <div className={`w-1 rounded-full flex-shrink-0 ${isConflicted ? 'bg-red-500' : colorFor(m.subjectCode)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{m.subjectCode}</h3>
                        {live && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
                            Now
                          </span>
                        )}
                        {isConflicted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[11px] font-semibold">
                            <AlertTriangle className="w-3 h-3" /> Conflict
                          </span>
                        )}
                      </div>
                      {m.subjectName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{m.subjectName}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{m.section}</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{m.room || 'TBA'}</span>
                        {isValid(m) && (
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmtDuration(m.end - m.start)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Week/day with only untimed classes ── */}
      {view !== 'list' && meetings.length === 0 && schedulesWithoutTimes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Your classes don't have meeting times scheduled yet
          </p>
          <button
            onClick={() => setView('list')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            View as list instead
          </button>
        </div>
      )}

      {/* ── Class list ── */}
      {view === 'list' && (
        <>
          {visibleSchedules.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-3">No classes match your filters.</p>
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleSchedules.map((schedule) => {
                const slots = [...(schedule.timeSlots || [])].sort(
                  (a, b) =>
                    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
                    String(a.startTime).localeCompare(String(b.startTime))
                );
                const weekly = slots.reduce((sum, s) => {
                  const st = toHours(s.startTime);
                  const en = toHours(s.endTime);
                  return st !== null && en !== null && en > st ? sum + (en - st) : sum;
                }, 0);
                const hasConflict = conflicts.scheduleIds.has(schedule._id);
                return (
                  <div
                    key={schedule._id}
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-4 hover:shadow-md transition-shadow flex gap-3 ${
                      hasConflict
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${hasConflict ? 'bg-red-500' : colorFor(schedule.subject?.subjectCode)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {schedule.subject?.subjectCode}
                        </h3>
                        {hasConflict && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[11px] font-semibold flex-shrink-0">
                            <AlertTriangle className="w-3 h-3" /> Conflict
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-1">
                        {schedule.subject?.subjectName}
                      </p>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4 flex-shrink-0" />
                          <span>{schedule.sectionCode}</span>
                        </div>

                        {schedule.roomLabel && (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span>{schedule.roomLabel}</span>
                          </div>
                        )}

                        {slots.length > 0 ? (
                          <div className="space-y-1">
                            {slots.map((slot, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <Clock className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs">
                                  {slot.day} {fmt12(slot.startTime)} - {fmt12(slot.endTime)}
                                </span>
                              </div>
                            ))}
                            {weekly > 0 && (
                              <p className="text-[11px] text-gray-400 pl-6">{fmtDuration(weekly)} per week</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">No meeting times yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Classes without meeting times (list view only; the others show them via the empty state) */}
      {view === 'list' && schedulesWithoutTimes.length > 0 && schedulesWithoutTimes.length < visibleSchedules.length && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {schedulesWithoutTimes.length} {schedulesWithoutTimes.length === 1 ? 'class has' : 'classes have'} no meeting times yet and won't appear in the week or day view.
        </p>
      )}

      {activeMeeting && (
        <MeetingModal
          meeting={activeMeeting}
          conflictsWith={conflicts.withMap.get(activeMeeting.id) || []}
          onClose={() => setActiveMeeting(null)}
        />
      )}
    </div>
  );
};

export default FacultySchedule;