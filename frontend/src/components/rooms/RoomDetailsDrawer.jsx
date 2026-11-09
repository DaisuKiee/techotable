import { useCallback, useEffect, useState } from 'react';
import {
  X, Pencil, Copy, Ban, RotateCcw, Building, Layers, Clock, CalendarX, Home, AlertTriangle, Wrench, Loader2, StickyNote,
} from 'lucide-react';
import { roomAPI, getErrorMessage } from '../../services/api';
import { ModalShell } from '../modal/ModalShell';
import { DAYS, typeMeta, toMin, fmtTime, fmtRange, usageTone } from './roomMeta';

const GRID_START = 7 * 60;
const GRID_END = 22 * 60;
const STEP = 30;
const ROW_PX = 20;
const ROWS = (GRID_END - GRID_START) / STEP;

/** Place a {day, startTime, endTime} block on the half-hour grid, clamped to 7 AM-10 PM. */
const place = (day, start, end) => {
  const col = DAYS.indexOf(day);
  if (col < 0) return null;
  const s = Math.max(GRID_START, toMin(start));
  const e = Math.min(GRID_END, toMin(end));
  if (e <= s) return null;
  return {
    gridColumn: col + 2,
    gridRow: `${Math.floor((s - GRID_START) / STEP) + 2} / span ${Math.max(1, Math.ceil((e - s) / STEP))}`,
  };
};

