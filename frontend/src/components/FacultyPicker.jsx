import React, { useState, useEffect, useMemo } from 'react';
import { aiChatAPI, subjectAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import { User, AlertCircle, Sparkles, Star, Loader, Info, Search, Check, ArrowLeftRight, X } from 'lucide-react';

/* ───────────────────────── shared presentational bits ─────────────────────────
 * Tip and Section live here rather than in EditScheduleModal because the picker
 * and the modal both draw them, and a second copy would drift.
 */

/**
 * Pure CSS tooltip, works on hover and keyboard focus. Wrap any element.
 * side: 'top' | 'bottom'   align: 'center' | 'start' | 'end'
 */
export const Tip = ({ text, children, side = 'top', align = 'center', className = '' }) => {
  if (!text) return children;
  const vertical = side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const horizontal =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <span className={`relative inline-flex group/tip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${vertical} ${horizontal} z-50 w-max max-w-[240px]
          rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-xl
          opacity-0 transition-opacity duration-150
          group-hover/tip:opacity-100 group-focus-within/tip:opacity-100`}
      >
        {text}
      </span>
    </span>
  );
};

export const Section = ({ icon: Icon, title, hint, aside, children }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
      </div>
      {aside}
    </header>
    {children}
  </section>
);

const initials = (u) =>
  `${u?.firstName?.[0] || ''}${u?.lastName?.[0] || ''}`.toUpperCase() || '?';

