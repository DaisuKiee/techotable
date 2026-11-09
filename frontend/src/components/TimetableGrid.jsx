import React, { useMemo, useState } from 'react';
import { Clock, Utensils, MapPin, User } from 'lucide-react';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// All time slots in 24-hour format
const ALL_TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00'
];

/**
 * Fixed height of one hour row, in pixels.
 *
 * Pinned on the time-label cell of every row so a cell with rowSpan={n} is
 * always exactly n rows tall. Without this, rows sized themselves to their
 * tallest card while rows covered by a rowSpan collapsed, so multi-hour blocks
 * never lined up with their hour labels.
 */
const ROW_H = 74;

const toMinutes = (time) => {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
};

const formatTime12Hour = (time24) => {
  const mins = toMinutes(time24);
  if (mins === null) return time24 || '';
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

/** Short label for the time gutter, e.g. "8 AM". */
const shortHourLabel = (time24) => {
  const mins = toMinutes(time24);
  if (mins === null) return time24 || '';
  const hours = Math.floor(mins / 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12} ${period}`;
};

const isLunchBreak = (time) => time === '12:00';

const durationHours = (slot) => {
  const start = toMinutes(slot?.startTime);
  const end = toMinutes(slot?.endTime);
  if (start === null || end === null || end <= start) return 1;
  return Math.max(1, Math.ceil((end - start) / 60));
};

const facultyName = (schedule) => {
  const u = schedule?.faculty?.user;
  const name = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  return name || null;
};

const TimetableGrid = ({
  schedules = [],
  onScheduleClick,
  canEdit,
  viewMode = 'week',
  shift = 'all',
  // When several sections share the grid, label each card so it's clear which
  // section a class belongs to.
  showSection = false,
}) => {
  const [selectedDay, setSelectedDay] = useState('Monday');

  const TIME_SLOTS = useMemo(() => {
    if (shift === 'Day') {
      return ALL_TIME_SLOTS.filter(t => {
        const h = Math.floor(toMinutes(t) / 60);
        return h >= 7 && h < 16;
      });
    }
    if (shift === 'Night') {
      return ALL_TIME_SLOTS.filter(t => {
        const h = Math.floor(toMinutes(t) / 60);
        return h >= 16 && h <= 21;
      });
    }
    return ALL_TIME_SLOTS;
  }, [shift]);

  // Only show Sunday when something is actually scheduled on it
  const days = useMemo(() => {
    const used = new Set();
    schedules.forEach(s => (s.timeSlots || []).forEach(sl => used.add(sl.day)));
    return WEEK_DAYS.filter(d => d !== 'Sunday' || used.has('Sunday'));
  }, [schedules]);

  /**
   * Occupancy map: `${day}-${HH:MM}` -> [{ schedule, slot, isStart }]
   * covering every hour a class spans.
   *
   * This replaces a `shouldHideCell` helper whose guard compared
   * `prevTimeSlot + ':00'` (e.g. "08:00:00") against `slot.startTime` ("08:00").
   * That could never match, so no cell was ever hidden and a 4-hour class was
   * re-rendered once per hour it covered.
   */
  const occupancy = useMemo(() => {
    const map = new Map();

    schedules.forEach(schedule => {
      (schedule.timeSlots || []).forEach(slot => {
        const start = toMinutes(slot.startTime);
        const end = toMinutes(slot.endTime);
        if (start === null || end === null) return;

        const firstHour = Math.floor(start / 60);
        for (let h = firstHour; h < Math.ceil(end / 60); h++) {
          const key = `${slot.day}-${String(h).padStart(2, '0')}:00`;
          const entry = { schedule, slot, isStart: h === firstHour };
          const list = map.get(key);
          if (list) list.push(entry);
          else map.set(key, [entry]);
        }
      });
    });

    return map;
  }, [schedules]);

  const entriesAt = (day, time) => occupancy.get(`${day}-${time}`) || [];

  /** Hours actually rendered, so we can tell if a class's start row is visible. */
  const renderedHours = useMemo(() => new Set(TIME_SLOTS), [TIME_SLOTS]);

  /**
   * Classes to draw in this cell.
   *
   * Normally that's the ones starting here. It also includes a class whose real
   * start hour falls OUTSIDE the visible range (e.g. a 06:00-09:00 class while
   * the Day filter begins at 07:00) - otherwise no cell would claim it, the row
   * would be short one <td>, and every column to the right would shift across.
   */
  const startingAt = (day, time) =>
    entriesAt(day, time).filter(e => {
      if (e.isStart) return true;
      const startHour = String(Math.floor(toMinutes(e.slot.startTime) / 60)).padStart(2, '0');
      return !renderedHours.has(`${startHour}:00`) && time === TIME_SLOTS[0];
    });

  /** Cell is covered by a class drawn in an earlier visible row. */
  const isCovered = (day, time) => {
    const list = entriesAt(day, time);
    if (list.length === 0) return false;
    return startingAt(day, time).length === 0;
  };

  const statusClasses = (schedule) =>
    schedule.status === 'published'
      ? 'bg-emerald-50 border-emerald-500 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-400'
      : 'bg-orange-50 border-orange-500 hover:bg-orange-100 dark:bg-orange-900/40 dark:border-orange-400';

  /** One class block. Stretches to fill its cell. */
  const ScheduleCard = ({ schedule, slot, compact }) => (
    <div
      onClick={() => canEdit && onScheduleClick?.(schedule)}
      className={`flex-1 min-h-0 overflow-hidden rounded-md border-l-4 px-2 py-1.5 text-xs transition-colors ${
        canEdit ? 'cursor-pointer' : ''
      } ${statusClasses(schedule)}`}
      title={`${schedule.subject?.subjectCode || ''} ${schedule.subject?.subjectName || ''}\n${formatTime12Hour(slot?.startTime)} - ${formatTime12Hour(slot?.endTime)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
          {schedule.subject?.subjectCode || 'N/A'}
        </span>
        {showSection && schedule.sectionCode && (
          <span className="flex-shrink-0 px-1 rounded bg-gray-900/10 dark:bg-white/15 text-[9px] font-semibold text-gray-700 dark:text-gray-200">
            {schedule.sectionCode}
          </span>
        )}
      </div>

      {!compact && (
        <div className="text-gray-600 dark:text-gray-300 truncate">
          {schedule.subject?.subjectName}
        </div>
      )}

      {!compact && facultyName(schedule) && (
        <div className="text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
          <User className="w-3 h-3 flex-shrink-0" />
          {facultyName(schedule)}
        </div>
      )}

      <div className="text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        {/* roomLabel is resolved server-side; `room` holds a Room id */}
        {schedule.roomLabel || 'TBA'}
      </div>

      <div className="text-gray-500 dark:text-gray-400 font-medium truncate">
        {formatTime12Hour(slot?.startTime)} – {formatTime12Hour(slot?.endTime)}
      </div>
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Day view
   * ------------------------------------------------------------------ */
  if (viewMode === 'day') {
    return (
      <div>
        {/* Day picker. This used to be hard-coded to Monday, so "Day View"
            always showed Monday no matter what. */}
        <div className="flex flex-wrap gap-1 mb-4">
          {days.map(day => {
            const count = schedules.filter(s =>
              (s.timeSlots || []).some(sl => sl.day === day)
            ).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === day
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {day.slice(0, 3)}
                {count > 0 && (
                  <span className={`ml-1.5 text-[10px] ${selectedDay === day ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {TIME_SLOTS.map(time => {
            if (isLunchBreak(time)) {
              return (
                <div key={time} className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                  <span className="w-16 flex-shrink-0 text-xs font-medium text-orange-800 dark:text-orange-200">
                    {shortHourLabel(time)}
                  </span>
                  <span className="text-sm font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                    <Utensils size={14} />
                    Lunch Break
                  </span>
                </div>
              );
            }

            const starting = startingAt(selectedDay, time);
            const covered = isCovered(selectedDay, time);

            return (
              <div key={time} className="flex items-stretch gap-3">
                <span className="w-16 flex-shrink-0 pt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {shortHourLabel(time)}
                </span>
                <div className="flex-1 flex flex-col gap-1.5" style={{ minHeight: 44 }}>
                  {starting.map(({ schedule, slot }) => (
                    <div key={`${schedule._id}-${slot.startTime}`} className="flex" style={{ minHeight: 44 }}>
                      <ScheduleCard schedule={schedule} slot={slot} />
                    </div>
                  ))}
                  {starting.length === 0 && (
                    <div className="flex items-center text-xs text-gray-300 dark:text-gray-600 italic">
                      {covered ? '' : 'Free'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ *
   * Week view
   * ------------------------------------------------------------------ */
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: `${140 + days.length * 130}px` }}>
        <thead>
          <tr>
            <th
              className="bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-600 px-2 py-2.5"
              style={{ width: 72 }}
            >
              <Clock size={14} className="mx-auto text-gray-400" />
            </th>
            {days.map(day => (
              <th
                key={day}
                className="bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-600 last:border-r-0 px-2 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200"
              >
                {day.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map(time => {
            if (isLunchBreak(time)) {
              return (
                <tr key={time}>
                  {/* colSpan matches the rendered column count; it was hard-coded
                      to 7 while the table can have a different number of days. */}
                  <td
                    colSpan={days.length + 1}
                    className="border-b border-gray-200 dark:border-gray-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-300"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Utensils size={13} />
                      Lunch Break — 12:00 PM – 1:00 PM
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={time}>
                {/* The fixed height here is what keeps every column aligned */}
                <td
                  className="border-b border-r border-gray-100 dark:border-gray-700 px-2 align-top"
                  style={{ height: ROW_H, width: 72 }}
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {shortHourLabel(time)}
                  </span>
                </td>

                {days.map(day => {
                  if (isCovered(day, time)) return null; // spanned from above

                  const starting = startingAt(day, time);
                  // Span the longest class starting here, clamped to the rows left
                  const rowsLeft = TIME_SLOTS.length - TIME_SLOTS.indexOf(time);
                  const span = Math.min(
                    Math.max(1, ...starting.map(e => durationHours(e.slot))),
                    rowsLeft
                  );

                  return (
                    <td
                      key={day}
                      rowSpan={span}
                      className="border-b border-r border-gray-100 dark:border-gray-700 last:border-r-0 p-1 align-top"
                      style={{ height: span * ROW_H, minWidth: 130 }}
                    >
                      {starting.length > 0 ? (
                        <div className="flex flex-col gap-1 h-full">
                          {starting.map(({ schedule, slot }) => (
                            <ScheduleCard
                              key={`${schedule._id}-${slot.startTime}`}
                              schedule={schedule}
                              slot={slot}
                              // Two classes sharing a slot get a condensed card
                              compact={starting.length > 1 || span === 1}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="h-full" />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid;
