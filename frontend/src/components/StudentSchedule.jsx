import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, MapPin, User, Users, BookOpen, UserPlus, List, Grid3x3,
  AlertTriangle, RefreshCw, Search, X, ExternalLink
} from 'lucide-react';
import { ModalShell } from './modal/ModalShell';

// Import background images (same as ClassSpacePage)
import bg1 from '../assets/images/class-spaces-bg/GOOGLE-BLUES.jpe';
import bg2 from '../assets/images/class-spaces-bg/Google-Green.jpe';
import bg3 from '../assets/images/class-spaces-bg/Google-Red.jpe';
import bg4 from '../assets/images/class-spaces-bg/Google-Yellows.jpe';

/**
 * A student's own timetable, built from the classes they are enrolled in.
 *
 * The management schedule page filters by program, which for a student means
 * "every schedule in BSIT" rather than "my classes". This reads the same source
 * of truth as My Classes, so the two can never disagree.
 *
 * Views:
 *   week - weekly timetable grid (default on desktop)
 *   day  - one day at a time as an agenda (default on phones)
 *   list - every day, grouped
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_DAYS = DAYS.slice(0, 5);

// Background images array (same as ClassSpacePage for consistency)
const CARD_BACKGROUNDS = [bg1, bg2, bg3, bg4];

/**
 * Maps a subject code to a consistent background image.
 * Uses the same hashing algorithm as ClassSpacePage to ensure the same subject
 * displays the same background image in both class space cards and schedule blocks.
 */
const backgroundFor = (key) => {
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) {
    hash = String(key).charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_BACKGROUNDS[Math.abs(hash) % CARD_BACKGROUNDS.length];
};

/**
 * Same slug as ClassSpacePage (subjectcode-section-year), so a timetable block
 * can open that exact class instead of dumping the student on the class grid.
 */
const generateClassSlug = (cs) => {
  const subjectCode = (cs?.subject?.subjectCode || cs?.sectionCode || 'class').toLowerCase();
  const sectionCode = (cs?.section?.sectionCode || cs?.sectionCode || '').toLowerCase();
  const year = cs?.section?.year || cs?.year || '';
  return [subjectCode, sectionCode, year]
    .filter(Boolean)
    .join('-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

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
 * width even when another part of the day is crowded, and a conflict is visible
 * instead of one class hiding the other.
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
  <div className="space-y-4" aria-label="Loading your schedule">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
      ))}
    </div>
    <div className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
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

const MeetingModal = ({ meeting, conflictsWith, onClose, onOpenClass }) => {
  const conflicted = conflictsWith.length > 0;
  return (
    <ModalShell onClose={onClose} size="sm" label="Class details" guardDirty={false} focusFirstField={false}>
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
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>{meeting.teacher || 'Instructor to be announced'}</span>
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
                    {c.subjectCode} · {fmt12(c.startTime)} – {fmt12(c.endTime)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => onOpenClass(meeting)}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open class
          </button>
        </div>
    </ModalShell>
  );
};

