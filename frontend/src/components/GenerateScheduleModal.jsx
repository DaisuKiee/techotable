import React, { useState, useCallback, useEffect } from 'react';
import { scheduleAPI, sectionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { X, Wand2, Loader, CheckCircle, AlertTriangle, Calendar, Sparkles } from 'lucide-react';
import { ModalShell } from './modal/ModalShell';
import { Bone, SkeletonRegion } from './ui/Skeleton';

const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];

const GRID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Deterministic colour per subject code, so the same subject keeps its colour
// between regenerations and is easy to follow across the week.
const BLOCK_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-red-100 border-red-300 text-red-900',
  'bg-orange-100 border-orange-300 text-orange-900',
  'bg-emerald-100 border-emerald-300 text-emerald-900',
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-blue-100 border-blue-300 text-blue-900',
];

const blockColor = (code = '') => {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length];
};

const toMinutes = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isNaN(h) ? null : h * 60 + (m || 0);
};

const fmtHour = (mins) => {
  const h = Math.floor(mins / 60);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${period}`;
};

/**
 * The generated week, drawn as a timetable.
 *
 * A preview of nine subjects used to be nine stacked cards, which answers
 * "what was assigned" but not "is this a sensible week" - the question you
 * actually have before saving. Rows span only the hours the solver used.
 */
/**
 * Close calls from the generator: classes where another teacher fits about as
 * well as the one it picked. You choose; a pick swaps the teacher in the
 * preview before saving. Options that would clash with another pick (same
 * teacher, overlapping times) or exceed that teacher's spare load are disabled.
 */
const slotsOverlap = (a = [], b = []) => a.some((x) => b.some((y) => {
  if (x.day !== y.day) return false;
  const [xs, xe, ys, ye] = [toMinutes(x.startTime), toMinutes(x.endTime), toMinutes(y.startTime), toMinutes(y.endTime)];
  return xs !== null && ys !== null && xs < ye && ys < xe;
}));

const CloseCallsPanel = ({ calls, schedules, onPick }) => {
  const current = (call) => String(schedules[call.index]?.faculty || call.chosen.facultyId);

  // Why an alternative can't be picked right now, given the other picks
  const blockedReason = (call, alt) => {
    const others = calls.filter((c) => c.index !== call.index && current(c) === alt.facultyId && c.chosen.facultyId !== alt.facultyId);
    const clash = others.find((c) => slotsOverlap(schedules[c.index]?.timeSlots, schedules[call.index]?.timeSlots));
    if (clash) return `Already picked for ${clash.subjectCode} at the same time`;
    const extra = others.reduce((sum, c) => sum + (c.units || 0), 0);
    if (extra + call.units > alt.spareUnits) return 'Would go over their teaching load';
    return null;
  };

  const option = (call, person, { pick, why, blocked }) => {
    const selected = current(call) === person.facultyId;
    return (
      <button
        key={person.facultyId}
        type="button"
        disabled={!!blocked && !selected}
        onClick={() => onPick(call, person)}
        aria-pressed={selected}
        title={blocked || why || undefined}
        className={`flex min-w-0 flex-1 basis-40 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
          selected
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-900/30'
            : 'border-gray-200 bg-white hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <span className="w-full truncate text-sm font-semibold text-gray-900 dark:text-white">{person.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          Experience {person.experience}
          {person.qualified && <span className="rounded bg-emerald-100 px-1.5 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Qualified</span>}
          {pick && <span className="rounded bg-gray-100 px-1.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">Generator's pick</span>}
        </span>
        {blocked && !selected && <span className="mt-1 text-[11px] text-orange-700 dark:text-orange-300">{blocked}</span>}
      </button>
    );
  };

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800/60 dark:bg-blue-900/10">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Your call ({calls.length})</p>
      <p className="mb-3 text-xs text-blue-800 dark:text-blue-200">
        For these classes another teacher fits about as well as the one the generator picked, so it's your decision.
        Every option shown is free at those times. Pick one to swap it in before saving.
      </p>
      <ul className="space-y-3">
        {calls.map((call) => (
          <li key={call.index}>
            <p className="mb-1.5 text-xs text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">{call.subjectCode}</span>
              {call.subjectName ? ` ${call.subjectName}` : ''} · {call.sectionCode} · {call.units} units
            </p>
            <div className="flex flex-wrap gap-2">
              {option(call, call.chosen, { pick: true })}
              {call.alternatives.map((alt) => option(call, alt, { why: alt.why, blocked: blockedReason(call, alt) }))}
            </div>
            {call.alternatives.some((a) => a.why?.startsWith('Stronger')) && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                The generator passed over a stronger fit here to keep loads balanced or the week workable.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PreviewGrid = ({ schedules }) => {
  const placed = [];
  for (const s of schedules || []) {
    for (const slot of s.timeSlots || []) {
      const start = toMinutes(slot.startTime);
      const end = toMinutes(slot.endTime);
      if (start === null || end === null) continue;
      placed.push({
        day: slot.day,
        start,
        end,
        code: s.metadata?.subjectCode || '—',
        faculty: s.metadata?.facultyName,
        room: s.metadata?.roomName || s.metadata?.roomNumber,
      });
    }
  }

  if (placed.length === 0) return null;

  const firstHour = Math.floor(Math.min(...placed.map(p => p.start)) / 60);
  const lastHour = Math.ceil(Math.max(...placed.map(p => p.end)) / 60);
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const days = GRID_DAYS.filter(d => placed.some(p => p.day === d));

  // Every cell is placed explicitly on a 30-minute row grid. The grid used to
  // rely on auto-flow with "covered" cells omitted, which only lines up when
  // every class starts on the hour and none overlap - the old first-fit
  // generator broke both, and one misplaced cell shifted the rest of the week.
  const SLOT = 30;
  const rowOf = (mins) => Math.floor((mins - firstHour * 60) / SLOT) + 2; // row 1 is the header

  // Classes that overlap on the same day sit side by side in lanes rather
  // than on top of each other.
  const lanesByDay = {};
  for (const day of days) {
    const laneEnds = [];
    placed
      .filter(p => p.day === day)
      .sort((a, b) => a.start - b.start || b.end - a.end)
      .forEach(p => {
        let lane = laneEnds.findIndex(end => end <= p.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = p.end;
        p.lane = lane;
      });
    lanesByDay[day] = laneEnds.length;
  }
  const colStart = {};
  let col = 2; // column 1 is the time axis
  for (const day of days) {
    colStart[day] = col;
    col += lanesByDay[day];
  }
  const dayColumns = days.map(d => `repeat(${lanesByDay[d]}, minmax(0, 1fr))`).join(' ');

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[560px] gap-px rounded-lg bg-gray-200 p-px"
        style={{
          gridTemplateColumns: `3.25rem ${dayColumns}`,
          gridTemplateRows: `auto repeat(${hours.length * 2}, 1.4rem)`,
        }}
      >
        <div className="bg-gray-50" style={{ gridColumn: 1, gridRow: 1 }} />
        {days.map(day => (
          <div
            key={day}
            className="bg-gray-50 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600"
            style={{ gridColumn: `${colStart[day]} / span ${lanesByDay[day]}`, gridRow: 1 }}
          >
            {day.slice(0, 3)}
          </div>
        ))}

        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div
              className="bg-gray-50 pt-1 pr-1.5 text-right text-[10px] font-medium text-gray-500"
              style={{ gridColumn: 1, gridRow: `${rowOf(hour * 60)} / span 2` }}
            >
              {fmtHour(hour * 60)}
            </div>
            {days.map(day => (
              <div
                key={day}
                className="bg-white"
                style={{ gridColumn: `${colStart[day]} / span ${lanesByDay[day]}`, gridRow: `${rowOf(hour * 60)} / span 2` }}
              />
            ))}
          </React.Fragment>
        ))}

        {placed.map((p, i) => {
          const span = Math.max(1, Math.ceil((p.end - p.start) / SLOT));
          return (
            <div
              key={i}
              className={`relative overflow-hidden border-l-2 px-1.5 py-1 ${blockColor(p.code)}`}
              style={{ gridColumn: colStart[p.day] + p.lane, gridRow: `${rowOf(p.start)} / span ${span}` }}
              title={`${p.code} · ${p.faculty || 'TBA'} · ${p.room || 'TBA'}`}
            >
              <p className="truncate text-[11px] font-bold leading-tight">{p.code}</p>
              {span >= 2 && p.faculty && (
                <p className="truncate text-[9px] leading-tight opacity-80">{p.faculty}</p>
              )}
              {span > 1 && p.room && (
                <p className="truncate text-[9px] leading-tight opacity-70">{p.room}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * What generating this section involves, shown as soon as it's picked: the
 * term, every subject (and which are already scheduled), who can teach each
 * one, rooms, and anything that will stop the solver.
 */
const SectionInsight = ({ sectionId }) => {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!sectionId) { setInfo(null); return undefined; }
    let live = true;
    setInfo(null);
    setError('');
    scheduleAPI.getGenerationInfo(sectionId)
      .then((res) => { if (live) setInfo(res.data.data); })
      .catch((err) => { if (live) setError(err.response?.data?.message || 'Could not load section details'); });
    return () => { live = false; };
  }, [sectionId]);

  if (!sectionId) return null;
  if (error) return <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">{error}</p>;
  if (!info) {
    return (
      <SkeletonRegion label="Loading section details" className="mt-3 space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <Bone className="h-4 w-1/3" />
        <Bone className="h-3 w-2/3" />
        <Bone className="h-16 w-full" />
      </SkeletonRegion>
    );
  }

  const { section, totals, resources, subjects, warnings, isCurrentTerm, currentTerm } = info;
  const rows = showAll ? subjects : subjects.slice(0, 6);
  const tone = {
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200',
    warning: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-100',
    info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-100',
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-blue-200 bg-white dark:border-blue-900/60 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/20">
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{section.sectionCode}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {section.program} · Year {section.yearLevel} · {section.shift} shift · {section.termLabel}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isCurrentTerm ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
          {isCurrentTerm ? `Current term · ${currentTerm.daysLeft} days left` : currentTerm ? 'Not the current term' : 'No current term set'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700 sm:grid-cols-4">
        {[
          ['To schedule', `${totals.toSchedule} of ${totals.subjects}`, 'subjects'],
          ['Weekly hours', `${totals.allWeeklyHours}h`, totals.toSchedule ? `${totals.weeklyHours}h still to schedule` : `${totals.allUnits} units, all scheduled`],
          ['Students', section.students, `of ${section.maxStudents} seats`],
          ['Home room', section.homeRoom || 'None', `${resources.labRooms} labs · ${resources.lectureRooms} rooms`],
        ].map(([label, value, hint]) => (
          <div key={label} className="bg-white px-4 py-3 dark:bg-gray-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-0.5 truncate text-lg font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{hint}</p>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-2 px-4 pt-3">
          {warnings.map((w) => (
            <li key={w.text} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone[w.level] || tone.info}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {w.text}
            </li>
          ))}
        </ul>
      )}

      {subjects.length > 0 && (
        <div className="px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Subjects · {resources.faculty} {section.program} faculty can be assigned
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="pb-1.5 pr-3 font-medium">Subject</th>
                  <th className="pb-1.5 pr-3 font-medium">Hours</th>
                  <th className="pb-1.5 pr-3 font-medium">Room</th>
                  <th className="pb-1.5 pr-3 font-medium">Experienced</th>
                  <th className="pb-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {rows.map((s) => (
                  <tr key={s._id} className="text-gray-800 dark:text-gray-200">
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{s.subjectCode}</span>
                      <span className="block max-w-[14rem] truncate text-xs text-gray-500 dark:text-gray-400">{s.subjectName}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-xs tabular-nums">
                      {s.lectureHours ? `${s.lectureHours} lec` : ''}{s.lectureHours && s.labHours ? ' + ' : ''}{s.labHours ? `${s.labHours} lab` : ''}{!s.lectureHours && !s.labHours ? `${s.units} units` : ''}
                    </td>
                    <td className="py-1.5 pr-3 text-xs">{s.saturdayOnly ? 'Saturday' : s.needsLab ? 'Lab' : 'Home room'}</td>
                    <td className="py-1.5 pr-3 text-xs">
                      {s.experiencedFaculty ? `${s.experiencedFaculty} teacher${s.experiencedFaculty === 1 ? '' : 's'}` : <span className="text-orange-700 dark:text-orange-300">none yet</span>}
                    </td>
                    <td className="py-1.5 text-xs">
                      {s.scheduled
                        ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Scheduled</span>
                        : <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">To schedule</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subjects.length > 6 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
              {showAll ? 'Show fewer' : `Show all ${subjects.length} subjects`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};


const GenerateScheduleModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ortoolsStatus, setOrtoolsStatus] = useState(null);
  const [availableSections, setAvailableSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  // A constraint solve can run for the full time limit. Without a visible
  // counter a 60-second wait behind a static spinner looks like a hang.
  const [elapsed, setElapsed] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Settings stay open until there is a result to look at; "Change settings"
  // brings them back.
  const [showSettings, setShowSettings] = useState(true);
  const [showSubjectList, setShowSubjectList] = useState(false);
  const [formData, setFormData] = useState({
    section: '', // Section ID
    // 'ortools' runs OR-Tools and falls back to the built-in solver on the
    // server if it cannot run there; 'builtin' goes straight to the built-in
    // solver. Both take the same input and enforce the same rules - the old
    // 'greedy' first-fit heuristic, which skipped subjects that no longer fit,
    // is gone.
    method: 'ortools',
    timeLimit: 60, // seconds; the built-in solver stops early once it stops improving
    priority: 'balanced', // which objective the solver should favour
    // 'quick': the built-in solver stops once it stops improving (seconds).
    // 'thorough': it keeps improving until the time limit - on real sections
    // this reached the same score as OR-Tools.
    thoroughness: 'quick',
    // Hours a teacher gets between one class and the next on the same day
    prepGap: 1
  });

  // Check OR-Tools availability on mount
  useEffect(() => {
    checkOrtoolsAvailability();
  }, []);

  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [generating]);

  const fetchAvailableSections = useCallback(async () => {
    setLoadingSections(true);
    console.log('=== FETCHING ALL SECTIONS ===');
    
    try {
      const response = await sectionAPI.getAll();
      
      console.log('Sections response:', response.data);
      
      if (response.data.success) {
        setAvailableSections(response.data.data || []);
        console.log('Available sections:', response.data.data);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      setAvailableSections([]);
    } finally {
      setLoadingSections(false);
      console.log('=== SECTIONS FETCH COMPLETE ===');
    }
  }, []);

  // Fetch sections on mount
  useEffect(() => {
    fetchAvailableSections();
  }, [fetchAvailableSections]);

  const checkOrtoolsAvailability = async () => {
    try {
      const response = await scheduleAPI.checkORToolsStatus();
      const status = response.data.ortools;
      setOrtoolsStatus(status);

      // Without OR-Tools on the server, say so up front by selecting the
      // built-in solver rather than letting the fallback happen silently.
      if (!status?.available) {
        setFormData(prev => ({ ...prev, method: 'builtin' }));
      }
    } catch (error) {
      console.error('Failed to check OR-Tools status:', error);
      setOrtoolsStatus({ available: false });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: ['timeLimit'].includes(name) ? parseInt(value) || 1 : value
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    console.log('=== GENERATE SCHEDULE PREVIEW CLICKED ===');
    console.log('Form Data:', formData);
    
    if (!formData.section) {
      console.error('No section selected!');
      toast.error('Please select a section');
      return;
    }

    // Find the selected section to get its details
    const selectedSection = availableSections.find(s => s._id === formData.section);
    if (!selectedSection) {
      toast.error('Selected section not found');
      return;
    }

    setGenerating(true);
    setPreviewData(null);

    try {
      const generateData = {
        program: selectedSection.program,
        yearLevel: parseInt(selectedSection.yearLevel),
        semester: parseInt(selectedSection.semester),
        shift: selectedSection.shift,
        section: selectedSection.sectionLetter,
        academicYear: selectedSection.academicYear,
        method: formData.method,
        timeLimit: parseInt(formData.timeLimit),
        priority: formData.priority,
        thoroughness: formData.thoroughness,
        prepGap: formData.prepGap
      };

      console.log('Sending preview request:', generateData);
      const response = await scheduleAPI.preview(generateData);
      console.log('Preview response:', response.data);
      
      const payload = response.data;
      const body = payload.data || {};
      const preview = body.preview || body;

      if (payload.success) {
        const scheduled = preview.schedules?.length || 0;

        setPreviewData({
          success: true,
          message: payload.message,
          method: payload.method,
          // The engine that actually ran - 'builtin' when OR-Tools was asked
          // for but could not run on the server. `payload.method` is a display
          // string ("Google OR-Tools CP-SAT"), so it can't be compared to a key.
          engine: payload.engine || formData.method,
          fellBack: !!payload.fellBack,
          methodNote: body.methodNote || preview.methodNote,
          priorityUsed: formData.priority,
          // Solver notes: relaxed room capacity, subjects left alone, and so on
          diagnostics: body.diagnostics || preview.diagnostics || [],
          skipped: body.skipped || preview.skipped || [],
          preview,
          sectionInfo: selectedSection
        });

        // Hand the body over to the result; the settings fold into a summary.
        if (scheduled > 0) setShowSettings(false);

        // A successful solve with nothing to place is not worth a success toast
        if (scheduled === 0) {
          toast(payload.message || 'Nothing to schedule for this section', { duration: 6000 });
        } else {
          toast.success(`${scheduled} class${scheduled === 1 ? '' : 'es'} ready to review`);
        }
      } else {
        setPreviewData({
          success: false,
          message: payload.message,
          method: payload.method,
          blockers: payload.blockers || body.blockers || [],
          diagnostics: payload.diagnostics || body.diagnostics || [],
        });
        toast.error(payload.message || 'Could not generate a preview');
      }
    } catch (error) {
      console.error('Generate preview failed:', error);

      // A solver timeout or a dead server has no response body, so reading
      // error.response.data.message alone produced a bare "Failed to generate
      // preview" with nothing the user could act on.
      let message;
      let hint;

      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
        message = `The request timed out after about ${formData.timeLimit + 45}s.`;
        hint = 'Lower the time limit, or switch to the built-in solver, which usually finishes in a few seconds.';
      } else if (!error.response || error.isNetworkError) {
        message = 'Could not reach the server.';
        hint = 'Check that the backend is running, then try again.';
      } else {
        message = error.response.data?.message
          || error.response.data?.error
          || `The server returned ${error.response.status}.`;
        hint = error.response.data?.blockers?.length ? null : undefined;
      }

      setPreviewData({
        success: false,
        message,
        hint,
        blockers: error.response?.data?.blockers || [],
      });
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveSchedules = async () => {
    if (!previewData || !previewData.preview || !previewData.preview.schedules) {
      toast.error('No schedules to save');
      return;
    }

    setSaving(true);

    try {
      console.log('Saving schedules:', previewData.preview.schedules);
      const response = await scheduleAPI.savePreview({
        schedules: previewData.preview.schedules
      });

      if (response.data.success) {
        toast.success(`Successfully saved ${response.data.saved} schedule(s)!`);
        onClose(true); // Refresh parent
      } else {
        toast.error(response.data.message || 'Failed to save schedules');
      }
    } catch (error) {
      console.error('Save schedules error:', error);
      toast.error(error.response?.data?.message || 'Failed to save schedules');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // If schedules were saved, refresh the parent
    if (previewData?.success && !previewData.preview) {
      onClose(true);
    } else {
      onClose(false);
    }
  };

  const isORTools = formData.method === 'ortools';
  const engineName = (engine) => (engine === 'builtin' ? 'Built-in solver' : 'OR-Tools');
  // Both generators nest their numbers differently; read once, guarded, so a
  // missing field can't blow up the whole panel.
  // Swap the teacher on one previewed class (a "Your call" pick)
  const pickTeacher = useCallback((call, person) => {
    setPreviewData((prev) => {
      if (!prev?.preview?.schedules?.[call.index]) return prev;
      const schedules = prev.preview.schedules.map((sch, i) => (i !== call.index ? sch : {
        ...sch,
        faculty: person.facultyId,
        metadata: { ...sch.metadata, facultyName: person.name, facultyExperience: person.experience },
      }));
      return { ...prev, preview: { ...prev.preview, schedules } };
    });
  }, []);

  const stats = previewData?.preview?.statistics || {};

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-emerald-600';
      case 'partial':
        return 'text-orange-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} className="text-emerald-600" />;
      case 'partial':
        return <AlertTriangle size={20} className="text-orange-600" />;
      case 'failed':
        return <AlertTriangle size={20} className="text-red-600" />;
      default:
        return null;
    }
  };

  return (
    /*
     * Fixed-height panel with its own scrolling body. The dialog used to grow
     * with its content and rely on the page scrolling, so once a preview was
     * rendered the action buttons were pushed off screen.
     */
    // The panel widens once there is a timetable to look at. A solve in
    // progress can't be dismissed by a stray Escape or backdrop click.
    <ModalShell
      onClose={handleClose}
      size={previewData?.success ? 'xl' : 'lg'}
      label="Schedule generator"
      busy={generating || saving}
      guardDirty={false}
      focusFirstField={false}
      panelClassName="transition-[max-width] duration-300"
    >
        {/* Header */}
        <div className="bg-blue-600 px-4 sm:px-6 py-4 flex-shrink-0 sm:rounded-t-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              <Wand2 className="text-white mr-3 flex-shrink-0" size={22} />
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                  Schedule Generator
                </h3>
                <p className="text-xs text-blue-200 truncate">
                  {isORTools ? 'Google OR-Tools constraint solver' : 'Built-in constraint solver'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="text-blue-100 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Form: body scrolls, footer stays put */}
        <form onSubmit={handleGenerate} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Once a timetable exists the settings fold into one line. They
                used to stay fully expanded above the result, so reviewing what
                you were about to save meant scrolling past every input. */}
            {previewData?.success && !showSettings && (
              <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-semibold text-gray-900">
                  {previewData.sectionInfo?.sectionCode}
                </span>
                <span className="text-gray-300">·</span>
                <span>{engineName(previewData.engine)}</span>
                <span className="text-gray-300">·</span>
                <span className="capitalize">{formData.priority}</span>
                <span className="text-gray-300">·</span>
                <span>{formData.timeLimit}s budget</span>
                {previewData.engine === 'builtin' && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize">{formData.thoroughness}</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="ml-auto font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Change settings
                </button>
              </div>
            )}

            <div className={previewData?.success && !showSettings ? 'hidden' : 'mb-6'}>
              <div className="grid grid-cols-1 gap-4">
                {/* Section Selector: the one required input, so it leads. The
                    blurb that used to sit above it described the feature in
                    marketing terms and pushed this below the fold. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Section *
                  </label>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    required
                    disabled={generating || loadingSections}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">-- Select a Section --</option>
                    {availableSections.map(section => (
                      <option key={section._id} value={section._id}>
                        {section.sectionCode} · {section.program} Year {section.yearLevel} · {section.shift} · AY {section.academicYear} Sem {section.semester}
                      </option>
                    ))}
                  </select>
                  {!formData.section && (
                    <p className="text-xs text-gray-500 mt-1">
                      {loadingSections ? 'Loading sections...' : `${availableSections.length} section${availableSections.length !== 1 ? 's' : ''} available. Pick one to see its subjects, rooms and any problems before generating.`}
                    </p>
                  )}
                  <SectionInsight sectionId={formData.section} />
                </div>


              </div>

              {/* What the solver optimises for. These map to objective weights
                  that both engines share, so a preset means the same thing
                  whichever one runs. */}
              {(
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What should it optimise for?
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Every result is checked for clashes before you see it. This only changes
                    which trade-off the solver prefers when several valid timetables exist.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { value: 'balanced', label: 'Balanced', hint: 'Experience first, then fair load' },
                      { value: 'experience', label: 'Teaching experience', hint: 'Who has taught it most recently' },
                      { value: 'workload', label: 'Even workload', hint: 'Spread hours across faculty' },
                      { value: 'compact', label: 'Compact days', hint: 'Fewer gaps, later starts' }
                    ].map(({ value, label, hint }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priority: value }))}
                        disabled={generating}
                        aria-pressed={formData.priority === value}
                        className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                          formData.priority === value
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${
                          formData.priority === value ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {label}
                        </span>
                        <span className={`block text-xs mt-0.5 ${
                          formData.priority === value ? 'text-blue-700' : 'text-gray-500'
                        }`}>
                          {hint}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5">
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                      Preparation time between a teacher's classes
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      A teacher will not be given two classes closer together than this on the
                      same day. If no timetable exists that can honour it, the solver says so
                      and builds one without it rather than failing.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { value: 0, label: 'None', hint: 'Classes may run back to back' },
                        { value: 1, label: '1 hour', hint: 'Campus policy' },
                        { value: 2, label: '2 hours', hint: 'More breathing room' },
                        { value: 3, label: '3 hours', hint: 'Hard to satisfy' }
                      ].map(({ value, label, hint }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, prepGap: value }))}
                          disabled={generating}
                          aria-pressed={formData.prepGap === value}
                          className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                            formData.prepGap === value
                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`block text-sm font-semibold ${
                            formData.prepGap === value ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {label}
                          </span>
                          <span className={`block text-xs mt-0.5 ${
                            formData.prepGap === value ? 'text-blue-700' : 'text-gray-500'
                          }`}>
                            {hint}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Options - collapsed by default. It is named "advanced"
                  but used to be permanently expanded above the fold. */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((open) => !open)}
                  aria-expanded={showAdvanced}
                  className="flex w-full items-center justify-between text-sm font-semibold text-gray-900 hover:text-blue-700"
                >
                  <span className="flex items-center">
                    <Wand2 size={18} className="mr-2 text-blue-600" />
                    Advanced Options
                  </span>
                  <span className="text-xs font-normal text-gray-500">
                    {showAdvanced ? 'Hide' : 'Show'}
                  </span>
                </button>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden transition-all duration-300 ${
                  showAdvanced ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                }`}>
                  {/* Generation Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Generation Method
                    </label>
                    <select
                      name="method"
                      value={formData.method}
                      onChange={handleChange}
                      disabled={generating}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="ortools" disabled={!ortoolsStatus?.available}>
                        OR-Tools constraint solver {!ortoolsStatus?.available && '(not installed)'}
                      </option>
                      <option value="builtin">Built-in constraint solver</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {isORTools
                        ? 'Google CP-SAT. Searches for the full time limit and can prove a timetable is optimal. Falls back to the built-in solver if it cannot run.'
                        : 'Same rules and priorities as OR-Tools, no Python needed. Usually finishes in seconds and stops once the timetable stops improving.'}
                    </p>
                  </div>

                  {/* Time limit: a fixed budget for OR-Tools, a ceiling for the
                      built-in solver */}
                  {(
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Optimization time limit
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {[15, 30, 60, 120].map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, timeLimit: preset }))}
                            disabled={generating}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                              formData.timeLimit === preset
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                            }`}
                          >
                            {preset}s
                          </button>
                        ))}
                        <input
                          type="number"
                          name="timeLimit"
                          value={formData.timeLimit}
                          onChange={handleChange}
                          disabled={generating}
                          min="10"
                          max="300"
                          aria-label="Optimization time limit in seconds"
                          className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {isORTools
                          ? `OR-Tools searches for up to this long, so generating will take about ${formData.timeLimit}s. Longer budgets can find better timetables.`
                          : formData.thoroughness === 'thorough'
                            ? `The built-in solver keeps improving the timetable for the full ${formData.timeLimit}s.`
                            : `The built-in solver stops early once its result stops improving, and never runs past ${formData.timeLimit}s.`}
                      </p>
                    </div>
                  )}

                  {/* Built-in solver: stop early, or use the whole time limit.
                      Also applies when OR-Tools falls back to it on a server
                      without Python. */}
                  {(
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search depth
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Search depth">
                        {[
                          { value: 'quick', label: 'Quick', hint: 'Done in seconds; stops once it stops improving' },
                          { value: 'thorough', label: 'Thorough', hint: 'Uses the whole time limit to polish the result' },
                        ].map(({ value, label, hint }) => {
                          const on = formData.thoroughness === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              disabled={generating}
                              onClick={() => setFormData(prev => ({ ...prev, thoroughness: value }))}
                              className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                                on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-300 bg-white hover:border-blue-400'
                              }`}
                            >
                              <span className={`block text-sm font-semibold ${on ? 'text-blue-900' : 'text-gray-900'}`}>{label}</span>
                              <span className="block text-xs text-gray-500">{hint}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {isORTools
                          ? 'OR-Tools always searches for the full time limit. This setting applies when the server has no Python and the built-in solver runs instead.'
                          : 'Thorough matched OR-Tools’ result on real sections; Quick is usually within a fraction of a percent.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* OR-Tools status. Only worth a banner when something is
                    wrong - a permanent green "available and ready" is noise
                    that pushes the real content down. */}
                {ortoolsStatus && !ortoolsStatus.available && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    ortoolsStatus.available 
                      ? 'bg-emerald-50 border border-emerald-200' 
                      : 'bg-orange-50 border border-orange-200'
                  }`}>
                    <p className="text-sm flex items-center">
                      {ortoolsStatus.available ? (
                        <>
                          <CheckCircle size={16} className="text-emerald-600 mr-2" />
                          <span className="text-emerald-800">
                            Google OR-Tools is available and ready
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} className="text-orange-600 mr-2" />
                          <span className="text-orange-800">
                            OR-Tools is not installed on the server, so the built-in solver is used.
                            Same rules and priorities. To enable it: pip install ortools
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Results */}
            {previewData && previewData.success && previewData.preview && (
              <div className="mb-6">
                {/* Preview Header */}
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-blue-900">
                          Schedule Preview - {previewData.sectionInfo?.sectionCode}
                        </h4>
                        {/* Names the engine that actually produced this. It
                            used to read "AI-Powered" off a flag that fell back
                            to the form's own toggle, so it appeared even for a
                            pure constraint solve. */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-200 text-blue-900">
                          <Sparkles size={12} className="mr-1" />
                          {engineName(previewData.engine)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700">
                        {stats.scheduledSubjects ?? 0} of {stats.totalSubjects ?? 0} subjects scheduled
                      </p>
                      {previewData.methodNote && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          {previewData.methodNote}
                        </p>
                      )}
                    </div>
                    <CheckCircle className="text-blue-600" size={24} />
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium">Scheduled</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {stats.scheduledSubjects ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-600 font-medium">Not placed</p>
                    <p className="text-2xl font-bold text-red-700">
                      {stats.failedSubjects ?? 0}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-600 font-medium">Conflicts</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {stats.conflictsDetected ?? 0}
                    </p>
                  </div>
                </div>

                {/* Solver detail. Worth showing: it explains what the optimizer
                    actually balanced, and whether it ran out of time. */}
                {stats.solverTime !== undefined && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <dt className="text-gray-500">Solve time</dt>
                        <dd className="font-semibold text-gray-900">{stats.solverTime}s</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Busiest teacher</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.busiestFacultyUnits || 0} units
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Matched on experience</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.assignmentsWithExperience || 0}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Existing classes avoided</dt>
                        <dd className="font-semibold text-gray-900">
                          {stats.existingBlocksRespected || 0}
                        </dd>
                      </div>
                    </dl>
                    {stats.hitTimeLimit && (
                      <p className="text-xs text-gray-600 mt-2">
                        The solver used its full {formData.timeLimit}s budget, so this is a good
                        timetable rather than a proven-best one. Raise the time limit to search further.
                      </p>
                    )}
                  </div>
                )}

                {/* Solver notes, e.g. room capacity relaxed */}
                {previewData.diagnostics?.length > 0 && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs font-semibold text-orange-900 mb-1.5">Worth knowing</p>
                    <ul className="space-y-1">
                      {previewData.diagnostics.map((d, i) => (
                        <li key={i} className="text-xs text-orange-800 flex gap-2">
                          <span className="text-orange-500 flex-shrink-0">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Subjects left alone because they already have a schedule */}
                {previewData.skipped?.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      Already scheduled, left untouched ({previewData.skipped.length})
                    </p>
                    <p className="text-xs text-blue-800">
                      {previewData.skipped.map(s => s.subject_code || s.subjectCode).join(', ')}
                    </p>
                  </div>
                )}

                {/* What this weighting gave up, so the score isn't the whole story */}
                {previewData.preview.tradeoffs?.notes?.length > 0 && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <p className="mb-1.5 text-xs font-semibold text-gray-900 dark:text-white">What this plan gives up</p>
                    <ul className="space-y-1">
                      {previewData.preview.tradeoffs.notes.map((n, i) => (
                        <li key={i} className="flex gap-2 text-xs text-gray-700 dark:text-gray-300">
                          <span className="flex-shrink-0 text-gray-400">•</span><span>{n}</span>
                        </li>
                      ))}
                    </ul>
                    {previewData.preview.tradeoffs.facts?.busiest && (
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        Busiest teacher: {previewData.preview.tradeoffs.facts.busiest.name}, {previewData.preview.tradeoffs.facts.busiest.units} of {previewData.preview.tradeoffs.facts.busiest.max} units
                        {' · '}Idle time between classes: {previewData.preview.tradeoffs.facts.idleHours} h a week.
                        {' '}Change “What should it optimise for?” to trade differently.
                      </p>
                    )}
                  </div>
                )}

                {/* Close calls: the person decides between equally good teachers */}
                {previewData.preview.closeCalls?.length > 0 && (
                  <CloseCallsPanel
                    calls={previewData.preview.closeCalls}
                    schedules={previewData.preview.schedules}
                    onPick={pickTeacher}
                  />
                )}

                {/* The generated week. This is the thing you actually judge
                    before saving, so it leads; the per-subject cards below
                    carry the detail. */}
                {previewData.preview.schedules?.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-gray-900">
                        Generated week
                      </h5>
                      <button
                        type="button"
                        onClick={() => setShowSubjectList((v) => !v)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {showSubjectList ? 'Hide details' : `Show details (${previewData.preview.schedules.length})`}
                      </button>
                    </div>
                    <PreviewGrid schedules={previewData.preview.schedules} />
                  </div>
                )}

                {/* Scheduled Subjects */}
                {showSubjectList && previewData.preview.schedules && previewData.preview.schedules.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-900 mb-2">
                      ✓ Scheduled Subjects ({previewData.preview.schedules.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.schedules.map((schedule, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-gray-900">
                                  {schedule.metadata.subjectCode}
                                </span>
                                {/* Guarded: the OR-Tools path did not send units,
                                    which rendered a bare " units" badge */}
                                {schedule.metadata.units != null && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    {schedule.metadata.units} units
                                  </span>
                                )}
                                {schedule.metadata.facultyExperience > 0 && (
                                  <span
                                    className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded inline-flex items-center gap-1"
                                    title="Assigned to a teacher who has taught this subject before"
                                  >
                                    <Sparkles size={10} />
                                    experienced
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mb-1">
                                {schedule.metadata.subjectName}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Faculty:</span>
                              <span className="ml-1 text-gray-900 font-medium">
                                {schedule.metadata.facultyName}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Room:</span>
                              <span className="ml-1 text-gray-900 font-medium">
                                {schedule.metadata.roomName || schedule.metadata.roomNumber || 'TBA'}
                                {schedule.metadata.roomCapacity
                                  ? ` (cap. ${schedule.metadata.roomCapacity})`
                                  : ''}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {schedule.timeSlots.map((slot, slotIdx) => (
                              <span key={slotIdx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                {slot.day} {slot.startTime}-{slot.endTime}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed Subjects */}
                {previewData.preview.failed && previewData.preview.failed.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-red-700 mb-2">
                      ✗ Failed Subjects ({previewData.preview.failed.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.failed.map((fail, idx) => (
                        <div key={idx} className="bg-red-50 rounded-lg p-3 border border-red-200">
                          <div className="flex items-center justify-between">
                            <div>
                              {/* Greedy reports `subject`, the solver `subjectCode` */}
                              <span className="font-semibold text-red-900">
                                {fail.subjectCode || fail.subject}
                              </span>
                              {fail.subjectName && (
                                <span className="text-sm text-red-700 ml-2">- {fail.subjectName}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-red-600 mt-1">{fail.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {previewData.preview.conflicts && previewData.preview.conflicts.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-orange-700 mb-2">
                      ⚠ Conflicts Detected ({previewData.preview.conflicts.length})
                    </h5>
                    <div className="space-y-2">
                      {previewData.preview.conflicts.map((conflict, idx) => (
                        <div key={idx} className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-orange-900">{conflict.subject}</span>
                              {conflict.subjectName && (
                                <span className="text-sm text-orange-700 ml-2">- {conflict.subjectName}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-orange-600 mt-1">{conflict.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Failed Generation. The solver explains WHY (section already full,
                no lab room, load caps), so surface that instead of a bare
                "Failed to generate preview". */}
            {previewData && !previewData.success && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={22} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-red-800 mb-1">
                      Could not generate a schedule
                    </h4>
                    <p className="text-sm text-red-700 break-words">{previewData.message}</p>

                    {previewData.hint && (
                      <p className="text-sm text-red-600 mt-2">{previewData.hint}</p>
                    )}

                    {previewData.blockers?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {previewData.blockers.map((b, i) => (
                          <li key={i} className="text-xs text-red-700 flex gap-2">
                            <span className="text-red-400 flex-shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      type="button"
                      onClick={() => setPreviewData(null)}
                      className="mt-3 text-xs font-medium text-red-800 underline hover:no-underline"
                    >
                      Change the settings and try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {generating && (
              <div className="mb-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex flex-col items-center justify-center">
                  <Loader className="animate-spin text-blue-600" size={40} />
                  <p className="mt-4 text-sm font-medium text-blue-900">
                    Solving the timetable
                    {elapsed > 0 && ` · ${elapsed}s`}
                  </p>
                  <div className="w-full max-w-xs h-1.5 bg-blue-200 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, (elapsed / Math.max(1, formData.timeLimit)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    {isORTools
                      ? `OR-Tools uses up to ${formData.timeLimit}s to search for the best timetable.`
                      : formData.thoroughness === 'thorough'
                        ? `The built-in solver keeps improving the timetable for ${formData.timeLimit}s.`
                        : `The built-in solver usually finishes in a few seconds (at most ${formData.timeLimit}s).`}
                  </p>
                </div>
              </div>
            )}

            {/* How it works. The previous copy advertised "RAG-Powered
                Matching" against a Gemini model; the faculty ranking is in fact
                a deterministic recency-weighted score over teaching history,
                and no language model is involved in generating a timetable. */}
            {!generating && !previewData && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                  <Sparkles size={16} className="mr-2" />
                  How generation works
                </h4>
                <p className="text-xs text-blue-800 mb-2">
                  {isORTools
                    ? 'A constraint solver (Google OR-Tools CP-SAT) places every class at once, searching for the best timetable that breaks none of these rules:'
                    : 'The built-in constraint solver places every class, moving any that clash until none do, then keeps improving the timetable for your chosen priority. It breaks none of these rules:'}
                </p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• One teacher and one room per class, never double-booked</li>
                  <li>• A section is never in two classes at the same time</li>
                  <li>• Teaching load stays within each faculty member's remaining cap</li>
                  <li>• Declared unavailable hours and existing classes are worked around</li>
                  {formData.prepGap > 0 && (
                    <li>
                      • Every teacher gets at least {formData.prepGap} hour
                      {formData.prepGap === 1 ? '' : 's'} between one class and the next
                    </li>
                  )}
                  <li>• Labs only go in lab rooms, and rooms must fit the section</li>
                  <li>• A section with a home room has all its non-lab classes there</li>
                </ul>
                <p className="text-xs text-blue-800 mt-2">
                  Among the timetables that satisfy all of that, it prefers the one matching
                  your chosen priority — scored from each teacher's recency-weighted history
                  with the subject, their specialisations, and how evenly load is spread.
                </p>
                <p className="text-xs font-medium text-blue-900 mt-2">
                  Nothing is saved until you review the preview and approve it.
                </p>
              </div>
            )}

          </div>

          {/* Actions: pinned so they stay reachable however long the preview is */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={generating || saving}
              className="px-4 py-2 border border-gray-300 bg-white rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {previewData?.success && previewData.preview ? 'Cancel' : 'Close'}
            </button>

            {/* Generate, and re-generate once a preview exists */}
            {(!previewData || (previewData.success && !previewData.preview?.schedules?.length)) && (
              <button
                type="submit"
                disabled={generating || !formData.section}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader className="animate-spin mr-2" size={18} />
                    Solving{elapsed > 0 ? ` ${elapsed}s` : ''}...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} className="mr-2" />
                    Generate Preview
                  </>
                )}
              </button>
            )}

            {previewData?.success && previewData.preview?.schedules?.length > 0 && (
              <>
                <button
                  type="submit"
                  disabled={generating || saving}
                  className="flex items-center justify-center px-4 py-2 border border-blue-300 text-blue-700 bg-white rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  {generating ? (
                    <>
                      <Loader className="animate-spin mr-2" size={18} />
                      Solving{elapsed > 0 ? ` ${elapsed}s` : ''}...
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} className="mr-2" />
                      Regenerate
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedules}
                  // A preview that failed the conflict check is not saveable
                  disabled={saving || generating || (stats.conflictsDetected ?? 0) > 0}
                  title={(stats.conflictsDetected ?? 0) > 0 ? 'Resolve the conflicts listed above first' : undefined}
                  className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader className="animate-spin mr-2" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} className="mr-2" />
                      Save {previewData.preview.schedules.length} class
                      {previewData.preview.schedules.length !== 1 ? 'es' : ''}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
    </ModalShell>
  );
};

export default GenerateScheduleModal;