/** Mon-Sat x 7 AM-10 PM: classes in indigo, blocked times hatched amber, lunch shaded. */
export const RoomWeekGrid = ({ classes = [], blocked = [] }) => {
  const lunchRow = (12 * 60 - GRID_START) / STEP + 2;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <div
        className="relative grid min-w-[640px] bg-white text-xs dark:bg-gray-800"
        style={{ gridTemplateColumns: '52px repeat(6, minmax(0, 1fr))', gridTemplateRows: `28px repeat(${ROWS}, ${ROW_PX}px)` }}
      >
        <div className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900" />
        {DAYS.map((d, i) => (
          <div key={d} className="flex items-center justify-center border-b border-l border-gray-200 bg-gray-50 font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300" style={{ gridColumn: i + 2, gridRow: 1 }}>
            {d.slice(0, 3)}
          </div>
        ))}

        {/* Hour lines and labels */}
        {Array.from({ length: ROWS / 2 }, (_, h) => (
          <div key={h} className="contents">
            <div className="sticky left-0 z-10 -mt-1.5 bg-white pr-1.5 text-right text-[10px] text-gray-400 dark:bg-gray-800" style={{ gridColumn: 1, gridRow: `${h * 2 + 2} / span 2` }}>
              {fmtTime(`${String(7 + h).padStart(2, '0')}:00`).replace(':00', '')}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700/60" style={{ gridColumn: '2 / span 6', gridRow: `${h * 2 + 2} / span 2` }} />
          </div>
        ))}
        {DAYS.map((d, i) => (
          <div key={`col-${d}`} className="border-l border-gray-100 dark:border-gray-700/60" style={{ gridColumn: i + 2, gridRow: `2 / span ${ROWS}` }} />
        ))}
        <div className="flex items-center justify-center bg-gray-100/80 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:bg-gray-900/60" style={{ gridColumn: '2 / span 6', gridRow: `${lunchRow} / span 2` }}>
          Lunch break
        </div>

        {blocked.map((b, i) => {
          const pos = place(b.day, b.startTime, b.endTime);
          return pos && (
            <div key={`b${i}`} title={`Blocked ${fmtRange(b.startTime, b.endTime)}${b.reason ? `: ${b.reason}` : ''}`}
              className="z-[1] m-0.5 overflow-hidden rounded border border-orange-300 px-1.5 py-0.5 text-orange-900 dark:border-orange-700 dark:text-orange-200"
              style={{ ...pos, background: 'repeating-linear-gradient(135deg, rgba(251,191,36,.18) 0 6px, rgba(251,191,36,.35) 6px 12px)' }}>
              <div className="truncate font-semibold">Blocked</div>
              {b.reason && <div className="truncate text-[10px]">{b.reason}</div>}
            </div>
          );
        })}

        {classes.flatMap((c) => (c.timeSlots || []).map((slot, i) => {
          const pos = place(slot.day, slot.startTime, slot.endTime);
          if (!pos) return null;
          const tone = c.hidden
            ? 'border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
            : c.overCapacity
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
              : c.isLab
                ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100'
                : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100';
          return (
            <div key={`${c._id}-${i}`} className={`z-[2] m-0.5 overflow-hidden rounded border px-1.5 py-0.5 leading-tight ${tone}`} style={pos}
              title={c.hidden ? `${c.sectionCode}, ${fmtRange(slot.startTime, slot.endTime)}`
                : `${c.subjectCode} ${c.subjectName}\n${c.sectionCode}${c.faculty ? ` · ${c.faculty}` : ''}\n${fmtRange(slot.startTime, slot.endTime)}${c.overCapacity ? `\n${c.maxStudents} students: more than the room seats` : ''}`}>
              <div className="truncate font-semibold">{c.subjectCode}</div>
              <div className="truncate text-[10px] opacity-80">{c.sectionCode}</div>
            </div>
          );
        }))}
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
    <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    {sub && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
  </div>
);

/**
 * Side panel for one room: details, its week for the chosen term, and the
 * edit / duplicate / deactivate actions.
 */
const RoomDetailsDrawer = ({ room, term, canManage, onClose, onEdit, onDuplicate, onDeactivate, onRestore }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    roomAPI.getSchedule(room._id, term ? { academicYear: term.academicYear, semester: term.semester } : undefined)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(getErrorMessage(err, 'Could not load this room’s schedule')));
  }, [room._id, term]);
  useEffect(() => { load(); }, [load]);

  const r = data?.room || room;
  const meta = typeMeta(r.roomType);
  const Icon = meta.icon;
  const usage = data?.usage || room.usage;
  const tone = usageTone(usage?.utilization || 0);
  const ownClasses = (data?.classes || []).filter((c) => !c.hidden);
  const crowded = ownClasses.filter((c) => c.overCapacity);

  return (
    <ModalShell variant="drawer" size="xl" onClose={onClose} label={`Room ${r.roomCode}`} guardDirty={false} focusFirstField={false} panelClassName="bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${meta.tile}`}><Icon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-xl font-bold text-gray-900 dark:text-white">{r.roomCode}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>{r.roomType}</span>
              {r.isActive === false && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">Deactivated</span>}
            </div>
            <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
              {r.roomName ? `${r.roomName} · ` : ''}{r.building}, floor {r.floor || 1}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="Close"><X className="h-5 w-5" /></button>
        </div>
        {canManage && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => onEdit(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"><Pencil className="h-4 w-4" /> Edit</button>
            <button type="button" onClick={() => onDuplicate(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Copy className="h-4 w-4" /> Duplicate</button>
            {r.isActive === false ? (
              <button type="button" onClick={() => onRestore(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"><RotateCcw className="h-4 w-4" /> Restore</button>
            ) : (
              <button type="button" onClick={() => onDeactivate(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"><Ban className="h-4 w-4" /> Deactivate</button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        {r.isActive === false && (
          <div className="flex items-start gap-2 rounded-lg border border-gray-300 bg-gray-100 p-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Ban className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Deactivated{r.deactivatedAt ? ` on ${new Date(r.deactivatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}` : ''}
              {r.deactivationReason ? `: ${r.deactivationReason}` : ''}. New timetables won’t use it{canManage ? '; restore it to put it back into use.' : '.'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Seats" value={r.capacity} sub={usage?.largestClass ? `Largest class ${usage.largestClass}` : 'No classes yet'} />
          <Stat label="Classes" value={usage?.classes ?? '—'} sub={usage?.sections?.length ? `${usage.sections.length} section${usage.sections.length === 1 ? '' : 's'}` : 'This term'} />
          <Stat label="Hours a week" value={usage ? usage.hours : '—'} sub={usage?.busiestDay ? `Busiest: ${usage.busiestDay.day}` : (data ? `of ${data.weekHours} teachable` : '')} />
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">In use</p>
            <p className={`mt-0.5 text-lg font-bold ${tone.text}`}>{usage?.utilization ?? 0}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${usage?.utilization || 0}%` }} /></div>
          </div>
        </div>

        {crowded.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {crowded.length === 1 ? 'One class has' : `${crowded.length} classes have`} more students than the {r.capacity} seats:{' '}
              {crowded.slice(0, 4).map((c) => `${c.sectionCode} ${c.subjectCode} (${c.maxStudents})`).join(', ')}.
              Move {crowded.length === 1 ? 'it' : 'them'} to a bigger room or raise the capacity if it’s wrong.
            </span>
          </div>
        )}

        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Week at a glance</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{data?.term?.label || term?.label || ''}</span>
          </div>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error} <button type="button" onClick={load} className="ml-1 font-semibold underline">Try again</button>
            </div>
          ) : !data ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the week…</div>
          ) : (
            <>
              <RoomWeekGrid classes={data.classes} blocked={r.unavailableTimeSlots} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" /> Lecture</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-blue-300 bg-blue-50" /> Lab session</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-orange-300 bg-orange-100" /> Blocked</span>
                {data.classes.some((c) => c.hidden) && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-gray-300 bg-gray-100" /> Another program’s class</span>}
                {data.classes.length === 0 && <span>No classes in this room this term.</span>}
              </div>
            </>
          )}
        </section>

        {ownClasses.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Classes ({ownClasses.length})</h3>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
              {ownClasses.map((c) => (
                <li key={c._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-semibold text-gray-900 dark:text-white">{c.subjectCode}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-400">{c.subjectName}</span>
                  <span className="text-gray-700 dark:text-gray-300">{c.sectionCode}</span>
                  {c.faculty && <span className="text-xs text-gray-500 dark:text-gray-400">{c.faculty}</span>}
                  <span className={`text-xs ${c.overCapacity ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{c.maxStudents} students</span>
                  <span className="w-full text-xs text-gray-500 dark:text-gray-400">
                    {(c.timeSlots || []).map((s) => `${s.day.slice(0, 3)} ${fmtRange(s.startTime, s.endTime)}`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><CalendarX className="h-4 w-4 text-orange-600" /> Blocked times</h3>
            {(r.unavailableTimeSlots || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Available all week.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {r.unavailableTimeSlots.map((s, i) => (
                  <li key={i} className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{s.day}</span> {fmtRange(s.startTime, s.endTime)}
                    {s.reason && <span className="text-gray-500 dark:text-gray-400"> · {s.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Home className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Home room of</h3>
            {(data?.homeSections || []).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No section uses it as a home room. A section’s home room holds all of its classes; set one on the Sections page.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.homeSections.map((s) => (
                  <span key={s._id} className={`rounded-md px-2 py-1 text-xs font-medium ${s.maxStudents > r.capacity ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}
                    title={s.maxStudents > r.capacity ? `Up to ${s.maxStudents} students: more than the room seats` : `Up to ${s.maxStudents} students`}>
                    {s.sectionCode}
                  </span>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Features</h3>
            {(r.facilities || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">None listed.</p> : (
              <div className="flex flex-wrap gap-1.5">{r.facilities.map((f) => <span key={f} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">{f}</span>)}</div>
            )}
          </section>
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Equipment</h3>
            {(r.equipment || []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">None listed.</p> : (
              <ul className="space-y-1 text-sm">
                {r.equipment.map((eq, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-gray-700 dark:text-gray-300">
                    <span>{eq.quantity} × {eq.name}</span>
                    <span className={`text-xs ${['Poor', 'Broken'].includes(eq.condition) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{eq.condition}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {r.notes && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><StickyNote className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Notes</h3>
            <p className="whitespace-pre-line">{r.notes}</p>
          </section>
        )}

        <p className="flex items-center gap-1.5 text-xs text-gray-400"><Building className="h-3.5 w-3.5" /> Updated {new Date(r.updatedAt || Date.now()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>
    </ModalShell>
  );
};

/**
 * Deactivate (or, for a room no class ever used, delete) with the impact
 * spelled out first.
 */
export const DeactivateRoomDialog = ({ room, onClose, onDone }) => {
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    roomAPI.getImpact(room._id)
      .then((res) => setImpact(res.data.data))
      .catch((err) => setError(getErrorMessage(err, 'Could not check what uses this room')));
  }, [room._id]);

  const inUse = impact && (impact.classes > 0 || impact.homeSections.length > 0);

  const act = async (kind) => {
    setBusy(kind);
    setError('');
    try {
      const res = kind === 'delete'
        ? await roomAPI.delete(room._id, { permanent: true })
        : await roomAPI.delete(room._id, { force: inUse ? true : undefined, reason: reason.trim() || undefined });
      onDone(res.data?.message, kind);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the room'));
      setBusy('');
    }
  };

  return (
    <ModalShell size="sm" onClose={busy ? undefined : onClose} label={`Deactivate ${room.roomCode}`} busy={!!busy} guardDirty={false}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"><Ban className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deactivate {room.roomCode}?</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">New timetables and room pickers stop offering it. Past timetables keep it, and you can restore it any time.</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900/40">
          {!impact && !error && <span className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking what uses this room…</span>}
          {impact && !inUse && <span className="text-emerald-700 dark:text-emerald-400">No active classes or sections use this room.</span>}
          {impact && inUse && (
            <div className="space-y-1.5 text-orange-900 dark:text-orange-200">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Still in use</p>
              {impact.terms.map((t) => <p key={t.label}>{t.classes} class{t.classes === 1 ? '' : 'es'} in {t.label}</p>)}
              {impact.homeSections.length > 0 && <p>Home room of {impact.homeSections.slice(0, 6).join(', ')}{impact.homeSections.length > 6 ? '…' : ''}. They’ll each be moved to another free room.</p>}
              {impact.classes > 0 && <p className="text-xs text-orange-800/80 dark:text-orange-300/80">Booked classes keep this room until you move them. Editing one will ask for a different room.</p>}
            </div>
          )}
        </div>

        <label htmlFor="deactivate-reason" className="mt-4 block text-xs font-semibold text-gray-700 dark:text-gray-300">Reason (optional)</label>
        <input id="deactivate-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Under renovation until March"
          className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />

        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {impact?.canDeletePermanently && (
            <button type="button" onClick={() => act('delete')} disabled={!!busy} className="mr-auto text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400" title="No class has ever used this room, so it can be removed completely">
              {busy === 'delete' ? 'Deleting…' : 'Delete permanently'}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={!!busy} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
          <button type="button" onClick={() => act('deactivate')} disabled={!impact || !!busy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy === 'deactivate' && <Loader2 className="h-4 w-4 animate-spin" />}
            {inUse ? 'Deactivate anyway' : 'Deactivate'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default RoomDetailsDrawer;
