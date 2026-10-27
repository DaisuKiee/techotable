import React, { useEffect } from 'react';
import {
  X, Save, MapPin, BookOpen, Clock, Calendar, AlertCircle,
  School, Info, Trash2,
} from 'lucide-react';
import AnimatedCheckIcon from './AnimatedCheckIcon';
import FacultyPicker, { Tip, Section } from './FacultyPicker';

/* ───────────────────────── helpers ───────────────────────── */

const SUBJECT_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-teal-600', 'bg-rose-600',
  'bg-orange-500', 'bg-indigo-600', 'bg-emerald-600', 'bg-pink-600',
  'bg-cyan-600', 'bg-amber-600',
];

const getSubjectColor = (code) => {
  if (!code) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/* ───────────────────────── small UI pieces ───────────────────────── */

const Chip = ({ icon: Icon, children, tip }) => (
  <Tip text={tip} side="bottom">
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 cursor-default">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  </Tip>
);

const Field = ({ label, value, wide }) => (
  <div className={`rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40 ${wide ? 'col-span-2' : ''}`}>
    <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{value || '—'}</dd>
  </div>
);

/* ───────────────────────── main component ───────────────────────── */

const EditScheduleModal = ({
  schedule, faculty, rooms, onUpdate, onClose, onSave, onDelete, isSaved = false,
}) => {
  const subjectId = schedule?.subject;
  const subjectCode = schedule?.subjectData?.subjectCode;
  const subjectName = schedule?.subjectData?.subjectName;

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!schedule) return null;

  const scheduleId = isSaved ? schedule._id : schedule.tempId;
  const headerColor = getSubjectColor(subjectCode);
  const day = schedule.timeSlots?.[0]?.day || '';
  const startTime = schedule.timeSlots?.[0]?.startTime || '';
  const endTime = schedule.timeSlots?.[schedule.timeSlots.length - 1]?.endTime || '';

  const duration = (() => {
    if (!startTime || !endTime) return 1;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(1, Math.ceil((eh * 60 + em - (sh * 60 + sm)) / 60));
  })();

  const facultyId =
    typeof schedule.faculty === 'object' ? schedule.faculty?._id || '' : schedule.faculty || '';
  const roomId = typeof schedule.room === 'object' ? schedule.room?._id || '' : schedule.room || '';
  const isReady = !!schedule.faculty && !!schedule.room;

  const missing = [!schedule.faculty && 'faculty', !schedule.room && 'room'].filter(Boolean).join(' and ');

  return (
    <div className="fixed inset-0 z-[100001] flex justify-end" role="dialog" aria-modal="true" aria-label="Edit schedule">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="relative flex h-full w-full flex-col overflow-hidden bg-gray-50 shadow-2xl dark:bg-gray-900 sm:max-w-xl">
        {/* ── Header ── */}
        <div className={`${headerColor} flex-shrink-0 px-6 pb-5 pt-6`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-medium text-white/70">Assign faculty and room</p>
              <h2 className="break-words text-2xl font-bold text-white">{subjectCode || 'Schedule'}</h2>
              <p className="mt-0.5 line-clamp-2 text-sm text-white/85">{subjectName}</p>
            </div>
            <Tip text="Close (Esc)" side="bottom" align="end">
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full bg-white/15 p-2 text-white transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-4 w-4" />
              </button>
            </Tip>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip icon={Calendar} tip="Class day">{day || 'No day'}</Chip>
            <Chip icon={Clock} tip="Class start and end time">
              {fmtTime(startTime)} – {fmtTime(endTime)}
            </Chip>
            <Chip icon={BookOpen} tip="Contact hours per session and credit units">
              {duration}h · {schedule.subjectData?.units || 0} units
            </Chip>
          </div>
        </div>

        {/* ── Status bar ── */}
        <div
          className={`flex flex-shrink-0 items-center gap-2 border-b px-6 py-2.5 text-sm ${
            isReady
              ? 'border-green-100 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
              : 'border-amber-100 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
          }`}
        >
          {isReady ? (
            <>
              <AnimatedCheckIcon className="h-4 w-4" color="#16a34a" />
              <span className="font-medium text-green-700 dark:text-green-300">Ready to save</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-700 dark:text-amber-300">Assign {missing} to continue</span>
            </>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {(
            <>
              {/* Faculty */}
              <FacultyPicker
                faculty={faculty}
                selectedFacultyId={facultyId}
                onSelect={(id) => onUpdate(scheduleId, 'faculty', id)}
                subjectId={subjectId}
                subjectCode={subjectCode}
                subjectName={subjectName}
                hint={schedule.faculty ? 'Faculty selected' : 'Required'}
                requiredWarning={!schedule.faculty}
              />

              {/* Room */}
              <Section icon={MapPin} title="Room" hint={schedule.room ? 'Room selected' : 'Required'}>
                <select
                  value={roomId}
                  onChange={(e) => onUpdate(scheduleId, 'room', e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    schedule.room ? 'border-green-400 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Select a room…</option>
                  {rooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.roomCode || room.roomNumber} — {room.roomName || room.building}
                      {room.capacity ? ` (cap. ${room.capacity})` : ''}
                    </option>
                  ))}
                </select>
                {!schedule.room && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3" /> Select a room
                  </p>
                )}
              </Section>

              {/* Section details (read-only) */}
              <Section
                icon={School}
                title="Section details"
                hint="Inherited from the selected section"
                aside={
                  <Tip text="These values come from the section and can't be edited here." side="bottom" align="end">
                    <span className="rounded-full p-1 text-gray-400"><Info className="h-4 w-4" /></span>
                  </Tip>
                }
              >
                <dl className="grid grid-cols-2 gap-2">
                  <Field label="Section" value={schedule.sectionCode || `${schedule.program}-${schedule.yearLevel}${schedule.section}`} />
                  <Field label="Max students" value={schedule.maxStudents || 40} />
                  <Field label="Program" value={schedule.program} />
                  <Field label="Year level" value={schedule.yearLevel && `Year ${schedule.yearLevel}`} />
                  <Field label="Semester" value={schedule.semester && `Semester ${schedule.semester}`} />
                  <Field label="Shift" value={schedule.shift} />
                  <Field label="Academic year" value={schedule.academicYear} wide />
                </dl>
              </Section>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            {isSaved && onDelete && (
              <Tip text="Permanently delete this schedule">
                <button
                  onClick={() => {
                    if (window.confirm('Delete this schedule? This cannot be undone.')) onDelete();
                  }}
                  className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </Tip>
            )}
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <Tip
              text={isReady ? '' : `Assign ${missing} first`}
              className="flex-1"
            >
              <button
                onClick={onSave}
                disabled={!isReady}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaved ? 'Update' : 'Save'} &amp; close
              </button>
            </Tip>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default EditScheduleModal;