const StudentSchedule = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolled, setEnrolled] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'
  );
  const [query, setQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await classSpaceAPI.getMyClasses();
      setClasses(response.data.data || []);
      setEnrolled(response.data.enrolled !== false);
      setProfile(response.data.profile || null);
    } catch (err) {
      console.error('Load student schedule error:', err);
      const message = err.response?.data?.message || 'Failed to load your schedule';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep "now" fresh so the time line and "up next" stay accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Escape closes the detail dialog via ModalShell

  const todayName = DAYS[(now.getDay() + 6) % 7];
  const nowHours = now.getHours() + now.getMinutes() / 60;

  // Flatten class spaces into individual meetings
  const meetings = useMemo(() => {
    const out = [];
    classes.forEach((cs) => {
      (cs.schedule?.timeSlots || []).forEach((slot) => {
        out.push({
          id: `${cs._id}-${slot.day}-${slot.startTime}`,
          classSpaceId: cs._id,
          slug: generateClassSlug(cs),
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          start: toHours(slot.startTime),
          end: toHours(slot.endTime),
          subjectCode: cs.subject?.subjectCode || cs.sectionCode,
          subjectName: cs.subject?.subjectName || '',
          // roomLabel is resolved server-side; Schedule.room holds a raw id
          room: cs.schedule?.roomLabel || '',
          teacher: cs.faculty?.user
            ? `${cs.faculty.user.firstName || ''} ${cs.faculty.user.lastName || ''}`.trim()
            : '',
        });
      });
    });
    return out;
  }, [classes]);

  const classesWithoutTimes = useMemo(
    () => classes.filter((cs) => (cs.schedule?.timeSlots || []).length === 0),
    [classes]
  );

  // Overlapping meetings, always computed on the full set so searching never
  // hides a real conflict (irregular students can end up with clashes).
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
    return { ids, withMap, pairs };
  }, [meetings]);

  const visibleMeetings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meetings;
    return meetings.filter((m) =>
      [m.subjectCode, m.subjectName, m.teacher, m.room].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [meetings, query]);

  // Grid extents come from ALL meetings so the grid doesn't jump around while searching
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

  /*
   * The grid is a time canvas, not a cell table: every day column is one
   * relatively positioned box `hours.length * ROW_H` tall, and each meeting is
   * absolutely placed from its real start/end. CSS Grid auto-placement plus
   * row spans drifted the columns, and rounding the span to whole hours dropped
   * 30-minute classes.
   */
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

  const stats = useMemo(() => {
    const weeklyHours = meetings.filter(isValid).reduce((sum, m) => sum + (m.end - m.start), 0);
    const teachers = new Set(meetings.map((m) => m.teacher).filter(Boolean));
    return {
      classes: classes.length,
      days: activeDays.length,
      weeklyHours,
      teachers: teachers.size,
    };
  }, [meetings, classes, activeDays]);

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

  const ROW_H = 72;
  const gridCols = `64px repeat(${shownDays.length}, minmax(0, 1fr))`;
  const canvasHeight = hours.length * ROW_H;

  const openClass = (m) => {
    setActiveMeeting(null);
    navigate(`/classes/${m.slug}`);
  };

  /* ─── States ──────────────────────────────────────────────────────────── */

  if (loading) return <Skeleton />;

  if (error && classes.length === 0) {
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

  if (!enrolled || classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {!enrolled ? 'You have not joined any classes yet' : 'No classes scheduled yet'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
          {!enrolled
            ? profile?.studentType === 'irregular'
              ? 'Join a subject using a class code from your instructor, then your timetable will appear here.'
              : 'Join your section using the enrollment code from your program manager, then your timetable will appear here.'
            : 'Your classes exist but do not have meeting times set yet. Check back once the timetable is finalised.'}
        </p>
        {!enrolled && (
          <button
            onClick={() => navigate('/classes')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {profile?.studentType === 'irregular' ? 'Join a Subject' : 'Join My Section'}
          </button>
        )}
      </div>
    );
  }

  const viewButtons = [
    { key: 'week', label: 'Week', icon: Grid3x3 },
    { key: 'day', label: 'Day', icon: Calendar },
    { key: 'list', label: 'List', icon: List },
  ];

  const noMatches = !!query.trim() && visibleMeetings.length === 0;

  return (
    <div className="space-y-4">
      {/* Conflict Warning Banner */}
      {conflicts.pairs > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 mb-1">
                Overlapping classes
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {conflicts.pairs} overlapping {conflicts.pairs === 1 ? 'pair' : 'pairs'} of classes in your timetable.
                They're marked in red; tap one to see what it overlaps with, and let your program manager or scheduling officer know.
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
          icon={Calendar}
          label="Class days"
          value={stats.days}
          tone="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300"
        />
        <StatTile
          icon={Clock}
          label="In class per week"
          value={stats.weeklyHours ? fmtDuration(stats.weeklyHours) : '—'}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
        <StatTile
          icon={Users}
          label={stats.teachers === 1 ? 'Instructor' : 'Instructors'}
          value={stats.teachers}
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
              {profile?.sectionCode ? ` · Section ${profile.sectionCode}` : ''}
              {profile?.academicYear ? ` · ${profile.academicYear}` : ''}
              {profile?.semester ? ` · Sem ${profile.semester}` : ''}
            </p>
            {todayInfo.current ? (
              <p className="text-sm text-gray-900 dark:text-white mt-1">
                <span className="inline-flex items-center gap-1.5 mr-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Now
                </span>
                <span className="font-semibold">{todayInfo.current.subjectCode}</span>
                {todayInfo.current.room && ` · ${todayInfo.current.room}`}
                {' · until '}{fmt12(todayInfo.current.endTime)}
              </p>
            ) : todayInfo.next ? (
              <p className="text-sm text-gray-900 dark:text-white mt-1">
                <span className="mr-2 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  Up next
                </span>
                <span className="font-semibold">{todayInfo.next.subjectCode}</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subject, instructor or room..."
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
      </div>

      {/* ── No matches ── */}
      {noMatches && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No classes match your search.</p>
          <button
            onClick={() => setQuery('')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
          >
            Clear search
          </button>
        </div>
      )}

      {/* ── Week grid ── */}
      {view === 'week' && meetings.length > 0 && !noMatches && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]" style={{ display: 'grid', gridTemplateColumns: gridCols }}>
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
                    <p className="text-sm font-bold">{day.slice(0, 3)}</p>
                    <p className={`text-[11px] ${isToday ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isToday ? 'Today · ' : ''}{count} {count === 1 ? 'class' : 'classes'}
                    </p>
                  </div>
                );
              })}

              {/* Hour gutter: fixes the row height every other column relies on.
                  Sticky and above the day columns so class blocks never slide
                  over it when the grid scrolls sideways on a phone. */}
              <div
                className="relative bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 sticky left-0 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                style={{ height: `${canvasHeight}px` }}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute right-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400"
                    style={{ top: `${i * ROW_H + 6}px` }}
                  >
                    {fmt12(`${String(h).padStart(2, '0')}:00`)}
                  </div>
                ))}
              </div>

              {/* One relative column per day. `isolate` keeps blocks and the
                  time line inside their column's stacking context. */}
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
                      const roomy = height >= 64;
                      const tall = height >= 96;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setActiveMeeting(m)}
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
                          title={`${m.subjectCode}${m.subjectName ? ` - ${m.subjectName}` : ''}\n${fmt12(m.startTime)} - ${fmt12(m.endTime)}${m.room ? `\nRoom: ${m.room}` : ''}${m.teacher ? `\n${m.teacher}` : ''}${
                            isConflicted ? '\n⚠️ OVERLAPS ANOTHER CLASS' : ''
                          }`}
                        >
                          <div className={`absolute inset-0 ${isConflicted ? 'bg-red-900/80' : 'bg-black/40'}`} />
                          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-2">
                            {isConflicted && (
                              <AlertTriangle className="absolute top-1 right-1 w-4 h-4 text-yellow-300 animate-pulse" />
                            )}
                            <div className="font-bold text-xs sm:text-sm truncate w-full">{m.subjectCode}</div>
                            {roomy && m.subjectName && (
                              <div className="text-[10px] sm:text-xs opacity-90 truncate w-full">{m.subjectName}</div>
                            )}
                            {tall && m.room && (
                              <div className="text-[10px] sm:text-xs opacity-75 mt-0.5 flex items-center justify-center gap-1 w-full">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{m.room}</span>
                              </div>
                            )}
                            <div className="text-[10px] sm:text-[11px] opacity-80 mt-0.5 truncate w-full">
                              {fmt12(m.startTime)} – {fmt12(m.endTime)}
                            </div>
                            {tall && m.teacher && (
                              <div className="text-[10px] opacity-75 truncate w-full mt-0.5">{m.teacher}</div>
                            )}
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
                    onClick={() => setActiveMeeting(m)}
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
                    <div
                      className="w-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundImage: isConflicted ? undefined : `url(${backgroundFor(m.subjectCode)})`,
                        backgroundColor: isConflicted ? '#ef4444' : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
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
                            <AlertTriangle className="w-3 h-3" /> Overlap
                          </span>
                        )}
                      </div>
                      {m.subjectName && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{m.subjectName}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" />{m.teacher || 'TBA'}</span>
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

      {/* ── List view, grouped by day ── */}
      {view === 'list' && meetings.length > 0 && !noMatches && (
        <div className="space-y-4">
          {shownDays.map((day) => {
            const dayMeetings = visibleMeetings
              .filter((m) => m.day === day)
              .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
            if (dayMeetings.length === 0) return null;
            const isToday = day === todayName;

            return (
              <div
                key={day}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className={`px-4 py-2 border-b flex items-center justify-between ${
                    isToday
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                    {day}
                    {isToday && (
                      <span className="ml-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400">Today</span>
                    )}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {dayMeetings.length} {dayMeetings.length === 1 ? 'class' : 'classes'}
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dayMeetings.map((m) => {
                    const isConflicted = conflicts.ids.has(m.id);
                    const live = isToday && isValid(m) && m.start <= nowHours && nowHours < m.end;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setActiveMeeting(m)}
                        className="w-full text-left flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div
                          className="w-1.5 self-stretch rounded-full flex-shrink-0"
                          style={{
                            backgroundImage: isConflicted ? undefined : `url(${backgroundFor(m.subjectCode)})`,
                            backgroundColor: isConflicted ? '#ef4444' : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">{m.subjectCode}</p>
                            {live && (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[11px] font-semibold">
                                Now
                              </span>
                            )}
                            {isConflicted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[11px] font-semibold">
                                <AlertTriangle className="w-3 h-3" /> Overlap
                              </span>
                            )}
                          </div>
                          {m.subjectName && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{m.subjectName}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmt12(m.startTime)} - {fmt12(m.endTime)}
                            </span>
                            {m.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {m.room}
                              </span>
                            )}
                            {m.teacher && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {m.teacher}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Classes with no meeting times yet would otherwise vanish from the grid */}
      {classesWithoutTimes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
            Not yet scheduled
          </p>
          <div className="space-y-1">
            {classesWithoutTimes.map((cs) => (
              <div
                key={cs._id}
                className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300"
              >
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium">{cs.subject?.subjectCode}</span>
                <span className="opacity-75 truncate">{cs.subject?.subjectName}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
            These classes have no meeting times set yet.
          </p>
        </div>
      )}

      {activeMeeting && (
        <MeetingModal
          meeting={activeMeeting}
          conflictsWith={conflicts.withMap.get(activeMeeting.id) || []}
          onClose={() => setActiveMeeting(null)}
          onOpenClass={openClass}
        />
      )}
    </div>
  );
};

export default StudentSchedule;