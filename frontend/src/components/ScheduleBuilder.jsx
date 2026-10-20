import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { facultyAPI, scheduleAPI, subjectAPI, roomAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  BookOpen, GripVertical, Clock, X, Save, RefreshCw,
  Plus, Trash2, AlertCircle, Undo2, Redo2, Search,
  User, MapPin, ChevronDown, CheckCircle
} from 'lucide-react';
import EditScheduleModal from './EditScheduleModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Fixed height of one hour row, in pixels.
 *
 * Every row is pinned to this via the time-label cell so that a cell with
 * rowSpan={n} is always exactly n rows tall. Cards then stretch to fill their
 * cell rather than dictating the row height, which is what previously knocked
 * the grid out of alignment.
 */
const ROW_H = 78;

const ALL_TIME_SLOTS = [
  { time: '07:00-08:00', isLunch: false },
  { time: '08:00-09:00', isLunch: false },
  { time: '09:00-10:00', isLunch: false },
  { time: '10:00-11:00', isLunch: false },
  { time: '11:00-12:00', isLunch: false },
  { time: '12:00-13:00', isLunch: true },
  { time: '13:00-14:00', isLunch: false },
  { time: '14:00-15:00', isLunch: false },
  { time: '15:00-16:00', isLunch: false },
  { time: '16:00-17:00', isLunch: false },
  { time: '17:00-18:00', isLunch: false },
  { time: '18:00-19:00', isLunch: false },
  { time: '19:00-20:00', isLunch: false },
  { time: '20:00-21:00', isLunch: false },
  { time: '21:00-22:00', isLunch: false },
];

