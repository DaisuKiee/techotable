import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarRange, Plus, Edit2, Trash2, Archive, Clock, CalendarCheck2, CalendarClock, Layers,
  Calendar, AlertTriangle, Info, ChevronDown, ChevronUp, Users, BookOpen, RefreshCw, History,
} from 'lucide-react';
import Layout from '../components/Layout';
import BaseModal from '../components/BaseModal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatCard from '../components/StatCard';
import { termAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLiveRefresh } from '../context/NotificationContext';

const SEMESTERS = [
  { value: 1, label: '1st Semester' },
  { value: 2, label: '2nd Semester' },
  { value: 3, label: 'Summer' },
];
const semLabel = (s) => SEMESTERS.find((x) => x.value === Number(s))?.label || `Semester ${s}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const toInput = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  const whole = Math.floor(months);
  d.setMonth(d.getMonth() + whole);
  d.setDate(d.getDate() + Math.round((months - whole) * 30));
  return toInput(d);
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const STATUS = {
  current: { label: 'Current', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', Icon: CalendarCheck2 },
  upcoming: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', Icon: CalendarClock },
  ended: { label: 'Ended', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', Icon: History },
};

/** The school year to offer: this year - next year, unless it's already set up. */
const suggestYear = (list) => {
  const y = new Date().getFullYear();
  const configured = new Set(list.map((t) => t.academicYear));
  const ay = configured.has(`${y}-${y + 1}`) && !configured.has(`${y + 1}-${y + 2}`) ? `${y + 1}-${y + 2}` : `${y}-${y + 1}`;
  return ay;
};

/** Typical PH calendar for a school year starting in `y`. */
const typicalDates = (academicYear) => {
  const y = parseInt(academicYear, 10);
  return {
    first: { startDate: `${y}-08-11`, endDate: `${y}-12-19` },
    second: { startDate: `${y + 1}-01-12`, endDate: `${y + 1}-05-29` },
    summer: { startDate: '', endDate: '' },
  };
};

const Bone = ({ className = '' }) => <span className={`block rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;

/* ---------------- School year form ---------------- */

const PARTS = [
  { key: 'first', semester: 1, label: '1st Semester', tone: 'border-blue-200 dark:border-blue-800/60' },
  { key: 'second', semester: 2, label: '2nd Semester', tone: 'border-blue-200 dark:border-blue-800/60' },
  { key: 'summer', semester: 3, label: 'Summer (optional)', tone: 'border-orange-200 dark:border-orange-800/60' },
];