const matchTone = (pct) =>
  pct >= 70
    ? { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30' }
    : pct >= 40
    ? { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-900/30' }
    : { bar: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700' };

/* ───────────────────────── faculty picker ───────────────────────── */

/**
 * Searchable faculty list ranked by experience with a given subject.
 *
 * Owns its own ranking fetch, so it is only paid for when the picker is
 * actually on screen - mounting one per subject card up front would fire a
 * recommendation request for every subject in the sidebar.
 *
 * @param {object[]} faculty           all faculty to choose from
 * @param {string}   selectedFacultyId currently chosen faculty id, if any
 * @param {function} onSelect          called with the chosen faculty id
 * @param {string}   subjectId|subjectCode|subjectName  what to rank against
 * @param {string}   hint              sub-title under "Faculty"
 * @param {boolean}  requiredWarning   show the red "Select a faculty member" line
 */
const FacultyPicker = ({
  faculty,
  selectedFacultyId,
  onSelect,
  subjectId,
  subjectCode,
  subjectName,
  hint,
  requiredWarning = false,
}) => {
  const [facultyScores, setFacultyScores] = useState({});
  const [loadingScores, setLoadingScores] = useState(false);
  const [rankingNote, setRankingNote] = useState(null);
  const [query, setQuery] = useState('');
  // Other departments: who has taught this subject, and who is approved for it
  const [subjectProgram, setSubjectProgram] = useState('');
  const [otherScores, setOtherScores] = useState({});
  const [approvedIds, setApprovedIds] = useState(() => new Set());
  const [approving, setApproving] = useState(null);

  // Fetch experience ranking for this subject
  useEffect(() => {
    if (!subjectId && !subjectCode && !subjectName) return;
    let cancelled = false;

    (async () => {
      setLoadingScores(true);
      try {
        const { data } = await aiChatAPI.recommendFaculty({ subjectId, subjectCode, subjectName });
        if (cancelled) return;

        const scores = {};
        (data?.recommendations || []).forEach((rec) => {
          if (!rec?.facultyId) return;
          scores[String(rec.facultyId)] = {
            percentage: Math.round(rec.score), // already out of 100
            timesTaught: rec.timesTaught || 0,
            lastTaught: rec.lastTaughtAcademicYear || null,
            isStale: !!rec.experienceIsDated,
            reason: rec.reason || '',
            rank: rec.rank,
          };
        });
        setFacultyScores(scores);
        setRankingNote(data?.message || null);
        setSubjectProgram(data?.subject?.program || '');
        const others = {};
        (data?.otherDepartments || []).forEach((rec) => {
          others[String(rec.facultyId)] = {
            percentage: Math.round(rec.score),
            timesTaught: rec.timesTaught || 0,
            lastTaught: rec.lastTaughtAcademicYear || null,
            isStale: !!rec.experienceIsDated,
            reason: rec.reason || '',
            rank: rec.rank,
            department: rec.department || '',
          };
        });
        setOtherScores(others);
        setApprovedIds(new Set((data?.guestFacultyIds || []).map(String)));
      } catch (error) {
        console.error('Faculty recommendation failed:', error);
        if (cancelled) return;
        setFacultyScores({});
        setRankingNote(error.response?.data?.message || 'Could not load the experience ranking.');
      } finally {
        if (!cancelled) setLoadingScores(false);
      }
    })();

    return () => { cancelled = true; };
  }, [subjectId, subjectCode, subjectName]);

  // Teaches in this subject's department? (no program set = can teach anywhere)
  const inDepartment = (f) => !subjectProgram
    || !(f.programs || []).length
    || (f.programs || []).includes(subjectProgram)
    || (f.teachingHistory || []).some((h) => h.program === subjectProgram);
  const departmentOf = (f) => otherScores[String(f._id)]?.department || f.department || (f.programs || [])[0] || 'another department';

  /** Approve (or withdraw) a teacher from another department for this subject only. */
  const toggleApproval = async (fac) => {
    const id = String(fac._id);
    if (!subjectId) return;
    setApproving(id);
    try {
      const res = approvedIds.has(id)
        ? await subjectAPI.removeGuestFaculty(subjectId, id)
        : await subjectAPI.addGuestFaculty(subjectId, id);
      setApprovedIds(new Set((res.data.data?.guestFaculty || []).map(String)));
      toast.success(res.data.message);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update the approval'));
    } finally {
      setApproving(null);
    }
  };

  // Ranked + filtered faculty
  const sortedFaculty = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(faculty || [])]
      .filter((f) => f.isActive && f.user)
      // This department, plus teachers borrowed (approved) for this subject
      .filter((f) => inDepartment(f) || approvedIds.has(String(f._id)))
      .filter((f) => {
        if (!q) return true;
        const hay = `${f.user.firstName} ${f.user.lastName} ${f.employeeId || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const A = facultyScores[String(a._id)];
        const B = facultyScores[String(b._id)];
        if (A && B) return A.rank - B.rank;
        if (A) return -1;
        if (B) return 1;
        return `${a.user.lastName || ''} ${a.user.firstName || ''}`.localeCompare(
          `${b.user.lastName || ''} ${b.user.firstName || ''}`
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculty, facultyScores, query, subjectProgram, approvedIds]);

  // Other departments: those who have taught this subject, or anyone matching a search
  const otherFaculty = useMemo(() => {
    if (!subjectProgram) return [];
    const q = query.trim().toLowerCase();
    return (faculty || [])
      .filter((f) => f.isActive && f.user && !inDepartment(f) && !approvedIds.has(String(f._id)))
      .filter((f) => (q
        ? `${f.user.firstName} ${f.user.lastName} ${f.employeeId || ''}`.toLowerCase().includes(q)
        : !!otherScores[String(f._id)]))
      .sort((a, b) => (otherScores[String(a._id)]?.rank || 99) - (otherScores[String(b._id)]?.rank || 99))
      .slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculty, otherScores, query, subjectProgram, approvedIds]);

  return (
    <Section
      icon={User}
      title="Faculty"
      hint={hint}
      aside={
        loadingScores ? (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <Loader className="h-3 w-3 animate-spin" /> Ranking…
          </span>
        ) : (
          <Tip
            text="Ranked by how often they taught this subject, then specialization, workload and qualifications."
            side="bottom"
            align="end"
          >
            <button type="button" aria-label="How ranking works" className="rounded-full p-1 text-gray-400 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Info className="h-4 w-4" />
            </button>
          </Tip>
        )
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or employee ID"
          data-modal-ignore-dirty
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <ul role="listbox" aria-label="Faculty" className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {sortedFaculty.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No faculty match “{query}”.
          </li>
        )}
        {sortedFaculty.map((fac) => {
          const borrowed = !inDepartment(fac) && approvedIds.has(String(fac._id));
          const score = facultyScores[String(fac._id)] || otherScores[String(fac._id)];
          const taught = score?.timesTaught || 0;
          const selected = String(fac._id) === String(selectedFacultyId);
          const topPick = taught > 0 && score.rank <= 3;
          const tone = score ? matchTone(score.percentage) : null;

          return (
            <li key={fac._id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(fac._id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40'
                }`}
              >
                <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  selected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                }`}>
                  {selected ? <Check className="h-4 w-4" /> : initials(fac.user)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {fac.user.firstName} {fac.user.lastName}
                    </span>
                    {topPick && !borrowed && (
                      <Tip text={`Top ${score.rank} recommendation for this subject`} className="flex-shrink-0">
                        <Star className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                      </Tip>
                    )}
                    {borrowed && (
                      <Tip text={`From ${departmentOf(fac)}, approved to teach ${subjectCode || 'this subject'} only`} className="flex-shrink-0">
                        <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          <ArrowLeftRight className="h-2.5 w-2.5" /> {departmentOf(fac)}
                        </span>
                      </Tip>
                    )}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {fac.employeeId ? `${fac.employeeId} · ` : ''}
                    {taught > 0
                      ? `Taught ${taught}×${score.lastTaught ? `, last ${score.lastTaught}` : ''}${score.isStale ? ' (dated)' : ''}`
                      : 'No history with this subject'}
                  </span>
                </span>

                {score && (
                  <Tip text={score.reason || `${score.percentage}% match`} align="end" className="flex-shrink-0">
                    <span className={`flex w-16 flex-col items-end gap-1 rounded-md px-2 py-1 ${tone.bg}`}>
                      <span className={`text-xs font-semibold ${tone.text}`}>{score.percentage}%</span>
                      <span className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, score.percentage)}%` }} />
                      </span>
                    </span>
                  </Tip>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Borrow a teacher from another department for this subject */}
      {subjectProgram && (otherFaculty.length > 0 || [...approvedIds].length > 0) && (
        <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-white">
            <ArrowLeftRight className="h-3.5 w-3.5 text-blue-600" /> From other departments
          </p>
          <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
            Teachers outside {subjectProgram} who have taught {subjectCode || 'this subject'}. Approve one to let the generator
            and B-LO use them for {subjectCode || 'this subject'} only; their own department&apos;s load still counts.
          </p>
          {otherFaculty.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">No one else outside {subjectProgram} has taught it. Search by name to find someone.</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {otherFaculty.map((fac) => {
                const id = String(fac._id);
                const sc = otherScores[id];
                const selected = id === String(selectedFacultyId);
                return (
                  <li key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${selected ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <button type="button" onClick={() => onSelect(fac._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {selected ? <Check className="h-4 w-4" /> : initials(fac.user)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{fac.user.firstName} {fac.user.lastName}</span>
                        <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                          {departmentOf(fac)} · {sc?.timesTaught ? `taught it ${sc.timesTaught}×${sc.lastTaught ? `, last ${sc.lastTaught}` : ''}` : 'no history with this subject'}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleApproval(fac)}
                      disabled={!subjectId || approving === id}
                      title={`Allow ${fac.user.firstName} to be scheduled for ${subjectCode || 'this subject'} only`}
                      className="flex-shrink-0 rounded-md border border-blue-300 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
                    >
                      {approving === id ? <Loader className="h-3 w-3 animate-spin" /> : 'Approve'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {[...approvedIds].length > 0 && (
            <ul className="mt-2 space-y-1">
              {(faculty || []).filter((f) => approvedIds.has(String(f._id)) && !inDepartment(f) && f.user).map((fac) => (
                <li key={fac._id} className="flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  <Check className="h-3 w-3 flex-shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{fac.user.firstName} {fac.user.lastName} ({departmentOf(fac)}) is approved for {subjectCode || 'this subject'}</span>
                  <button type="button" onClick={() => toggleApproval(fac)} disabled={approving === String(fac._id)} title="Withdraw the approval" className="rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {requiredWarning && (
        <p className="mt-3 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" /> Select a faculty member
        </p>
      )}
      {rankingNote && !loadingScores && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{rankingNote}</span>
        </p>
      )}
    </Section>
  );
};

export default FacultyPicker;