// Format "07:00" → "7:00 AM"
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const SUBJECT_COLORS = [
  { bg: 'bg-blue-600', light: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-purple-600', light: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-teal-600', light: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-700', text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-rose-600', light: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-indigo-600', light: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-pink-600', light: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300' },
  { bg: 'bg-amber-600', light: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300' },
];

const getSubjectColor = (subjectCode) => {
  if (!subjectCode) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < subjectCode.length; i++) hash = subjectCode.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

const ScheduleBuilder = ({
  filters,
  subjects: propSubjects,
  sections: propSections,
  faculty: propFaculty,
  rooms: propRooms,
  selectedSection,
  onAssignmentChange
}) => {
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // A flat list of the saved schedules in view. Everything positional is derived
  // from it by the `occupancy` memo below.
  //
  // This used to be an object bucketed by `day-startTime` with the schedule
  // pushed into one bucket per timeSlot. Iterating the buckets then visited a
  // multi-meeting class once per meeting and covered ALL its slots each time, so
  // a class meeting on Mon/Wed/Fri drew three identical cards in every cell and
  // counted its hours three times in the sidebar.
  const [savedSchedules, setSavedSchedules] = useState([]);
  const [draggedSubject, setDraggedSubject] = useState(null);
  const [hoveredCells, setHoveredCells] = useState([]);
  const [pendingSchedules, setPendingSchedules] = useState([]);
  const [selectedHours, setSelectedHours] = useState(1);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editingSavedSchedule, setEditingSavedSchedule] = useState(null);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const TIME_SLOTS = useMemo(() => (
    filters.shift === 'Night'
      ? ALL_TIME_SLOTS.filter(s => parseInt(s.time) >= 16)
      : filters.shift === 'Day'
      ? ALL_TIME_SLOTS.filter(s => parseInt(s.time) <= 15)
      : ALL_TIME_SLOTS
  ), [filters.shift]);

  /**
   * Occupancy map: `${day}-${HH:MM}` -> { schedule, pending, isStart }
   * for EVERY hour a class covers, not just its start hour.
   *
   * This is the single source of truth for what sits in a cell. It replaces:
   *  - the conflict lookup in handleDrop, which built its key as
   *    `day-start-end` while the grid was stored under `day-start`, so a
   *    collision with an already-saved class was never detected;
   *  - isMiddleCell, which scanned every schedule for every one of the ~90
   *    cells on every render (including each drag-hover tick);
   *  - the rowSpan calculation.
   */
  const occupancy = useMemo(() => {
    const map = new Map();

    const cover = (day, startTime, endTime, payload) => {
      const [sh, sm] = String(startTime).split(':').map(Number);
      const [eh, em] = String(endTime).split(':').map(Number);
      if ([sh, sm, eh, em].some(Number.isNaN)) return;

      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      for (let h = Math.floor(startMin / 60); h < Math.ceil(endMin / 60); h++) {
        const key = `${day}-${String(h).padStart(2, '0')}:00`;
        const existing = map.get(key);
        const entry = { ...payload, isStart: h === Math.floor(startMin / 60) };
        if (existing) existing.push(entry);
        else map.set(key, [entry]);
      }
    };

    // Saved schedules. Every timeSlot is covered, so a Mon+Wed class occupies
    // both days rather than rendering Wednesday with Monday's hours. Each
    // schedule is visited exactly once, so each meeting produces one entry.
    savedSchedules.forEach(schedule => {
      (schedule.timeSlots || []).forEach(slot => {
        cover(slot.day, slot.startTime, slot.endTime, { schedule, kind: 'saved', slot });
      });
    });

    // Pending (unsaved) cards
    pendingSchedules.forEach(pending => {
      (pending.timeSlots || []).forEach(slot => {
        cover(slot.day, slot.startTime, slot.endTime, { pending, kind: 'pending', slot });
      });
    });

    return map;
  }, [savedSchedules, pendingSchedules]);

  /** Entries occupying a given cell, or an empty array. */
  const entriesAt = useCallback(
    (day, hhmm) => occupancy.get(`${day}-${hhmm}`) || [],
    [occupancy]
  );

  /**
   * Monotonic temp id. `Date.now()` collided when two drops landed in the same
   * millisecond, and removing one then removed both.
   */
  const tempIdRef = useRef(0);
  const nextTempId = () => {
    tempIdRef.current += 1;
    return `tmp-${Date.now()}-${tempIdRef.current}`;
  };

  /**
   * Once the manager picks a duration explicitly, stop auto-suggesting one on
   * drag start. Without this their choice was overwritten on every drag.
   */
  const durationTouchedRef = useRef(false);
  const [durationLocked, setDurationLocked] = useState(false);

  const pickDuration = (hours) => {
    durationTouchedRef.current = true;
    setDurationLocked(true);
    setSelectedHours(hours);
  };

  /** Hand duration back to the per-subject suggestion. */
  const releaseDuration = () => {
    durationTouchedRef.current = false;
    setDurationLocked(false);
  };

  /**
   * Validate a candidate placement and return its time range.
   *
   * @param {string} day
   * @param {number} slotIndex index into TIME_SLOTS
   * @param {number} hours     how many hours the class should occupy
   * @param {string} [ignoreTempId] pending card to ignore (used when moving it)
   * @returns {{ok: true, startTime: string, endTime: string} | {ok: false, reason: string}}
   */
  const resolveRange = useCallback((day, slotIndex, hours, ignoreTempId = null) => {
    const startSlot = TIME_SLOTS[slotIndex];
    if (!startSlot) return { ok: false, reason: 'Invalid time slot' };
    if (startSlot.isLunch) return { ok: false, reason: 'Cannot schedule over lunch break' };

    const startTime = startSlot.time.split('-')[0];
    let endTime = startSlot.time.split('-')[1];

    for (let i = 0; i < hours; i++) {
      const t = TIME_SLOTS[slotIndex + i];
      if (!t) return { ok: false, reason: 'Not enough time left in the day' };
      if (t.isLunch) return { ok: false, reason: 'Cannot schedule through lunch break' };

      const hhmm = t.time.split('-')[0];
      const blocking = entriesAt(day, hhmm).filter(
        entry => !(ignoreTempId && entry.kind === 'pending' && entry.pending.tempId === ignoreTempId)
      );

      if (blocking.length > 0) {
        const first = blocking[0];
        const code = first.kind === 'saved'
          ? first.schedule.subject?.subjectCode
          : first.pending.subjectData?.subjectCode;
        return {
          ok: false,
          reason: `${day} ${hhmm} is already taken by ${code || 'another class'}`,
        };
      }

      endTime = t.time.split('-')[1];
    }

    return { ok: true, startTime, endTime };
  }, [TIME_SLOTS, entriesAt]);

  /** Move an already-placed pending card to a new day/slot. */
  const movePending = useCallback((tempId, day, slotIndex) => {
    const card = pendingSchedules.find(p => String(p.tempId) === String(tempId));
    if (!card) return;

    const hours = getDurationHours(card);
    const range = resolveRange(day, slotIndex, hours, card.tempId);
    if (!range.ok) {
      toast.error(range.reason);
      return;
    }

    const slot = card.timeSlots?.[0];
    if (slot && slot.day === day && slot.startTime === range.startTime) return; // no-op

    const next = pendingSchedules.map(p =>
      String(p.tempId) === String(tempId)
        ? { ...p, timeSlots: [{ day, startTime: range.startTime, endTime: range.endTime }] }
        : p
    );
    setPendingSchedules(next);
    pushHistory(next);
    toast.success(`Moved to ${day} ${range.startTime}`);
  }, [pendingSchedules, resolveRange]);

  /** Move an already-saved schedule to a new day/slot. */
  const moveSavedSchedule = useCallback(async (scheduleId, day, slotIndex) => {
    const schedule = savedSchedules.find(s => String(s._id) === String(scheduleId));
    if (!schedule) return;

    // Calculate duration from the existing schedule
    const slot = schedule.timeSlots?.[0];
    if (!slot) return;
    
    const startIdx = TIME_SLOTS.findIndex(t => t.time === slot.startTime);
    const endIdx = TIME_SLOTS.findIndex(t => t.time === slot.endTime);
    const hours = endIdx - startIdx;

    const range = resolveRange(day, slotIndex, hours, scheduleId);
    if (!range.ok) {
      toast.error(range.reason);
      return;
    }

    // Check if it's the same location (no-op)
    if (slot.day === day && slot.startTime === range.startTime) return;

    try {
      // Update the schedule in the database
      await scheduleAPI.update(scheduleId, {
        timeSlots: [{ day, startTime: range.startTime, endTime: range.endTime }]
      });
      
      toast.success(`Moved to ${day} ${range.startTime}`);
      
      // Update local state immediately for better UX
      setSavedSchedules(prev => prev.map(s => 
        String(s._id) === String(scheduleId)
          ? { ...s, timeSlots: [{ day, startTime: range.startTime, endTime: range.endTime }] }
          : s
      ));
    } catch (error) {
      console.error('Failed to move schedule:', error);
      toast.error(error.response?.data?.message || 'Failed to move schedule');
    }
  }, [savedSchedules, resolveRange]);

  // ── Load data ──────────────────────────────────────────────────────────────
  // Also re-runs when the section changes, since the grid is scoped to it.
  useEffect(() => { loadData(); }, [filters, selectedSection?.sectionCode]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyIndex, history]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      if (filters.academicYear) params.academicYear = filters.academicYear;
      if (filters.shift) params.shift = filters.shift;

      // Scope the grid to the section being built. Without this the builder
      // loaded every section of the year level, so the grid looked fully booked
      // with other sections' classes and refused drops.
      if (selectedSection?.sectionCode) params.sectionCode = selectedSection.sectionCode;

      const res = await scheduleAPI.getAll(params);
      setSavedSchedules(res.data.data || []);

      if (propSubjects && propFaculty && propRooms) {
        setSubjects(propSubjects);
        setFaculty(propFaculty);
        setRooms(propRooms);
      } else {
        // Fallback when rendered without the page supplying reference data
        const facultyParams = {};
        if (filters.program) facultyParams.program = filters.program;

        const [subRes, facRes, roomRes] = await Promise.all([
          subjectAPI.getAll(params),
          facultyAPI.getAll(facultyParams),
          roomAPI.getAll(),
        ]);
        setSubjects(subRes.data.data || []);
        setFaculty(facRes.data.data || []);
        setRooms(roomRes.data.data || []);
      }
    } catch (err) {
      console.error('Load data error:', err);
      toast.error(err.response?.data?.message || 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };



  // ── History ────────────────────────────────────────────────────────────────
  // Seeded with the empty state so the FIRST action is undoable. Previously
  // historyIndex started at -1 and the first push set it to 0, while handleUndo
  // required index > 0 - so the first drop could never be undone.
  const MAX_HISTORY = 50;

  const pushHistory = (schedules) => {
    setHistory(prev => {
      const base = prev.length === 0 ? [[]] : prev;
      const truncated = base.slice(0, historyIndex + 1 || 1);
      const next = [...truncated, JSON.parse(JSON.stringify(schedules))];
      // Bound it: this deep-clones on every drop and used to grow without limit
      const trimmed = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      setHistoryIndex(trimmed.length - 1);
      return trimmed;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setPendingSchedules(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      setHistoryIndex(historyIndex - 1);
    } else toast('Nothing to undo');
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setPendingSchedules(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      setHistoryIndex(historyIndex + 1);
    } else toast('Nothing to redo');
  };

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleSubjectDragStart = (e, subject) => {
    setDraggedSubject(subject);
    e.dataTransfer.effectAllowed = 'copy';
    // Mark the payload so a cell can tell a subject drag from a card move
    e.dataTransfer.setData('kind', 'subject');

    // Suggest the subject's remaining hours, but ONLY while the manager hasn't
    // set a duration themselves. Doing this unconditionally meant picking "1h"
    // was silently overwritten the moment a drag started.
    if (durationTouchedRef.current) return;

    const required =
      (subject.lectureHours || 0) + (subject.labHours || 0) || subject.units || 1;
    const placed = scheduledHoursBySubject.get(String(subject._id)) || 0;
    const remaining = Math.max(1, required - placed);
    setSelectedHours(Math.min(remaining, 3));
  };

  const handleDragEnd = () => {
    setDraggedSubject(null);
    setHoveredCells([]);
  };

  // ── Duration ───────────────────────────────────────────────────────────────
  /**
   * Grow or shrink a placed card by whole hours.
   *
   * Reuses resolveRange, so extending is blocked by exactly the same rules as
   * dropping: lunch, end of day, and any occupied cell.
   *
   * @param {object} ps    the pending card
   * @param {number} delta +1 or -1 hours
   */
  const changeDuration = useCallback((ps, delta) => {
    const slot = ps.timeSlots?.[0];
    if (!slot) return;

    const current = getDurationHours(ps);
    const target = current + delta;

    if (target < 1) return;

    const slotIndex = TIME_SLOTS.findIndex(t => t.time.split('-')[0] === slot.startTime);
    if (slotIndex === -1) return;

    const range = resolveRange(slot.day, slotIndex, target, ps.tempId);
    if (!range.ok) {
      toast.error(range.reason);
      return;
    }

    const next = pendingSchedules.map(p =>
      String(p.tempId) === String(ps.tempId)
        ? { ...p, timeSlots: [{ day: slot.day, startTime: range.startTime, endTime: range.endTime }] }
        : p
    );
    setPendingSchedules(next);
    pushHistory(next);
  }, [pendingSchedules, resolveRange, TIME_SLOTS]);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

  const handleDragEnter = (e, day, slotIndex) => {
    e.preventDefault();
    const cells = [];
    for (let i = 0; i < selectedHours; i++) {
      const t = TIME_SLOTS[slotIndex + i];
      if (t && !t.isLunch) cells.push(`${day}-${t.time}`);
    }
    setHoveredCells(cells);
  };

  const handleDrop = (e, day, slotIndex) => {
    e.preventDefault();
    setHoveredCells([]);

    // Check what kind of item is being dropped
    const kind = e.dataTransfer.getData('kind');
    
    // Dropping a pending schedule card onto a grid cell MOVES it.
    const pendingId = e.dataTransfer.getData('pendingId');
    if (pendingId && kind === 'pending') {
      movePending(pendingId, day, slotIndex);
      return;
    }

    // Dropping a saved schedule card onto a grid cell MOVES it.
    const scheduleId = e.dataTransfer.getData('scheduleId');
    if (scheduleId && kind === 'saved') {
      moveSavedSchedule(scheduleId, day, slotIndex);
      return;
    }

    if (!draggedSubject) return;
    
    if (!filters.program || !filters.yearLevel || !filters.semester) {
      // More specific message for missing section
      if (filters.program && (!filters.yearLevel || !filters.shift)) {
        toast.error('Please select a section first from the dropdown above');
      } else {
        toast.error('Select Program, Year Level and Semester first');
      }
      return;
    }

    const startSlot = TIME_SLOTS[slotIndex];
    if (!startSlot || startSlot.isLunch) {
      toast.error('Cannot drop on lunch break');
      return;
    }

    const range = resolveRange(day, slotIndex, selectedHours);
    if (!range.ok) {
      toast.error(range.reason);
      return;
    }
    const { startTime, endTime } = range;

    const newSchedule = {
      tempId: nextTempId(),
      subject: draggedSubject._id,
      subjectData: draggedSubject,
      faculty: null,
      room: null,
      program: filters.program,
      yearLevel: selectedSection?.yearLevel || filters.yearLevel,
      section: selectedSection?.sectionLetter || 'A',
      sectionCode: selectedSection?.sectionCode || null,
      shift: selectedSection?.shift || filters.shift || 'Day',
      semester: selectedSection?.semester || filters.semester,
      academicYear: filters.academicYear,
      // No `type` key: the Schedule.timeSlots sub-schema has no such field, so
      // Mongoose silently strips it.
      timeSlots: [{ day, startTime, endTime }],
      maxStudents: selectedSection?.maxStudents || 40,
      isPublished: false,
    };

    const next = [...pendingSchedules, newSchedule];
    setPendingSchedules(next);
    pushHistory(next);
    toast.success(`Added ${draggedSubject.subjectCode} (${selectedHours}h) — assign faculty & room`);
  };

  const removePending = (tempId) => {
    // Compare as strings: temp ids are now strings, and dataTransfer values
    // always arrive as strings.
    const next = pendingSchedules.filter(s => String(s.tempId) !== String(tempId));
    setPendingSchedules(next);
    pushHistory(next);
  };

  const updatePending = (tempId, field, value) => {
    setPendingSchedules(prev => prev.map(s => {
      if (s.tempId === tempId) {
        const updated = { ...s, [field]: value };
        // Also update editingSchedule if it's the same schedule
        if (editingSchedule?.tempId === tempId) {
          setEditingSchedule(updated);
        }
        return updated;
      }
      return s;
    }));
  };

  const updateSaved = (scheduleId, field, value) => {
    // Update the editingSavedSchedule state
    if (editingSavedSchedule?._id === scheduleId) {
      setEditingSavedSchedule(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleEditSavedSchedule = (schedule) => {
    // Convert saved schedule to editable format
    const editable = {
      ...schedule,
      subject: schedule.subject?._id || schedule.subject,
      subjectData: schedule.subject,
      faculty: schedule.faculty?._id || schedule.faculty,
      room: schedule.room?._id || schedule.room,
    };
    setEditingSavedSchedule(editable);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (!pendingSchedules.length) return;
    const invalid = pendingSchedules.filter(s => !s.faculty || !s.room);
    if (invalid.length) {
      toast.error(`${invalid.length} schedule(s) still missing faculty or room`);
      return;
    }
    setSaving(true);
    try {
      // One bulk request instead of a sequential loop of creates.
      // The old loop aborted on the first failure with earlier rows already
      // persisted but still in the pending list, so pressing Save All again
      // duplicated them and double-counted faculty load. The bulk endpoint
      // validates everything first and writes all-or-nothing.
      const res = await scheduleAPI.bulkCreate(
        pendingSchedules.map(p => ({
          subject: p.subject,
          subjectCode: p.subjectData?.subjectCode,
          faculty: p.faculty,
          room: p.room,
          program: p.program,
          yearLevel: p.yearLevel,
          section: p.section,
          sectionCode: p.sectionCode,
          shift: p.shift,
          semester: p.semester,
          academicYear: p.academicYear,
          timeSlots: p.timeSlots,
          maxStudents: p.maxStudents,
        }))
      );

      toast.success(res.data.message || `Saved ${pendingSchedules.length} schedule(s)`);
      setPendingSchedules([]);
      setHistory([]);
      setHistoryIndex(-1);
      await loadData();
      onAssignmentChange?.();
    } catch (err) {
      const data = err.response?.data;
      // Report the specific rows that blocked the save. Nothing was written, so
      // the pending list is deliberately left intact for the user to fix.
      if (data?.errors?.length) {
        const first = data.errors.slice(0, 3)
          .map(e => `${e.subject}: ${e.error}`)
          .join('\n');
        const more = data.errors.length > 3 ? `\n+${data.errors.length - 3} more` : '';
        toast.error(`${data.message}\n\n${first}${more}`, { duration: 8000 });
      } else {
        toast.error(data?.message || 'Failed to save schedules');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOne = async (schedule) => {
    if (!schedule.faculty || !schedule.room) {
      toast.error('Assign faculty and room before saving');
      return;
    }
    setSaving(true);
    try {
      await scheduleAPI.create({
        subject: schedule.subject,
        faculty: schedule.faculty,
        room: schedule.room,
        program: schedule.program,
        yearLevel: schedule.yearLevel,
        section: schedule.section,
        sectionCode: schedule.sectionCode,
        shift: schedule.shift,
        semester: schedule.semester,
        academicYear: schedule.academicYear,
        timeSlots: schedule.timeSlots,
        maxStudents: schedule.maxStudents,
        isPublished: schedule.isPublished,
      });
      toast.success('Schedule saved');
      removePending(schedule.tempId);
      setEditingSchedule(null);
      loadData();
      onAssignmentChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSaved = async (schedule) => {
    if (!schedule.faculty || !schedule.room) {
      toast.error('Faculty and room are required');
      return;
    }
    setSaving(true);
    try {
      const updateData = {
        faculty: schedule.faculty,
        room: schedule.room,
        timeSlots: schedule.timeSlots,
        maxStudents: schedule.maxStudents,
      };
      
      await scheduleAPI.update(schedule._id, updateData);
      toast.success('Schedule updated');
      setEditingSavedSchedule(null);

      // No artificial delay: the update response is already committed, so
      // refetching immediately returns the new values.
      await loadData();
      onAssignmentChange?.();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (scheduleId) => {
    if (!window.confirm('Delete this schedule? This cannot be undone.')) return;
    setSaving(true);
    try {
      await scheduleAPI.delete(scheduleId);
      toast.success('Schedule deleted');
      setEditingSavedSchedule(null);
      loadData();
      onAssignmentChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete schedule');
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  // All three read the precomputed occupancy map instead of rescanning every
  // schedule per cell, which is what made dragging stutter.

  /** Saved schedules that START in this cell. */
  const getCellSchedules = useCallback((day, slot) => {
    const hhmm = slot.time.split('-')[0];
    return entriesAt(day, hhmm)
      .filter(e => e.kind === 'saved' && e.isStart)
      .map(e => ({ ...e.schedule, _slot: e.slot }));
  }, [entriesAt]);

  /** Pending cards that START in this cell. */
  const getPendingForCell = useCallback((day, slot) => {
    const hhmm = slot.time.split('-')[0];
    return entriesAt(day, hhmm)
      .filter(e => e.kind === 'pending' && e.isStart)
      .map(e => e.pending);
  }, [entriesAt]);

  /** Cell is covered by a class that started earlier, so it has no own <td>. */
  const isMiddleCell = useCallback((day, slot) => {
    const hhmm = slot.time.split('-')[0];
    const entries = entriesAt(day, hhmm);
    return entries.length > 0 && entries.every(e => !e.isStart);
  }, [entriesAt]);

  const getDurationHours = (ps) => {
    const slot = ps?.timeSlots?.[0];
    if (!slot) return 1;
    const [sh, sm] = String(slot.startTime).split(':').map(Number);
    const [eh, em] = String(slot.endTime).split(':').map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return 1;
    return Math.max(1, Math.ceil(((eh * 60 + em) - (sh * 60 + sm)) / 60));
  };

  /** Duration of the slot that actually renders in this cell. */
  const slotDuration = (slot) => {
    if (!slot) return 1;
    const [sh, sm] = String(slot.startTime).split(':').map(Number);
    const [eh, em] = String(slot.endTime).split(':').map(Number);
    if ([sh, sm, eh, em].some(Number.isNaN)) return 1;
    return Math.max(1, Math.ceil(((eh * 60 + em) - (sh * 60 + sm)) / 60));
  };

  const pendingCount = pendingSchedules.length;
  const readyCount = useMemo(
    () => pendingSchedules.filter(s => s.faculty && s.room).length,
    [pendingSchedules]
  );
  const filteredSubjects = useMemo(() => {
    let filtered = subjects;
    
    // Debug: log first subject to see structure
    if (subjects.length > 0 && selectedSection) {
      console.log('Sample subject:', subjects[0]);
      console.log('Selected section:', selectedSection);
    }
    
    // Filter by section's program and year level if a section is selected
    if (selectedSection) {
      filtered = filtered.filter(s => {
        const matchesProgram = s.program === selectedSection.program;
        const matchesYear = s.yearLevel === selectedSection.yearLevel;
        const matchesSemester = s.semester === selectedSection.semester;
        return matchesProgram && matchesYear && matchesSemester;
      });
    } else if (filters.program || filters.yearLevel) {
      // Fallback to filters if no section selected
      filtered = filtered.filter(s => {
        if (filters.program && s.program !== filters.program) return false;
        if (filters.yearLevel && s.yearLevel !== filters.yearLevel) return false;
        return true;
      });
    }
    
    // Apply search filter
    const q = subjectSearch.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(s =>
        `${s.subjectCode} ${s.subjectName}`.toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [subjects, subjectSearch, selectedSection, filters.program, filters.yearLevel]);

  /** How many hours of each subject are already placed (saved + pending). */
  const scheduledHoursBySubject = useMemo(() => {
    const totals = new Map();

    const add = (subjectId, hours) => {
      if (!subjectId) return;
      const key = String(subjectId);
      totals.set(key, (totals.get(key) || 0) + hours);
    };

    savedSchedules.forEach(s => {
      (s.timeSlots || []).forEach(slot => add(s.subject?._id || s.subject, slotDuration(slot)));
    });
    pendingSchedules.forEach(p => {
      (p.timeSlots || []).forEach(slot => add(p.subject, slotDuration(slot)));
    });

    return totals;
  }, [savedSchedules, pendingSchedules]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && !subjects.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading schedule builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Top action bar ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Schedule Builder</h2>
              {/* Always show which section is being edited, so it's never
                  ambiguous which timetable you're changing. */}
              {selectedSection && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">
                  {selectedSection.sectionCode}
                  <span className="font-normal opacity-80">
                    · Year {selectedSection.yearLevel} · Sem {selectedSection.semester} · {selectedSection.shift}
                  </span>
                </span>
              )}
            </div>
            {/* Numbered steps rather than one run-on sentence */}
            <ol className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <li className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold flex items-center justify-center">1</span>
                Pick a duration
              </li>
              <li className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold flex items-center justify-center">2</span>
                Drag a subject onto a slot
              </li>
              <li className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold flex items-center justify-center">3</span>
                Click the card to assign faculty &amp; room
              </li>
              <li className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">4</span>
                Save All
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Duration picker. Set this before dropping - it determines how
                many hours the class occupies. */}
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-1.5">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Duration</span>
              <div className="flex rounded-md overflow-hidden border border-blue-300 dark:border-blue-700">
                {[1, 2, 3].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickDuration(h)}
                    className={`px-2 py-0.5 text-xs font-semibold transition-colors ${
                      selectedHours === h
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>

              {/* Make it explicit whether the duration is locked to the choice or
                  still following each subject's remaining hours. */}
              {durationLocked ? (
                <button
                  type="button"
                  onClick={releaseDuration}
                  title="Go back to suggesting each subject's remaining hours"
                  className="text-[10px] text-blue-600 dark:text-blue-400 underline whitespace-nowrap"
                >
                  locked to {selectedHours}h
                </button>
              ) : (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 whitespace-nowrap">
                  auto
                </span>
              )}

              {draggedSubject && (
                <span className="text-[10px] text-blue-500 dark:text-blue-400 whitespace-nowrap">
                  · {draggedSubject.subjectCode} needs{' '}
                  {(draggedSubject.lectureHours || 0) + (draggedSubject.labHours || 0) ||
                    draggedSubject.units || 1}h
                </span>
              )}
            </div>

            {/* Undo/Redo */}
            <button onClick={handleUndo} disabled={historyIndex <= 0}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
              title="Redo (Ctrl+Y)">
              <Redo2 className="w-4 h-4" />
            </button>

            {pendingCount > 0 && (
              <>
                <button
                  onClick={() => {
                    if (window.confirm(`Discard ${pendingCount} pending schedule(s)?`)) {
                      // Record it, otherwise a later Ctrl+Z resurrected the
                      // discarded cards from a stale history entry.
                      setPendingSchedules([]);
                      pushHistory([]);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Discard ({pendingCount})
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving || readyCount !== pendingCount}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                  title={readyCount !== pendingCount ? `${pendingCount - readyCount} still need faculty/room` : ''}
                >
                  {saving
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Save className="w-4 h-4" />}
                  Save All ({readyCount}/{pendingCount})
                </button>
              </>
            )}

            <button onClick={loadData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />Saved</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 border-2 border-amber-400" />Needs faculty/room</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-100 border-2 border-green-400" />Ready to save</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />Lunch</div>
          <span className="text-gray-400">Drag a placed card to move it · drop it on the bin to remove</span>
          <div className="flex items-center gap-1.5 ml-auto text-gray-400">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] border border-gray-200 dark:border-gray-600">Ctrl+Z</kbd>Undo
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] border border-gray-200 dark:border-gray-600 ml-1">Ctrl+Y</kbd>Redo
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-4 items-start">

        {/* Subject sidebar */}
        <div className="w-60 flex-shrink-0">
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden sticky top-4"
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => {
              e.preventDefault();
              // temp ids are strings now, so no parseInt (which produced NaN)
              const pendingId = e.dataTransfer.getData('pendingId');
              if (pendingId) { removePending(pendingId); toast('Removed from grid'); }
            }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  Subjects ({filteredSubjects.length})
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-2 max-h-[calc(100vh-340px)] overflow-y-auto space-y-1.5">
              {filteredSubjects.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No subjects found</p>
                  {!filters.program && <p className="text-xs text-gray-400 mt-1">Select a program first</p>}
                </div>
              ) : filteredSubjects.map(subject => {
                const color = getSubjectColor(subject.subjectCode);

                // Hours already placed, from the memoized map. This used to
                // re-scan every schedule for every subject on every render
                // (including each drag-hover frame).
                const totalScheduled = scheduledHoursBySubject.get(String(subject._id)) || 0;

                // A subject needs as many hours as its lecture + lab hours;
                // fall back to units when those aren't set.
                const requiredHours =
                  (subject.lectureHours || 0) + (subject.labHours || 0) || subject.units || 0;
                const isLimitReached = requiredHours > 0 && totalScheduled >= requiredHours;

                const isDragging = draggedSubject?._id === subject._id;

                return (
                  <div
                    key={subject._id}
                    draggable={!isLimitReached}
                    onDragStart={e => {
                      if (isLimitReached) {
                        e.preventDefault();
                        toast.error(`${subject.subjectCode} already has all ${requiredHours}h scheduled`);
                        return;
                      }
                      handleSubjectDragStart(e, subject);
                    }}
                    onDragEnd={handleDragEnd}
                    className={`rounded-xl overflow-hidden border transition-all select-none ${
                      isLimitReached
                        ? 'opacity-40 cursor-not-allowed border-gray-300 dark:border-gray-600'
                        : isDragging
                        ? 'opacity-40 scale-95 border-blue-300 cursor-grab active:cursor-grabbing'
                        : `${color.border} hover:shadow-md hover:scale-[1.01] cursor-grab active:cursor-grabbing`
                    }`}
                  >
                    {/* Color top stripe */}
                    <div className={`${color.bg} px-3 py-1.5 flex items-center gap-2 ${isLimitReached ? 'opacity-60' : ''}`}>
                      <GripVertical className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                      <span className="text-white text-xs font-bold truncate flex-1">{subject.subjectCode}</span>
                      {totalScheduled > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isLimitReached
                            ? 'bg-red-500/80 text-white'
                            : 'bg-white/30 text-white'
                        }`}>
                          {totalScheduled}/{requiredHours}h
                        </span>
                      )}
                    </div>
                    {/* Subject info */}
                    <div className={`${color.light} px-3 py-2 ${isLimitReached ? 'opacity-60' : ''}`}>
                      <p className={`text-[11px] font-medium ${color.text} line-clamp-2 leading-tight`}>
                        {subject.subjectName}
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {subject.units} units · {(subject.lectureHours || 0) + (subject.labHours || 0)}h/wk
                          {subject.lectureHours > 0 && subject.labHours > 0 && ` (${subject.lectureHours}L+${subject.labHours}Lab)`}
                        </p>
                        {isLimitReached && (
                          <span className="text-[9px] text-red-600 dark:text-red-400 font-semibold uppercase">Full</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Removal drop zone. This is now the only place a drag deletes a
                  card - dropping on the grid moves it instead. */}
              <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={e => {
                  e.preventDefault();
                  const tempId = e.dataTransfer.getData('pendingId');
                  if (tempId) removePending(tempId);
                }}
                className="mt-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 text-center hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400">Drop a card here to remove it</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timetable grid */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '760px' }}>
                <thead>
                  <tr>
                    <th className="w-24 px-3 py-3 text-left bg-gray-50 dark:bg-gray-700 border-b border-r border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Time</span>
                    </th>
                    {DAYS.map(day => (
                      <th key={day} className="px-2 py-3 text-center bg-gray-50 dark:bg-gray-700 border-b border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          {day.substring(0, 3)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot, slotIndex) => {
                    if (slot.isLunch) {
                      return (
                        <tr key={slot.time}>
                          <td colSpan={DAYS.length + 1}
                            className="px-3 py-1.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-b border-gray-200 dark:border-gray-600">
                            🍽 Lunch Break — 12:00 PM – 1:00 PM
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={slot.time} className={slotIndex % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/40 dark:bg-gray-750'}>
                        {/* Time label.
                            The fixed height here is what keeps the grid aligned.
                            Without it each row sized itself to its tallest card
                            while rows fully covered by a rowSpan collapsed to
                            near-zero, so a 2h block never lined up with the two
                            hour labels it was supposed to cover. */}
                        <td
                          className="px-3 py-2 border-b border-r border-gray-100 dark:border-gray-700 align-top"
                          style={{ height: ROW_H, minWidth: '96px' }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {fmtTime(slot.time.split('-')[0])}
                            </span>
                          </div>
                        </td>

                        {/* Day cells */}
                        {DAYS.map(day => {
                          if (isMiddleCell(day, slot)) {
                            return null; // Spanned by rowSpan above
                          }

                          const existingSchedules = getCellSchedules(day, slot);
                          const pendingHere = getPendingForCell(day, slot);
                          const cellKey = `${day}-${slot.time}`;
                          const isHovered = hoveredCells.includes(cellKey);
                          const isDragging = !!draggedSubject;
                          const isEmpty = existingSchedules.length === 0 && pendingHere.length === 0;

                          // rowSpan is the longest class starting in this cell,
                          // clamped so it can't run past the rendered slots (a
                          // 3h class starting in the last visible row used to
                          // emit a rowSpan that shifted every column after it).
                          const remainingRows = TIME_SLOTS.length - slotIndex;
                          const longest = Math.max(
                            1,
                            ...existingSchedules.map(s => slotDuration(s._slot)),
                            ...pendingHere.map(p => getDurationHours(p))
                          );
                          const cellRowSpan = Math.min(longest, remainingRows);

                          return (
                            <td
                              key={day}
                              rowSpan={cellRowSpan}
                              onDragOver={handleDragOver}
                              onDragEnter={e => handleDragEnter(e, day, slotIndex)}
                              // Only clear when the pointer actually leaves this
                              // cell. `onDragLeave` also fires when crossing into
                              // a child element, which made hover state thrash
                              // enter/leave/enter and re-render the whole table
                              // on every frame.
                              onDragLeave={e => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                  setHoveredCells([]);
                                }
                              }}
                              onDrop={e => handleDrop(e, day, slotIndex)}
                              className={`px-1.5 py-1.5 border-b border-r border-gray-100 dark:border-gray-700 last:border-r-0 align-top transition-colors ${
                                isHovered && isEmpty
                                  ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-500'
                                  : isHovered && !isEmpty
                                  // Occupied cells now read as blocked during a
                                  // drag instead of only carrying a tooltip
                                  ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-inset ring-red-400 cursor-not-allowed'
                                  : isDragging && isEmpty
                                  ? 'bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                  : ''
                              }`}
                              style={{ minWidth: '110px', height: cellRowSpan * ROW_H }}
                              title={isDragging && !isEmpty ? 'Already taken — drop on a free slot' : ''}
                            >
                              {/* Column so multiple cards in one cell share the
                                  available height instead of overflowing it */}
                              <div className="flex flex-col gap-1 h-full">
                              {/* Existing schedules - NOW DRAGGABLE TO MOVE */}
                              {existingSchedules.map((sched) => {
                                const code = sched.subject?.subjectCode;
                                const color = getSubjectColor(code);
                                // Use the slot that actually renders here, so a
                                // Mon+Wed class shows Wednesday's own hours
                                // instead of Monday's.
                                const duration = slotDuration(sched._slot);

                                return (
                                  <div 
                                    key={sched._id}
                                    draggable
                                    onDragStart={e => {
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('kind', 'saved');
                                      e.dataTransfer.setData('scheduleId', String(sched._id));
                                    }}
                                    onClick={() => handleEditSavedSchedule(sched)}
                                    // Stretches to fill the cell. It used to set
                                    // its own pixel height, which fought the row
                                    // heights and broke alignment.
                                    className={`flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden border ${color.border} cursor-grab active:cursor-grabbing hover:shadow-md transition-all group`}
                                  >
                                    <div className={`${color.bg} px-2 py-1 flex items-center justify-between`}>
                                      <p className="text-white text-[11px] font-bold truncate">{code || '—'}</p>
                                      <span className="text-white/70 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                                    </div>
                                    <div className={`${color.light} px-2 py-1 flex-1 min-h-0 overflow-hidden`}>
                                      <p className={`${color.text} text-[10px] font-medium truncate`}>
                                        {sched.faculty?.user ? `${sched.faculty.user.firstName} ${sched.faculty.user.lastName}` : <span className="italic text-gray-400">No faculty</span>}
                                      </p>
                                      {/* roomLabel is resolved server-side:
                                          Schedule.room is a String holding a Room id,
                                          so it can't be populated. */}
                                      <p className="text-gray-400 text-[10px] truncate">
                                        {sched.section} · {sched.roomLabel || 'TBA'}
                                      </p>
                                      {duration > 1 && (
                                        <p className="text-gray-500 text-[9px] mt-1">
                                          <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                          {duration}h
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Pending schedules */}
                              {pendingHere.map((ps) => {
                                const code = ps.subjectData?.subjectCode;
                                const color = getSubjectColor(code);
                                const hours = getDurationHours(ps);
                                const isReady = !!ps.faculty && !!ps.room;

                                return (
                                  <div
                                    key={ps.tempId}
                                    draggable
                                    onDragStart={e => {
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('kind', 'pending');
                                      e.dataTransfer.setData('pendingId', String(ps.tempId));
                                    }}
                                    onClick={() => setEditingSchedule(ps)}
                                    className={`flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-2 relative group ${
                                      isReady ? 'border-green-400' : 'border-amber-400'
                                    }`}
                                  >
                                    {/* Top stripe */}
                                    <div className={`${color.bg} px-2 py-1.5 flex items-start justify-between gap-1`}>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-[11px] font-bold truncate">{code}</p>
                                        <p className="text-white/70 text-[10px] truncate">{ps.subjectData?.subjectName}</p>
                                      </div>
                                      <button
                                        onClick={e => { e.stopPropagation(); removePending(ps.tempId); }}
                                        className="text-white/70 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                    {/* Body */}
                                    <div className={`${isReady ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'} px-2 py-1.5 flex-1 min-h-0 overflow-hidden`}>
                                      <div className={`flex items-center gap-1 text-[10px] ${isReady ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'} font-medium mb-1`}>
                                        {isReady ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {isReady ? 'Ready to save' : 'Tap to assign'}
                                      </div>
                                      {ps.faculty && (
                                        <p className="text-[10px] text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                                          <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                          {typeof ps.faculty === 'object'
                                            ? `${ps.faculty?.user?.firstName} ${ps.faculty?.user?.lastName}`
                                            : faculty.find(f => f._id === ps.faculty)?.user
                                              ? `${faculty.find(f => f._id === ps.faculty).user.firstName} ${faculty.find(f => f._id === ps.faculty).user.lastName}`
                                              : 'Assigned'}
                                        </p>
                                      )}
                                      {ps.room && (
                                        <p className="text-[10px] text-gray-700 dark:text-gray-300 flex items-center gap-1 truncate">
                                          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                          {typeof ps.room === 'object' ? ps.room?.roomNumber : rooms.find(r => r._id === ps.room)?.roomNumber || ps.room}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-gray-500 mt-0.5">{hours}h · {ps.timeSlots[0]?.startTime}–{ps.timeSlots[0]?.endTime}</p>
                                    </div>
                                    
                                    {/* Duration stepper.
                                        This replaces a drag-to-resize handle that
                                        could not work: mousedown on a draggable
                                        element starts an HTML5 drag, so the
                                        "resize" became a drag (which deleted the
                                        card), and the trailing click opened the
                                        edit modal. */}
                                    <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        title="Shorten by 1 hour"
                                        onClick={e => { e.stopPropagation(); changeDuration(ps, -1); }}
                                        className="w-4 h-4 rounded bg-gray-900/60 text-white text-[10px] leading-none flex items-center justify-center hover:bg-gray-900"
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        title="Extend by 1 hour"
                                        onClick={e => { e.stopPropagation(); changeDuration(ps, 1); }}
                                        className="w-4 h-4 rounded bg-gray-900/60 text-white text-[10px] leading-none flex items-center justify-center hover:bg-gray-900"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Drop hints while dragging */}
                              {isEmpty && isDragging && !isHovered && (
                                <div className="flex-1 min-h-0 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg flex items-center justify-center">
                                  <span className="text-[10px] text-blue-400 font-medium">drop here</span>
                                </div>
                              )}
                              {isEmpty && isHovered && (
                                <div className="flex-1 min-h-0 border-2 border-green-500 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                                  <span className="text-[10px] text-green-700 dark:text-green-300 font-bold">
                                    {selectedHours}h here
                                  </span>
                                </div>
                              )}
                              </div>{/* /cell column */}
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

          {/* Pending summary */}
          {pendingCount > 0 && (
            <div className={`mt-4 rounded-2xl border p-4 ${
              readyCount === pendingCount
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {readyCount === pendingCount
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  <span className={`text-sm font-bold ${readyCount === pendingCount ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                    {readyCount === pendingCount
                      ? `All ${pendingCount} schedule(s) ready to save`
                      : `${pendingCount - readyCount} of ${pendingCount} still need faculty/room`}
                  </span>
                </div>
                <button
                  onClick={handleSaveAll}
                  disabled={saving || readyCount !== pendingCount}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save All
                </button>
              </div>
              <div className="space-y-1.5">
                {pendingSchedules.map((ps, i) => {
                  const isReady = !!ps.faculty && !!ps.room;
                  const code = ps.subjectData?.subjectCode;
                  const color = getSubjectColor(code);
                  return (
                    <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${isReady ? 'bg-green-100/60 dark:bg-green-900/20' : 'bg-amber-100/60 dark:bg-amber-900/20'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color.bg}`} />
                      <span className="font-semibold text-gray-900 dark:text-white">{code}</span>
                      <span className="text-gray-500 text-xs">· {ps.timeSlots[0]?.day} {ps.timeSlots[0]?.startTime}–{ps.timeSlots[0]?.endTime}</span>
                      {isReady
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-600 ml-auto" />
                        : <span className="text-amber-600 text-xs ml-auto">needs {!ps.faculty ? 'faculty' : ''}{!ps.faculty && !ps.room ? ' + ' : ''}{!ps.room ? 'room' : ''}</span>
                      }
                      <button onClick={() => setEditingSchedule(ps)} className="text-blue-600 text-xs hover:underline">Edit</button>
                      <button onClick={() => removePending(ps.tempId)} className="text-gray-400 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal for pending schedules */}
      {editingSchedule && (
        <EditScheduleModal
          schedule={editingSchedule}
          faculty={faculty}
          rooms={rooms}
          onUpdate={updatePending}
          onClose={() => setEditingSchedule(null)}
          onSave={() => handleSaveOne(editingSchedule)}
        />
      )}

      {/* Edit modal for saved schedules */}
      {editingSavedSchedule && (
        <EditScheduleModal
          schedule={editingSavedSchedule}
          faculty={faculty}
          rooms={rooms}
          onUpdate={(id, field, value) => updateSaved(id, field, value)}
          onClose={() => setEditingSavedSchedule(null)}
          onSave={() => handleUpdateSaved(editingSavedSchedule)}
          onDelete={() => handleDeleteSaved(editingSavedSchedule._id)}
          isSaved={true}
        />
      )}
    </div>
  );
};

export default ScheduleBuilder;
