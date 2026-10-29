import React, { useState, useEffect, useRef } from 'react';
import { facultyAPI, scheduleAPI, subjectAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import {
  User, GripVertical, Clock, X, Save, RefreshCw,
  AlertCircle, BookOpen, ChevronDown, Search
} from 'lucide-react';
import AnimatedCheckIcon from './AnimatedCheckIcon';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_SLOTS = [
  '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
  '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
  '15:00-16:00', '16:00-17:00'
];
const NIGHT_SLOTS = [
  '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00',
  '20:00-21:00', '21:00-22:00'
];

// Format "07:00-08:00" → "7:00 AM"
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const SUBJECT_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-teal-600', 'bg-rose-600',
  'bg-orange-500', 'bg-indigo-600', 'bg-emerald-600', 'bg-pink-600',
  'bg-cyan-600', 'bg-amber-600'
];

const getSubjectColor = (subjectCode) => {
  if (!subjectCode) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < subjectCode.length; i++) hash = subjectCode.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

const FacultyDragDrop = ({ filters, onAssignmentChange }) => {
  const [faculty, setFaculty] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedFaculty, setDraggedFaculty] = useState(null);
  const [timetableGrid, setTimetableGrid] = useState({});
  const [hoveredCell, setHoveredCell] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [facultySearch, setFacultySearch] = useState('');
  const [saving, setSaving] = useState(false);

  const TIME_SLOTS = filters.shift === 'Night' ? NIGHT_SLOTS
    : filters.shift === 'Day' ? DAY_SLOTS
    : [...DAY_SLOTS, ...NIGHT_SLOTS];

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      if (filters.academicYear) params.academicYear = filters.academicYear;

      const [facultyRes, schedulesRes] = await Promise.all([
        facultyAPI.getAll(),
        scheduleAPI.getAll(params)
      ]);

      setFaculty(facultyRes.data.data || []);
      const sched = schedulesRes.data.data || [];
      setSchedules(sched);
      buildGrid(sched);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  };

  const buildGrid = (scheduleData) => {
    const grid = {};
    scheduleData.forEach(schedule => {
      (schedule.timeSlots || []).forEach(slot => {
        const startHour = slot.startTime.substring(0, 5);
        const endHour = slot.endTime.substring(0, 5);
        const key = `${slot.day}-${startHour}-${endHour}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(schedule);
      });
    });
    setTimetableGrid(grid);
  };

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = (e, fac) => {
    setDraggedFaculty(fac);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => {
    setDraggedFaculty(null);
    setHoveredCell(null);
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDragEnter = (e, key) => { e.preventDefault(); setHoveredCell(key); };
  const handleDragLeave = () => setHoveredCell(null);

  const handleDrop = (e, day, slot) => {
    e.preventDefault();
    setHoveredCell(null);
    if (!draggedFaculty) return;

    const [start, end] = slot.split('-');
    const key = `${day}-${start}-${end}`;
    const cell = timetableGrid[key] || [];

    if (cell.length === 0) {
      toast.error('No schedule in this slot — create one first');
      return;
    }

    const target = cell[0];
    if (target.faculty?._id === draggedFaculty._id) {
      toast('Already assigned to this slot');
      return;
    }

    const change = {
      scheduleId: target._id,
      facultyId: draggedFaculty._id,
      facultyName: `${draggedFaculty.user?.firstName} ${draggedFaculty.user?.lastName}`,
      subject: target.subject?.subjectCode || 'N/A',
      day,
      time: slot,
    };

    setPendingChanges(prev => [...prev.filter(c => c.scheduleId !== target._id), change]);

    // Optimistic update
    const updated = schedules.map(s =>
      s._id === target._id ? { ...s, faculty: draggedFaculty } : s
    );
    setSchedules(updated);
    buildGrid(updated);
    toast.success(`Assigned ${change.facultyName} — pending save`);
  };

  // ── Save / discard ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!pendingChanges.length) return;
    setSaving(true);
    try {
      await Promise.all(
        pendingChanges.map(c => scheduleAPI.update(c.scheduleId, { faculty: c.facultyId }))
      );
      toast.success(`Saved ${pendingChanges.length} assignment(s)`);
      setPendingChanges([]);
      loadData();
      onAssignmentChange?.();
    } catch {
      toast.error('Failed to save some assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!window.confirm('Discard all pending changes?')) return;
    setPendingChanges([]);
    loadData();
  };

  // ── Cell content ───────────────────────────────────────────────────────────
  const getCellSchedules = (day, slot) => {
    const [start, end] = slot.split('-');
    return timetableGrid[`${day}-${start}-${end}`] || [];
  };

  const getFacultyLoad = (facId) => schedules.filter(s => s.faculty?._id === facId).length;

  const filteredFaculty = faculty.filter(f =>
    f.isActive && f.user &&
    `${f.user.firstName} ${f.user.lastName}`.toLowerCase().includes(facultySearch.toLowerCase())
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && !schedules.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading faculty &amp; schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Top action bar ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Faculty Assignment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drag a faculty member onto a schedule slot to assign them
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <>
              <button
                onClick={handleDiscard}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                Discard ({pendingChanges.length})
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />}
                Save ({pendingChanges.length})
              </button>
            </>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          Assigned
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
          Pending save
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border-2 border-green-400" />
          Drop target
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-dashed border-gray-300" />
          Empty slot
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-4 items-start">

        {/* Faculty sidebar */}
        <div className="w-60 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden sticky top-4">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  Faculty ({filteredFaculty.length})
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={facultySearch}
                  onChange={e => setFacultySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-2 max-h-[calc(100vh-320px)] overflow-y-auto space-y-1">
              {filteredFaculty.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No faculty found</p>
              ) : filteredFaculty.map(fac => {
                const load = getFacultyLoad(fac._id);
                const isBeingDragged = draggedFaculty?._id === fac._id;
                const initials = `${fac.user.firstName[0]}${fac.user.lastName[0]}`;

                return (
                  <div
                    key={fac._id}
                    draggable
                    onDragStart={e => handleDragStart(e, fac)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing border transition-all select-none ${
                      isBeingDragged
                        ? 'opacity-40 scale-95 border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {fac.user.firstName} {fac.user.lastName}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{fac.employeeId}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      load >= 6 ? 'bg-red-100 text-red-700' :
                      load >= 3 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {load}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Timetable grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '760px' }}>
                {/* Header */}
                <thead>
                  <tr>
                    <th className="w-28 px-3 py-3 text-left bg-gray-50 dark:bg-gray-700 border-b border-r border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Time
                      </span>
                    </th>
                    {DAYS.map(day => (
                      <th
                        key={day}
                        className="px-2 py-3 text-center bg-gray-50 dark:bg-gray-700 border-b border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                      >
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          {day.substring(0, 3)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {TIME_SLOTS.map((slot, rowIdx) => {
                    const [start] = slot.split('-');
                    const isLunch = start === '12:00';

                    if (isLunch) {
                      return (
                        <tr key={slot}>
                          <td
                            colSpan={DAYS.length + 1}
                            className="px-3 py-1.5 text-center text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 border-b border-gray-200 dark:border-gray-600"
                          >
                            🍽 Lunch Break — 12:00 PM – 1:00 PM
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={slot}
                        className={rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750'}
                      >
                        {/* Time label */}
                        <td className="px-3 py-2 border-b border-r border-gray-100 dark:border-gray-700 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {fmtTime(start)}
                            </span>
                          </div>
                        </td>

                        {/* Day cells */}
                        {DAYS.map(day => {
                          const cellKey = `${day}-${slot}`;
                          const isHovered = hoveredCell === cellKey;
                          const cellSchedules = getCellSchedules(day, slot);
                          const isEmpty = cellSchedules.length === 0;
                          const isDragging = !!draggedFaculty;

                          return (
                            <td
                              key={day}
                              onDragOver={handleDragOver}
                              onDragEnter={e => handleDragEnter(e, cellKey)}
                              onDragLeave={handleDragLeave}
                              onDrop={e => handleDrop(e, day, slot)}
                              className={`px-1.5 py-1.5 border-b border-r border-gray-100 dark:border-gray-700 last:border-r-0 align-top transition-colors ${
                                isHovered && !isEmpty
                                  ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-400'
                                  : isHovered && isEmpty
                                  ? 'bg-gray-100 dark:bg-gray-700'
                                  : isDragging && !isEmpty
                                  ? 'bg-blue-50/30 dark:bg-blue-900/10'
                                  : ''
                              }`}
                              style={{ minWidth: '110px', minHeight: '56px' }}
                            >
                              {isEmpty ? (
                                /* Empty drop hint when dragging */
                                isDragging ? (
                                  <div className="h-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center opacity-50">
                                    <span className="text-[10px] text-gray-400">drop</span>
                                  </div>
                                ) : null
                              ) : (
                                cellSchedules.map((sched, i) => {
                                  const isPending = pendingChanges.some(c => c.scheduleId === sched._id);
                                  const code = sched.subject?.subjectCode;
                                  const color = getSubjectColor(code);
                                  const facultyName = sched.faculty?.user
                                    ? `${sched.faculty.user.firstName} ${sched.faculty.user.lastName}`
                                    : null;

                                  return (
                                    <div
                                      key={i}
                                      className={`rounded-lg overflow-hidden mb-1 last:mb-0 ${
                                        isPending ? 'ring-2 ring-amber-400' : ''
                                      }`}
                                    >
                                      {/* Colored top bar */}
                                      <div className={`${color} px-2 py-1`}>
                                        <p className="text-white text-[11px] font-bold truncate">{code || '—'}</p>
                                      </div>
                                      {/* Faculty name */}
                                      <div className={`px-2 py-1 text-[10px] ${
                                        isPending
                                          ? 'bg-amber-50 dark:bg-amber-900/20'
                                          : 'bg-blue-50 dark:bg-blue-900/10'
                                      }`}>
                                        {facultyName ? (
                                          <p className="text-gray-800 dark:text-gray-200 font-medium truncate">
                                            {facultyName}
                                          </p>
                                        ) : (
                                          <p className="text-gray-400 italic">Unassigned</p>
                                        )}
                                        <p className="text-gray-500 dark:text-gray-400 truncate">
                                          {sched.section} · {sched.room || 'TBA'}
                                        </p>
                                        {isPending && (
                                          <p className="text-amber-600 font-semibold mt-0.5">● Pending</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
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
          </div>

          {/* Pending changes summary */}
          {pendingChanges.length > 0 && (
            <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  {pendingChanges.length} unsaved assignment{pendingChanges.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1.5">
                {pendingChanges.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="text-amber-800 dark:text-amber-200">
                      <span className="font-semibold">{c.subject}</span>
                      <span className="text-amber-600"> · {c.day} {c.time}</span>
                      <span className="text-amber-800"> → </span>
                      <span className="font-semibold">{c.facultyName}</span>
                    </span>
                    <button
                      onClick={() => setPendingChanges(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-auto text-amber-500 hover:text-amber-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleDiscard}
                  className="px-4 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                >
                  Discard all
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-60 flex items-center gap-2"
                >
                  {saving
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <AnimatedCheckIcon className="w-3.5 h-3.5" color="currentColor" />}
                  Save all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDragDrop;
