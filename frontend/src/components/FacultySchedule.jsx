import React, { useState, useEffect } from 'react';
import { scheduleAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, Users, BookOpen, List, Grid3x3, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Import background images (same as class spaces)
import bg1 from '../assets/images/class-spaces-bg/GOOGLE-BLUES.jpe';
import bg2 from '../assets/images/class-spaces-bg/Google-Green.jpe';
import bg3 from '../assets/images/class-spaces-bg/Google-Red.jpe';
import bg4 from '../assets/images/class-spaces-bg/Google-Yellows.jpe';

/**
 * A faculty member's teaching schedule - shows only classes they are teaching
 * Similar UI to StudentSchedule but filtered to faculty's assignments
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CARD_BACKGROUNDS = [bg1, bg2, bg3, bg4];

/**
 * Maps a subject code to a consistent background image.
 * Uses hashing to ensure the same subject always displays the same background.
 */
const backgroundFor = (key) => {
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) {
    hash = String(key).charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_BACKGROUNDS[Math.abs(hash) % CARD_BACKGROUNDS.length];
};

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

const BLOCK_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

const colorFor = (key) => {
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) {
    hash = String(key).charCodeAt(i) + ((hash << 5) - hash);
  }
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length];
};

const FacultySchedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  const load = async () => {
    try {
      setLoading(true);
      
      // Get the faculty ID from the user's facultyProfile
      const facultyId = user?.facultyProfile?._id || user?.facultyProfile;
      
      console.log('FacultySchedule - User:', user);
      console.log('FacultySchedule - Faculty ID:', facultyId);
      
      if (!facultyId) {
        console.error('No faculty profile found for user');
        setSchedules([]);
        setLoading(false);
        return;
      }
      
      const params = {
        isActive: true,
        faculty: facultyId
      };
      
      console.log('FacultySchedule - Fetching with params:', params);
      const response = await scheduleAPI.getAll(params);
      console.log('FacultySchedule - Response:', response.data);
      setSchedules(response.data.data || []);
    } catch (error) {
      console.error('Load faculty schedule error:', error);
      toast.error(error.response?.data?.message || 'Failed to load your schedule');
    } finally {
      setLoading(false);
    }
  };

  // Flatten schedules into individual meetings
  const meetings = [];
  schedules.forEach((schedule) => {
    (schedule.timeSlots || []).forEach((slot) => {
      meetings.push({
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

  // Detect conflicts (overlapping times)
  const conflictIds = new Set();
  meetings.forEach((m1, i) => {
    meetings.forEach((m2, j) => {
      if (i >= j) return; // Don't compare with self or already compared pairs
      if (m1.day !== m2.day) return; // Different days don't conflict
      
      // Check if times overlap
      const overlap = m1.start < m2.end && m2.start < m1.end;
      if (overlap) {
        conflictIds.add(m1.id);
        conflictIds.add(m2.id);
      }
    });
  });

  const schedulesWithoutTimes = schedules.filter(
    (s) => (s.timeSlots || []).length === 0
  );

  // Only render the hours the faculty actually has classes in
  const starts = meetings.map((m) => m.start).filter((n) => n !== null);
  const ends = meetings.map((m) => m.end).filter((n) => n !== null);
  const dayStart = starts.length ? Math.floor(Math.min(...starts)) : 7;
  const dayEnd = ends.length ? Math.ceil(Math.max(...ends)) : 18;
  const hours = [];
  for (let h = dayStart; h < dayEnd; h++) hours.push(h);

  const activeDays = DAYS.filter((d) => meetings.some((m) => m.day === d));
  const shownDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

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

  const ROW_H = 80; // Increased from 64px for better readability
  const gridCols = `80px repeat(${shownDays.length}, minmax(0, 1fr))`; // Increased time column width
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

  return (
    <div className="space-y-4">
      {/* Conflict Warning Banner */}
      {conflictIds.size > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 mb-1">
                Schedule Conflicts Detected
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                You have {conflictIds.size / 2} overlapping {conflictIds.size === 2 ? 'class' : 'classes'} in your schedule. 
                Conflicting classes are marked in red with a warning icon. Please contact the scheduling officer to resolve these conflicts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Teaching Schedule</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {schedules.length} {schedules.length === 1 ? 'class' : 'classes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
              title="Grid View"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <div
              key={schedule._id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className={`w-1 h-full ${colorFor(schedule.subject?.subjectCode)} rounded-full`} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {schedule.subject?.subjectCode}
                  </h3>
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
                    
                    {schedule.timeSlots && schedule.timeSlots.length > 0 && (
                      <div className="space-y-1">
                        {schedule.timeSlots.map((slot, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span className="text-xs">
                              {slot.day} {fmt12(slot.startTime)} - {fmt12(slot.endTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {schedulesWithoutTimes.length > 0 && (
            <div className="col-span-full">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Classes without meeting times
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {schedulesWithoutTimes.map((schedule) => (
                  <div
                    key={schedule._id}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-3"
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {schedule.subject?.subjectCode}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {schedule.sectionCode}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'grid' && meetings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0' }}>
              {/* Top-left corner cell */}
              <div className="bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 border-r border-b border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 py-3 sticky left-0 z-10">
                Time
              </div>
              {/* Day headers */}
              {shownDays.map((day) => (
                <div
                  key={day}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-r border-b border-gray-200 dark:border-gray-600 flex items-center justify-center text-sm font-bold text-gray-800 dark:text-gray-200 py-3"
                >
                  {day}
                </div>
              ))}
              {/* Time labels + day canvases */}
              {hours.map((h, hIndex) => (
                <React.Fragment key={h}>
                  <div className="bg-gray-50 dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-600 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400 sticky left-0 z-10">
                    <div className="text-center">
                      <div className="font-bold">
                        {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                      </div>
                    </div>
                  </div>
                  {shownDays.map((day) => {
                    const layout = layoutByDay[day];
                    return (
                      <div
                        key={day}
                        className="relative border-r border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        style={{ height: `${ROW_H}px`, minHeight: `${ROW_H}px` }}
                      >
                        {/* First row: render all classes for this day */}
                        {hIndex === 0 &&
                          layout.placed.map((m) => {
                            const top = (m.start - dayStart) * ROW_H;
                            const height = (m.end - m.start) * ROW_H;
                            const isConflicted = conflictIds.has(m.id);
                            const color = isConflicted ? 'bg-red-600' : colorFor(m.subjectCode);
                            return (
                              <div
                                key={m.id}
                                className={`absolute text-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer border-2 ${
                                  isConflicted 
                                    ? 'border-yellow-400 ring-2 ring-red-400/50' 
                                    : 'border-white/20'
                                } hover:scale-[1.02] z-20`}
                                style={{
                                  top: `${top}px`,
                                  height: `${Math.max(height - 4, 40)}px`,
                                  left: `${m.lane * laneWidthPct(layout.laneCount)}%`,
                                  width: `${laneWidthPct(layout.laneCount) - 2}%`,
                                  marginLeft: '1%',
                                  backgroundImage: `url(${backgroundFor(m.subjectCode)})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                                title={`${m.subjectCode} - ${m.subjectName}\nSection: ${m.section}\nRoom: ${m.room}\n${fmt12(m.startTime)} - ${fmt12(m.endTime)}${
                                  isConflicted ? '\n⚠️ SCHEDULE CONFLICT!' : ''
                                }`}
                              >
                                {/* Semi-transparent overlay for readability */}
                                <div className={`absolute inset-0 ${isConflicted ? 'bg-red-900/80' : 'bg-black/40'}`} />
                                
                                {/* Content - Centered */}
                                <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-2">
                                  {isConflicted && (
                                    <div className="absolute top-1 right-1 animate-pulse">
                                      <AlertTriangle className="w-4 h-4 text-yellow-300" />
                                    </div>
                                  )}
                                  <div className="font-bold text-sm truncate w-full">{m.subjectCode}</div>
                                  <div className="text-xs opacity-90 truncate w-full">{m.section}</div>
                                  {m.room && <div className="text-xs opacity-75 truncate mt-1 flex items-center justify-center gap-1 w-full">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{m.room}</span>
                                  </div>}
                                  <div className="text-xs opacity-75 mt-1 flex items-center justify-center gap-1 w-full">
                                    <Clock className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{fmt12(m.startTime)} - {fmt12(m.endTime)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'grid' && meetings.length === 0 && schedulesWithoutTimes.length > 0 && (
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
    </div>
  );
};

export default FacultySchedule;
