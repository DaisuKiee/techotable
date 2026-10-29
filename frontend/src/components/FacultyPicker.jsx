import React, { useState, useEffect, useMemo } from 'react';
import { aiChatAPI } from '../services/api';
import { User, AlertCircle, Sparkles, Star, Loader, Info, Search, Check } from 'lucide-react';

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
    ? { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30' }
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

  // Ranked + filtered faculty
  const sortedFaculty = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(faculty || [])]
      .filter((f) => f.isActive && f.user)
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
  }, [faculty, facultyScores, query]);

  return (
    <Section
      icon={User}
      title="Faculty"
      hint={hint}
      aside={
        loadingScores ? (
          <span className="flex items-center gap-1 text-xs text-purple-600">
            <Loader className="h-3 w-3 animate-spin" /> Ranking…
          </span>
        ) : (
          <Tip
            text="Ranked by how often they taught this subject, then specialization, workload and qualifications."
            side="bottom"
            align="end"
          >
            <button type="button" aria-label="How ranking works" className="rounded-full p-1 text-gray-400 hover:text-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
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
          const score = facultyScores[String(fac._id)];
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
                    {topPick && (
                      <Tip text={`Top ${score.rank} recommendation for this subject`} className="flex-shrink-0">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
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

      {requiredWarning && (
        <p className="mt-3 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" /> Select a faculty member
        </p>
      )}
      {rankingNote && !loadingScores && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
          <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{rankingNote}</span>
        </p>
      )}
    </Section>
  );
};

export default FacultyPicker;
