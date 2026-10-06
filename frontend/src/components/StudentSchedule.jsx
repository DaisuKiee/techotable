import React, { useState, useEffect } from 'react';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, User, BookOpen, UserPlus, List, Grid3x3 } from 'lucide-react';

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
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** '08:00' -> 8.0, '13:30' -> 13.5 */
const toHours = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
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

const StudentSchedule = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(true);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('grid');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const response = await classSpaceAPI.getMyClasses();
      setClasses(response.data.data || []);
      setEnrolled(response.data.enrolled !== false);
      setProfile(response.data.profile || null);
    } catch (error) {
      console.error('Load student schedule error:', error);
      toast.error(error.response?.data?.message || 'Failed to load your schedule');
    } finally {
      setLoading(false);
    }
  };

  // Flatten class spaces into individual meetings
  const meetings = [];
  classes.forEach((cs) => {
    (cs.schedule?.timeSlots || []).forEach((slot) => {
      meetings.push({
        id: `${cs._id}-${slot.day}-${slot.startTime}`,
        classSpaceId: cs._id,
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

  const classesWithoutTimes = classes.filter(
    (cs) => (cs.schedule?.timeSlots || []).length === 0
  );

  // Only render the hours the student actually has classes in
  const starts = meetings.map((m) => m.start).filter((n) => n !== null);
  const ends = meetings.map((m) => m.end).filter((n) => n !== null);
  const dayStart = starts.length ? Math.floor(Math.min(...starts)) : 7;
  const dayEnd = ends.length ? Math.ceil(Math.max(...ends)) : 18;
  const hours = [];
  for (let h = dayStart; h < dayEnd; h++) hours.push(h);

  const activeDays = DAYS.filter((d) => meetings.some((m) => m.day === d));
  const shownDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  /*
   * The grid is a time canvas, not a cell table: every day column is one
   * relatively positioned box `hours.length * ROW_H` tall, and each meeting is
   * absolutely placed from its real start/end. CSS Grid auto-placement plus
   * row spans drifted the columns (a spanned cell already owns the slot the
   * next placeholder wanted), and rounding the span to whole hours dropped
   * 30-minute classes.
   *
   * Overlaps get side-by-side lanes so a conflict is visible instead of one
   * class hiding the other.
   */
  const laneWidthPct = (laneCount) => 100 / Math.max(1, laneCount);

  const layoutByDay = {};
  shownDays.forEach((day) => {
    const dayMeetings = meetings
      .filter((m) => m.day === day && m.start !== null && m.end !== null && m.end > m.start)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const laneEnds = [];
    const placed = dayMeetings.map((m) => {
      let lane = laneEnds.findIndex((end) => end <= m.start);
      if (lane === -1) {
        laneEnds.push(m.end);
        lane = laneEnds.length - 1;
      } else {
        laneEnds[lane] = m.end;
      }
      return { ...m, lane };
    });

    layoutByDay[day] = { placed, laneCount: Math.max(1, laneEnds.length) };
  });

  const ROW_H = 64;
  const gridCols = `64px repeat(${shownDays.length}, minmax(0, 1fr))`;
  const canvasHeight = hours.length * ROW_H;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading your schedule...</p>
        </div>
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
            onClick={() => (window.location.href = '/classes')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {profile?.studentType === 'irregular' ? 'Join a Subject' : 'Join My Section'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Weekly Schedule</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {classes.length} {classes.length === 1 ? 'class' : 'classes'}
              {profile?.sectionCode ? ` · Section ${profile.sectionCode}` : ''}
              {profile?.academicYear ? ` · ${profile.academicYear}` : ''}
              {profile?.semester ? ` · Sem ${profile.semester}` : ''}
            </p>
          </div>
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`px-3 py-2 transition-colors ${
                view === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
              title="Timetable view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 border-l border-gray-300 dark:border-gray-600 transition-colors ${
                view === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Timetable */}
      {view === 'grid' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Day header */}
            <div
              className="grid border-b border-gray-200 dark:border-gray-700"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="border-r border-gray-200 dark:border-gray-700" />
              {shownDays.map((day) => (
                <div
                  key={day}
                  className="border-r border-gray-200 dark:border-gray-700 last:border-r-0 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Time canvas */}
            <div className="grid" style={{ gridTemplateColumns: gridCols }}>
              {/* Hour gutter: fixes the row height every other column relies on */}
              <div
                className="border-r border-gray-200 dark:border-gray-700"
                style={{ height: canvasHeight }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="flex items-start justify-end pr-2 pt-1 text-[11px] leading-none text-gray-500 dark:text-gray-400"
                    style={{ height: ROW_H }}
                  >
                    {fmt12(`${String(h).padStart(2, '0')}:00`)}
                  </div>
                ))}
              </div>

              {/* One relative column per day */}
              {shownDays.map((day) => {
                const { placed, laneCount } = layoutByDay[day];
                const width = laneWidthPct(laneCount);

                return (
                  <div
                    key={day}
                    className="relative border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                    style={{ height: canvasHeight }}
                  >
                    {/* Hour lines */}
                    {hours.map((h, i) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/60"
                        style={{ top: i * ROW_H }}
                      />
                    ))}

                    {placed.map((m) => (
                      <div
                        key={m.id}
                        className="absolute p-0.5"
                        style={{
                          top: (m.start - dayStart) * ROW_H,
                          height: (m.end - m.start) * ROW_H,
                          left: `${m.lane * width}%`,
                          width: `${width}%`,
                        }}
                      >
                        <div
                          className="h-full w-full overflow-hidden rounded-lg px-2 py-2 text-white cursor-pointer hover:opacity-90 transition-opacity flex flex-col items-center justify-center text-center"
                          style={{
                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url(${backgroundFor(m.subjectCode)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                          onClick={() => (window.location.href = '/classes')}
                          title={`${m.subjectCode}${m.subjectName ? ` - ${m.subjectName}` : ''}\n${fmt12(m.startTime)} - ${fmt12(m.endTime)}${m.teacher ? `\n${m.teacher}` : ''}`}
                        >
                          <p className="font-bold text-xs leading-tight truncate w-full">
                            {m.subjectCode}
                          </p>
                          {m.subjectName && (
                            <p className="text-[10px] opacity-90 leading-tight truncate w-full mt-0.5">
                              {m.subjectName}
                            </p>
                          )}
                          <p className="text-[10px] opacity-90 leading-tight mt-1">
                            {fmt12(m.startTime)} - {fmt12(m.endTime)}
                          </p>
                          {m.teacher && (
                            <p className="text-[10px] opacity-80 truncate w-full mt-0.5">{m.teacher}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* List view, grouped by day */
        <div className="space-y-4">
          {shownDays.map((day) => {
            const dayMeetings = meetings
              .filter((m) => m.day === day)
              .sort((a, b) => a.start - b.start);
            if (dayMeetings.length === 0) return null;

            return (
              <div
                key={day}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{day}</h3>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {dayMeetings.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => (window.location.href = '/classes')}
                      className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <div 
                        className="w-1.5 self-stretch rounded-full"
                        style={{
                          backgroundImage: `url(${backgroundFor(m.subjectCode)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {m.subjectCode}
                        </p>
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
                    </div>
                  ))}
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
    </div>
  );
};

export default StudentSchedule;