// `program`: the program being edited. `canPickAll`: admins / scheduling office
// can apply the dates to every program at once.
const SchoolYearModal = ({ academicYear: initialYear, list, program, canPickAll, onClose, onSaved }) => {
  const [target, setTarget] = useState(program);
  const isEdit = list.some((t) => t.academicYear === initialYear);
  const fromList = (ay) => {
    const base = typicalDates(ay);
    list.filter((t) => t.academicYear === ay).forEach((t) => {
      const key = t.semester === 1 ? 'first' : t.semester === 2 ? 'second' : 'summer';
      base[key] = { startDate: toInput(t.startDate), endDate: toInput(t.endDate), started: !!t.appliedAt };
    });
    return base;
  };
  const [academicYear, setAcademicYear] = useState(initialYear);
  const [dates, setDates] = useState(() => fromList(initialYear));
  const [notes, setNotes] = useState(() => list.find((t) => t.academicYear === initialYear)?.notes || '');
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [0, 1, 2, -1, -2].map((d) => `${now + d}-${now + d + 1}`);
  }, []);

  const changeYear = (ay) => { setAcademicYear(ay); setDates(fromList(ay)); };
  const setPart = (key, field, value) => setDates((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));

  const payload = useMemo(() => ({
    academicYear,
    first: { startDate: dates.first.startDate, endDate: dates.first.endDate },
    second: { startDate: dates.second.startDate, endDate: dates.second.endDate },
    ...(dates.summer.startDate || dates.summer.endDate ? { summer: { startDate: dates.summer.startDate, endDate: dates.summer.endDate } } : {}),
    notes,
    ...(canPickAll && { program: target }),
  }), [academicYear, dates, notes, canPickAll, target]);

  // Check dates and see whether a semester starts right away
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await termAPI.previewSchoolYear(payload);
        setPreview(res.data.data);
        setConfirmed(false);
      } catch (_) { setPreview(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [payload]);

  const effects = preview?.startsNow ? preview.effects : null;
  const needsConfirm = !!effects && (effects.sectionsToMove > 0 || effects.schedulesToArchive > 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (preview?.invalid) { setError(preview.invalid); return; }
    if (needsConfirm && !confirmed) { setError('Tick the box to confirm starting the semester now.'); return; }
    setSaving(true);
    try {
      const res = await termAPI.saveSchoolYear(payload);
      const a = res.data.applied;
      toast.success(a && !a.calendarOnly
        ? `${res.data.message} ${a.sectionsMoved} section${a.sectionsMoved === 1 ? '' : 's'} moved, ${a.schedulesArchived} schedule${a.schedulesArchived === 1 ? '' : 's'} archived.`
        : res.data.message);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the school year'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
  const statusOf = (semester) => preview?.semesters?.find((x) => x.semester === semester);

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={`${isEdit ? `School year ${initialYear}` : 'Set up a school year'} · ${target === 'ALL' ? 'All programs' : program}`}
      subtitle="Set when each semester starts and ends"
      icon={CalendarRange}
      size="large"
      formId="school-year-form"
      loading={saving}
      submitText={needsConfirm ? 'Save and start semester' : 'Save school year'}
    >
      <form id="school-year-form" onSubmit={submit} className="space-y-5 p-5 sm:p-6">
        {(error || preview?.invalid) && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error || preview.invalid}
          </p>
        )}

        {canPickAll && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Apply to">
            {[[program, `${program} only`], ['ALL', 'All programs']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={target === value}
                onClick={() => setTarget(value)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${target === value ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}
              >
                {label}
              </button>
            ))}
            {target === 'ALL' && <span className="self-center text-xs text-orange-700 dark:text-orange-300">These dates will be set for every program.</span>}
          </div>
        )}
        <div className="max-w-xs">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">School year</label>
          <select value={academicYear} onChange={(e) => changeYear(e.target.value)} disabled={isEdit} className={`${input} disabled:bg-gray-100 dark:disabled:bg-gray-600`}>
            {[...new Set([academicYear, ...years])].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PARTS.map((part) => {
            const d = dates[part.key];
            const days = d.startDate && d.endDate ? daysBetween(d.startDate, d.endDate) : 0;
            const months = Math.round((days / 30.44) * 10) / 10;
            const st = statusOf(part.semester);
            return (
              <fieldset key={part.key} className={`rounded-xl border-2 p-4 ${part.tone}`}>
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">{part.label}</legend>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Starts</label>
                    <input type="date" value={d.startDate} onChange={(e) => setPart(part.key, 'startDate', e.target.value)} className={input} required={part.key !== 'summer'} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Ends</label>
                    <input type="date" value={d.endDate} min={d.startDate} onChange={(e) => setPart(part.key, 'endDate', e.target.value)} className={input} required={part.key !== 'summer'} />
                  </div>
                  {d.startDate && (
                    <div className="flex flex-wrap gap-1">
                      {(part.key === 'summer' ? [1.5, 2] : [4, 4.5, 5]).map((m) => (
                        <button key={m} type="button" onClick={() => setPart(part.key, 'endDate', addMonths(d.startDate, m))} className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-blue-900/30">
                          {m} mo
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {days > 0 ? `${months} months · ${days} days` : part.key === 'summer' ? 'Leave empty if there is no summer term' : ' '}
                  </p>
                  {st && (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[st.status].cls}`}>
                      {st.status === 'current' ? `Running now · ${st.daysLeft} days left` : st.status === 'upcoming' ? `Starts in ${st.daysUntilStart} days` : 'Ended'}
                    </span>
                  )}
                  {d.started && <p className="text-[11px] text-gray-500 dark:text-gray-400">Already started: only its dates can change.</p>}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. Enrollment Aug 4-8; midterms Oct 6-10" className={`${input} resize-y`} />
        </div>

        {preview?.startsNow && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-100">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {preview.startsNow.label} covers today, so saving starts it now</p>
            {effects && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li><strong>{effects.sectionsToMove}</strong> section{effects.sectionsToMove === 1 ? '' : 's'}{effects.programs?.length > 1 ? ` across ${effects.programs.length} programs` : ''} move into it (a copy of each, with its students, is kept in the Archive)</li>
                <li><strong>{effects.schedulesToArchive}</strong> schedule{effects.schedulesToArchive === 1 ? '' : 's'} from earlier terms are archived and leave live timetables</li>
                <li>Students move with their sections; then generate the new semester’s timetables</li>
              </ul>
            )}
            {needsConfirm && (
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-orange-400 text-orange-600" />
                <span>I understand and want to start it now.</span>
              </label>
            )}
          </div>
        )}
        {preview && !preview.startsNow && !preview.invalid && (
          <p className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-100">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Each semester starts on its own date: sections move in automatically and the previous semester goes to the Archive.
          </p>
        )}
      </form>
    </BaseModal>
  );
};

/* ---------------- Archive ---------------- */

const ArchiveTab = ({ program }) => {
  const [termsList, setTermsList] = useState(null);
  const [selected, setSelected] = useState('');
  const [sections, setSections] = useState(null);
  const [open, setOpen] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    termAPI.archiveTerms({ program })
      .then((res) => {
        const list = res.data.data || [];
        setTermsList(list);
        if (list.length) setSelected(`${list[0].academicYear}|${list[0].semester}`);
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load the archive')));
  }, [program]);

  useEffect(() => {
    if (!selected) return;
    const [academicYear, semester] = selected.split('|');
    setSections(null);
    termAPI.archive({ academicYear, semester, program })
      .then((res) => setSections(res.data.data || []))
      .catch((err) => setError(getErrorMessage(err, 'Could not load archived sections')));
  }, [selected, program]);

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">{error}</p>;
  if (!termsList) return <div className="space-y-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-16 w-full rounded-xl" />)}</div>;
  if (!termsList.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white py-14 text-center dark:border-gray-600 dark:bg-gray-800">
        <Archive className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-3 font-semibold text-gray-900 dark:text-white">Nothing archived yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-400">
          When a new term starts, each section’s previous term (its students and classes) is saved here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="archive-term" className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
        <select id="archive-term" value={selected} onChange={(e) => setSelected(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          {termsList.map((t) => (
            <option key={`${t.academicYear}|${t.semester}`} value={`${t.academicYear}|${t.semester}`}>
              {t.label} · {t.sections} section{t.sections === 1 ? '' : 's'}, {t.classes} class{t.classes === 1 ? '' : 'es'}
            </option>
          ))}
        </select>
      </div>

      {!sections ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No sections were archived for this term.</p>
      ) : (
        <div className="space-y-3">
          {sections.map((s) => {
            const isOpen = !!open[s._id];
            return (
              <div key={s._id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [s._id]: !o[s._id] }))}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"><Layers className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-900 dark:text-white">{s.sectionCode}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {[s.program, s.yearLevel && `Year ${s.yearLevel}`, s.shift, s.adviserName && `Adviser: ${s.adviserName}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="hidden text-right text-xs text-gray-600 dark:text-gray-300 sm:block">
                    <span className="block"><Users className="mr-1 inline h-3.5 w-3.5" />{s.studentCount ?? '—'} students</span>
                    <span className="block"><BookOpen className="mr-1 inline h-3.5 w-3.5" />{s.classes.length} classes</span>
                  </span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="grid gap-4 border-t border-gray-200 p-4 dark:border-gray-700 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Classes</p>
                      {s.classes.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No classes recorded.</p> : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                <th className="py-1.5 pr-3 font-medium">Subject</th>
                                <th className="py-1.5 pr-3 font-medium">Instructor</th>
                                <th className="py-1.5 pr-3 font-medium">Room</th>
                                <th className="py-1.5 font-medium">Meetings</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                              {s.classes.map((c) => (
                                <tr key={c._id} className="text-gray-800 dark:text-gray-200">
                                  <td className="py-1.5 pr-3"><span className="font-medium">{c.subjectCode}</span> <span className="text-xs text-gray-500 dark:text-gray-400">{c.subjectName}</span></td>
                                  <td className="py-1.5 pr-3">{c.faculty || '—'}</td>
                                  <td className="py-1.5 pr-3">{c.room || '—'}</td>
                                  <td className="py-1.5 text-xs">{c.timeSlots.map((t) => `${t.day.slice(0, 3)} ${t.startTime}-${t.endTime}`).join(', ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Students ({s.students?.length || 0})</p>
                      {s.students?.length ? (
                        <ul className="max-h-56 space-y-1 overflow-y-auto text-sm text-gray-800 dark:text-gray-200">
                          {s.students.map((st) => <li key={st.studentId}>{st.name} <span className="text-xs text-gray-500 dark:text-gray-400">{st.studentId}</span></li>)}
                        </ul>
                      ) : <p className="text-sm text-gray-500 dark:text-gray-400">No students were placed.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------- Page ---------------- */

const SemesterPage = () => {
  const { user } = useAuth();
  const canManage = ['admin', 'scheduling_officer', 'program_manager'].includes(user?.role);
  // Each program has its own semesters. Managers are fixed to theirs; the
  // scheduling office picks which program to look at.
  const isManager = user?.role === 'program_manager';
  const [programs, setPrograms] = useState(isManager && user?.program ? [user.program] : []);
  const [program, setProgram] = useState(() => (isManager ? user?.program || '' : (() => {
    try { return localStorage.getItem('semesters.program') || ''; } catch (_) { return ''; }
  })()));
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'archive' ? 'archive' : 'terms';
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await termAPI.list(program ? { program } : {});
      setPrograms(res.data.programs || []);
      // The server picks the first program when none is chosen yet
      if (!program && res.data.program) { firstLoad.current = true; setProgram(res.data.program); }
      setList(res.data.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load terms'));
    }
  }, [program]);

  // Skip the reload right after the server chose the program (already loaded)
  const firstLoad = useRef(false);
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    setList(null);
    load();
  }, [load]);
  useEffect(() => {
    if (!isManager && program) { try { localStorage.setItem('semesters.program', program); } catch (_) { /* ignore */ } }
  }, [program, isManager]);
  useLiveRefresh(['term'], load);

  const current = list?.find((t) => t.status === 'current');
  const upcoming = list?.filter((t) => t.status === 'upcoming').sort((a, b) => new Date(a.startDate) - new Date(b.startDate)) || [];
  const next = upcoming[0];

  const askDelete = (t) => setConfirm({
    title: 'Delete term',
    message: `Delete ${t.label}? Only terms that haven't started and have no schedules can be deleted.`,
    itemName: `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`,
    onConfirm: async () => {
      try {
        await termAPI.delete(t._id);
        toast.success('Term deleted');
        load();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Could not delete the term'));
      }
    },
  });

  return (
    <Layout>
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Semesters{program ? ` · ${program}` : ''}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {isManager
                ? `When ${program}'s semesters start and end. Your sections follow the current semester automatically; finished ones move to the Archive.`
                : 'Each program has its own semesters. Its sections follow its current semester automatically; finished ones move to the Archive.'}
            </p>
            {!isManager && programs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Program">
                {programs.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={program === p}
                    onClick={() => setProgram(p)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${program === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {canManage && tab === 'terms' && (
            <button
              type="button"
              onClick={() => setModal({ academicYear: suggestYear(list || []) })}
              disabled={!list}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Set up school year
            </button>
          )}
        </div>

        <div className="mb-5 flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
          {[['terms', 'Terms', CalendarRange], ['archive', 'Archive', Archive]].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setParams(id === 'archive' ? { tab: 'archive' } : {})}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${
                tab === id ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === 'archive' ? <ArchiveTab program={program} /> : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-900/20">
            <p className="font-semibold text-red-900 dark:text-red-200">{error}</p>
            <button type="button" onClick={load} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white"><RefreshCw className="h-4 w-4" /> Try again</button>
          </div>
        ) : !list ? (
          <div className="space-y-4"><Bone className="h-40 w-full rounded-2xl" /><Bone className="h-20 w-full rounded-xl" /><Bone className="h-20 w-full rounded-xl" /></div>
        ) : (
          <div className="space-y-6">
            {/* Current term */}
            {current ? (
              <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-800/60 dark:bg-gray-800 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Current term</p>
                    <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{current.label}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{fmtDate(current.startDate)} – {fmtDate(current.endDate)} · {current.months} months</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{current.daysLeft}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">days left</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${current.progress}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Day {current.elapsedDays} of {current.totalDays} · {current.progress}% through</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard icon={Layers} label="Sections" value={current.counts.sections} hint="in this term" tone="indigo" />
                  <StatCard icon={Calendar} label="Schedules" value={current.counts.schedules} hint="live classes" tone="blue" />
                  <StatCard icon={Archive} label="Archived" value={current.counts.archivedSections} hint="section records" tone="gray" />
                  <StatCard icon={Clock} label="Next term" value={next ? `${next.daysUntilStart}d` : '—'} hint={next ? `${next.label.split(' · ')[0]} starts` : 'not set yet'} tone="violet" />
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-800/60 dark:bg-orange-900/20 sm:p-6">
                <p className="flex items-center gap-2 font-semibold text-orange-900 dark:text-orange-100"><AlertTriangle className="h-5 w-5" /> The semesters aren’t set up yet</p>
                <p className="mt-1 text-sm text-orange-900/90 dark:text-orange-100/90">
                  Set when the 1st and 2nd semesters of the school year start and end. The semester covering today becomes the current term, and each one after it starts on its own date.
                </p>
                {canManage && (
                  <button type="button" onClick={() => setModal({ academicYear: suggestYear(list) })} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
                    <Plus className="h-4 w-4" /> Set up school year {suggestYear(list)}
                  </button>
                )}
              </section>
            )}

            {/* School years */}
            <section>
              <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">School years</h2>
              {list.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No school years set up yet.</p>
              ) : (
                <div className="space-y-4">
                  {[...new Set(list.map((t) => t.academicYear))].sort().reverse().map((ay) => {
                    const yearTerms = list.filter((t) => t.academicYear === ay).sort((x, y) => x.semester - y.semester);
                    const hasCurrent = yearTerms.some((t) => t.status === 'current');
                    return (
                      <div key={ay} className={`rounded-xl border bg-white shadow-sm dark:bg-gray-800 ${hasCurrent ? 'border-emerald-300 dark:border-emerald-700' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                          <p className="font-semibold text-gray-900 dark:text-white">School year {ay}</p>
                          {canManage && (
                            <button type="button" onClick={() => setModal({ academicYear: ay })} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">
                              <Edit2 className="h-4 w-4" /> Edit dates
                            </button>
                          )}
                        </div>
                        <ol className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {yearTerms.map((t) => {
                            const st = STATUS[t.status];
                            return (
                              <li key={t._id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${st.cls}`}><st.Icon className="h-4 w-4" /></span>
                                <div className="min-w-0 flex-1">
                                  <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-white">
                                    {semLabel(t.semester)}
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {t.months} months
                                    {t.status === 'upcoming' && ` · starts in ${t.daysUntilStart} day${t.daysUntilStart === 1 ? '' : 's'}`}
                                    {t.status === 'current' && ` · ${t.daysLeft} days left`}
                                  </p>
                                </div>
                                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-300">
                                  <span><strong className="text-gray-900 dark:text-white">{t.counts.sections + t.counts.archivedSections}</strong> sections</span>
                                  <span><strong className="text-gray-900 dark:text-white">{t.counts.schedules + t.counts.archivedSchedules}</strong> classes</span>
                                </div>
                                <div className="flex gap-1">
                                  {t.status === 'ended' && (t.counts.archivedSections > 0 || t.counts.archivedSchedules > 0) && (
                                    <button type="button" onClick={() => setParams({ tab: 'archive' })} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="View archive" aria-label={`View archive for ${t.label}`}>
                                      <Archive className="h-4 w-4" />
                                    </button>
                                  )}
                                  {canManage && !t.appliedAt && (
                                    <button type="button" onClick={() => askDelete(t)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30" title="Delete" aria-label={`Delete ${t.label}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                        {yearTerms[0]?.notes && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">{yearTerms[0].notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                The scheduling office sets each semester’s dates; a semester usually runs 4-5 months. On a semester’s start date its sections move in automatically and the previous one is archived.
              </p>
            </section>
          </div>
        )}
      </div>

      {modal && (
        <SchoolYearModal
          academicYear={modal.academicYear}
          list={list || []}
          program={program}
          canPickAll={!isManager}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        itemName={confirm?.itemName}
        confirmText="Delete term"
      />
    </Layout>
  );
};

export default SemesterPage;
