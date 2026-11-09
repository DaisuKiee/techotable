import React, { useState, useMemo, useEffect } from 'react';
import Layout from '../components/Layout';
import { subjectAPI, getErrorMessage } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import {
  Plus, Search, Edit2, Trash2, BookOpen, Upload, Copy, KeyRound, ChevronRight, ChevronLeft,
  LayoutGrid, List, FlaskConical, Presentation, Link2,
} from 'lucide-react';
import SubjectModal from '../components/SubjectModal';
import SubjectEnrollmentModal from '../components/SubjectEnrollmentModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FolderGlyph from '../components/classSpaces/FolderGlyph';
import { accentFor, tint } from '../components/classSpaces/classMeta';
import { useAuth } from '../context/AuthContext';
import { usePageState } from '../context/PageStateContext';
import { usePrograms } from '../hooks/usePrograms';

const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const yearLabel = (y) => `${ordinal(y)} Year`;
const semLabel = (s) => `${ordinal(s)} Semester`;

/** The model has no type field: lecture/lab comes from the hours. */
const kindOf = (s) => {
  const lec = Number(s.lectureHours) || 0;
  const lab = Number(s.labHours) || 0;
  if (lab > 0 && lec > 0) return { label: 'Lec + Lab', icon: FlaskConical, hex: '#7c3aed' };
  if (lab > 0) return { label: 'Laboratory', icon: FlaskConical, hex: '#0f766e' };
  return { label: 'Lecture', icon: Presentation, hex: '#0369a1' };
};

const sumUnits = (list) => list.reduce((n, s) => n + (Number(s.units) || 0), 0);
const sumHours = (list, key) => list.reduce((n, s) => n + (Number(s[key]) || 0), 0);
const byCode = (a, b) => (a.subjectCode || '').localeCompare(b.subjectCode || '', undefined, { numeric: true });

const SearchField = ({ value, onChange, placeholder, className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-white/10"
    />
  </div>
);

const IconButton = ({ title, onClick, danger, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`rounded-lg p-1.5 text-gray-400 transition-colors ${
      danger ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30' : 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
    }`}
  >
    {children}
  </button>
);

const Chip = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

/** One subject, drawn like a class card: colour spine, code tag, load. */
const SubjectCard = ({ subject, showPlace, onEdit, onDelete, onCodes, onCopy }) => {
  const hex = accentFor(subject.subjectCode);
  const kind = kindOf(subject);
  const prereqs = subject.prerequisites || [];
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white pl-1.5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: hex }} aria-hidden="true" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onCopy(subject.subjectCode)}
            title="Copy subject code"
            className="rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-wide"
            style={{ background: tint(hex, 0.1), color: hex }}
          >
            {subject.subjectCode}
          </button>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {subject.units} {Number(subject.units) === 1 ? 'unit' : 'units'}
          </span>
        </div>

        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">
          {subject.subjectName}
        </h3>
        {showPlace && (
          <p className="mt-0.5 text-xs text-gray-400">{subject.program} · {yearLabel(subject.yearLevel)} · {semLabel(subject.semester)}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium" style={{ background: tint(kind.hex, 0.1), color: kind.hex }}>
            <kind.icon className="h-3 w-3" />{kind.label}
          </span>
          {Number(subject.lectureHours) > 0 && <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{subject.lectureHours} h lec</span>}
          {Number(subject.labHours) > 0 && <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{subject.labHours} h lab</span>}
        </div>

        {prereqs.length > 0 && (
          <p className="mt-2 flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400" title={prereqs.map((p) => `${p.subjectCode} ${p.subjectName || ''}`).join('\n')}>
            <Link2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span className="line-clamp-1">Needs {prereqs.map((p) => p.subjectCode).join(', ')}</span>
          </p>
        )}
        {subject.description && (
          <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{subject.description}</p>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700/70">
        <button
          type="button"
          onClick={() => onCodes(subject)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
          style={{ color: hex, background: tint(hex, 0.08) }}
          title="Enrollment codes by section"
        >
          <KeyRound className="h-3.5 w-3.5" /> Codes
        </button>
        <span className="flex items-center">
          <IconButton title="Copy code" onClick={() => onCopy(subject.subjectCode)}><Copy className="h-4 w-4" /></IconButton>
          <IconButton title="Edit subject" onClick={() => onEdit(subject)}><Edit2 className="h-4 w-4" /></IconButton>
          <IconButton title="Delete subject" danger onClick={() => onDelete(subject)}><Trash2 className="h-4 w-4" /></IconButton>
        </span>
      </footer>
    </article>
  );
};

const SubjectTable = ({ subjects, onEdit, onDelete, onCodes, onCopy }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Where</th>
            <th className="px-4 py-3 text-center">Units</th>
            <th className="px-4 py-3 text-center">Lec</th>
            <th className="px-4 py-3 text-center">Lab</th>
            <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
          {subjects.map((s) => {
            const hex = accentFor(s.subjectCode);
            return (
              <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-md px-2 py-0.5 font-mono text-xs font-bold" style={{ background: tint(hex, 0.1), color: hex }}>{s.subjectCode}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{s.subjectName}</p>
                  {s.prerequisites?.length > 0 && <p className="text-xs text-gray-400">Needs {s.prerequisites.map((p) => p.subjectCode).join(', ')}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{s.program} · Y{s.yearLevel} · S{s.semester}</td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">{s.units}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{s.lectureHours || 0}</td>
                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{s.labHours || 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <IconButton title="Enrollment codes" onClick={() => onCodes(s)}><KeyRound className="h-4 w-4" /></IconButton>
                  <IconButton title="Copy code" onClick={() => onCopy(s.subjectCode)}><Copy className="h-4 w-4" /></IconButton>
                  <IconButton title="Edit subject" onClick={() => onEdit(s)}><Edit2 className="h-4 w-4" /></IconButton>
                  <IconButton title="Delete subject" danger onClick={() => onDelete(s)}><Trash2 className="h-4 w-4" /></IconButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

/** Static skeleton (no pulse), shaped like the folder grid. */
const FolderSkeleton = () => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Loading subjects">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-2 p-3">
        <div className="h-20 w-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-3 w-12 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    ))}
  </div>
);

const SubjectPage = () => {
  const { user } = useAuth();
  const { programCodes: PROGRAMS } = usePrograms();
  const { getPageState, savePageState } = usePageState();
  const isPM = user?.role === 'program_manager';

  const saved = getPageState('subjects', { program: '', year: null, semester: 0, view: 'cards' });
  const [searchTerm, setSearchTerm] = useState('');
  const [program, setProgram] = useState(isPM ? user?.program || '' : saved.program);
  const [year, setYear] = useState(saved.year);
  const [semester, setSemester] = useState(saved.semester); // 0 = both
  const [view, setView] = useState(saved.view);

  const [showModal, setShowModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', itemName: '', onConfirm: null });

  useEffect(() => {
    if (isPM && user?.program) setProgram(user.program);
  }, [isPM, user]);

  useEffect(() => {
    savePageState('subjects', { program, year, semester, view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, year, semester, view]);

  const { data: subjectsResponse, loading, refetch: reloadSubjects } = useCachedData(
    () => subjectAPI.getAll({ isActive: true }),
    'subjects-list',
    {
      cacheDuration: 5 * 60 * 1000,
      enabled: true,
      onError: (err) => toast.error(getErrorMessage(err, 'Failed to load subjects')),
    }
  );

  const subjects = useMemo(() => {
    if (!subjectsResponse) return [];
    const data = subjectsResponse.data || subjectsResponse;
    const list = data?.data || data || [];
    return Array.isArray(list) ? list : [];
  }, [subjectsResponse]);

  /* ---- Scope ------------------------------------------------------- */

  const programCounts = useMemo(() => {
    const m = {};
    subjects.forEach((s) => { if (s.program) m[s.program] = (m[s.program] || 0) + 1; });
    PROGRAMS.forEach((p) => { if (!(p in m)) m[p] = 0; });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [subjects, PROGRAMS]);

  const inProgram = useMemo(() => subjects.filter((s) => !program || s.program === program), [subjects, program]);
  const q = searchTerm.toLowerCase().trim();
  const searching = !!q;
  const searchResults = useMemo(() => (q
    ? inProgram.filter((s) => [s.subjectCode, s.subjectName, s.description, ...(s.prerequisites || []).map((p) => p.subjectCode)]
      .some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.program.localeCompare(b.program) || a.yearLevel - b.yearLevel || a.semester - b.semester || byCode(a, b))
    : []), [inProgram, q]);

  // Where we are: all programs -> one program -> one year
  const level = searching ? 'search' : !program ? 'programs' : year ? 'year' : 'years';
  const inYear = useMemo(() => inProgram.filter((s) => s.yearLevel === year), [inProgram, year]);

  /* ---- Actions ----------------------------------------------------- */

  const handleCreate = () => { setSelectedSubject(null); setModalMode('create'); setShowModal(true); };
  const handleEdit = (subject) => { setSelectedSubject(subject); setModalMode('edit'); setShowModal(true); };
  const handleCodes = (subject) => { setSelectedSubject(subject); setShowEnrollmentModal(true); };
  const copySubjectCode = (code) => {
    navigator.clipboard?.writeText(code).then(() => toast.success(`Copied ${code}`)).catch(() => toast.error('Failed to copy code'));
  };

  const closeConfirm = () => setConfirmDialog((d) => ({ ...d, isOpen: false }));
  const handleDelete = (subject) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete subject',
      message: 'Delete this subject? This action cannot be undone.',
      itemName: `${subject.subjectCode} - ${subject.subjectName}`,
      onConfirm: async () => {
        try {
          await subjectAPI.delete(subject._id);
          toast.success('Subject deleted');
          reloadSubjects();
        } catch (error) {
          const msg = error.response?.data?.message;
          toast.error(error.response?.status === 403 && !msg?.includes('program')
            ? 'You do not have permission to delete this subject'
            : msg || error.message || 'Failed to delete subject');
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedSubject(null);
    if (shouldRefresh) reloadSubjects();
  };

  const cardProps = { onEdit: handleEdit, onDelete: handleDelete, onCodes: handleCodes, onCopy: copySubjectCode };

  const goPrograms = () => { if (!isPM) setProgram(''); setYear(null); setSemester(0); setSearchTerm(''); };
  const goProgram = (p) => { setProgram(p); setYear(null); setSemester(0); setSearchTerm(''); };
  const goYear = (y) => { setYear(y); setSemester(0); };

  /* ---- Pieces ------------------------------------------------------ */

  const loadLine = (list) => {
    const lec = sumHours(list, 'lectureHours');
    const lab = sumHours(list, 'labHours');
    return [
      `${list.length} ${list.length === 1 ? 'subject' : 'subjects'}`,
      `${sumUnits(list)} units`,
      lec || lab ? `${lec} h lec · ${lab} h lab a week` : null,
    ].filter(Boolean).join(' · ');
  };

  const renderList = (list, showPlace) => (view === 'table'
    ? <SubjectTable subjects={list} {...cardProps} />
    : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => <SubjectCard key={s._id} subject={s} showPlace={showPlace} {...cardProps} />)}
      </div>
    ));

  const folder = ({ key, title, sub, hint, onClick }) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-0.5 rounded-2xl p-3 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-800"
    >
      <FolderGlyph />
      <span className="mt-1.5 w-full truncate text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </button>
  );

  const crumbs = [
    { label: 'Subjects', onClick: isPM ? null : goPrograms },
    program && { label: program, onClick: () => goProgram(program) },
    year && !searching && { label: yearLabel(year) },
  ].filter(Boolean);

  const allTotal = isPM ? inProgram : subjects;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Curriculum</p>
              <h1 className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Subject Management</h1>
              {!loading && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {allTotal.length} {allTotal.length === 1 ? 'subject' : 'subjects'}
                  {!isPM && programCounts.length > 1 && ` across ${programCounts.length} programs`}
                  {` · ${sumUnits(allTotal)} units`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SearchField value={searchTerm} onChange={setSearchTerm} placeholder={program ? `Search ${program} subjects` : 'Code, name or prerequisite'} className="flex-1 md:w-72 md:flex-none" />
              <button
                type="button"
                onClick={() => setShowExcelImportModal(true)}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Upload className="h-4 w-4" /><span className="hidden sm:inline">Import</span>
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">Add subject</span>
              </button>
            </div>
          </div>

          {/* Program chips (staff only; a program manager has one program) */}
          {!isPM && programCounts.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <Chip on={!program} onClick={goPrograms}>All programs <span className="text-xs opacity-60">{subjects.length}</span></Chip>
              {programCounts.map(([p, n]) => (
                <Chip key={p} on={program === p} onClick={() => goProgram(p)}>{p} <span className="text-xs opacity-60">{n}</span></Chip>
              ))}
            </div>
          )}

          {/* Breadcrumb + view toggle */}
          {(level === 'year' || level === 'search' || (level === 'years' && !isPM)) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                {level === 'year' && (
                  <button type="button" onClick={() => setYear(null)} className="mr-1 rounded-lg p-1 hover:bg-gray-200/70 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white" title="Back">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {searching ? (
                  <span><strong className="text-gray-900 dark:text-white">{searchResults.length}</strong> {searchResults.length === 1 ? 'match' : 'matches'} for “{searchTerm}”{program ? ` in ${program}` : ''}</span>
                ) : crumbs.map((c, i) => (
                  <React.Fragment key={c.label}>
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
                    {c.onClick && i < crumbs.length - 1 ? (
                      <button type="button" onClick={c.onClick} className="rounded-lg px-1.5 py-0.5 hover:bg-gray-200/70 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white">{c.label}</button>
                    ) : (
                      <span className="px-1.5 font-semibold text-gray-900 dark:text-white">{c.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
              {(level === 'year' || level === 'search') && (
                <div className="flex rounded-xl bg-white p-0.5 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                  {[{ key: 'cards', icon: LayoutGrid, label: 'Cards' }, { key: 'table', icon: List, label: 'Table' }].map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setView(v.key)}
                      title={v.label}
                      aria-pressed={view === v.key}
                      className={`rounded-lg px-2.5 py-1.5 ${view === v.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      <v.icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Body */}
          {loading && !subjects.length ? <FolderSkeleton /> : subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-700">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="font-semibold text-gray-800 dark:text-gray-100">No subjects yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Add subjects one by one or import the curriculum from Excel.</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => setShowExcelImportModal(true)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">Import</button>
                <button type="button" onClick={handleCreate} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">Add subject</button>
              </div>
            </div>
          ) : level === 'search' ? (
            searchResults.length ? renderList(searchResults, true) : (
              <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-700">
                <Search className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" />
                <p className="font-medium text-gray-700 dark:text-gray-200">No subjects match</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try a subject code, part of the name, or a prerequisite code.</p>
              </div>
            )
          ) : level === 'programs' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {programCounts.map(([p, n]) => folder({
                key: p,
                title: p,
                sub: `${n} ${n === 1 ? 'subject' : 'subjects'}`,
                hint: n ? `${sumUnits(subjects.filter((s) => s.program === p))} units` : 'Empty',
                onClick: () => goProgram(p),
              }))}
            </div>
          ) : level === 'years' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {YEAR_LEVELS.map((y) => {
                const list = inProgram.filter((s) => s.yearLevel === y);
                const s1 = list.filter((s) => s.semester === 1).length;
                return folder({
                  key: y,
                  title: yearLabel(y),
                  sub: `${list.length} ${list.length === 1 ? 'subject' : 'subjects'} · ${sumUnits(list)} units`,
                  hint: list.length ? `1st sem ${s1} · 2nd sem ${list.length - s1}` : 'Empty',
                  onClick: () => goYear(y),
                });
              })}
            </div>
          ) : (
            /* One year: the two semesters side by side as the curriculum reads */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip on={!semester} onClick={() => setSemester(0)}>Both semesters <span className="text-xs opacity-60">{inYear.length}</span></Chip>
                {SEMESTERS.map((sem) => (
                  <Chip key={sem} on={semester === sem} onClick={() => setSemester(sem)}>
                    {semLabel(sem)} <span className="text-xs opacity-60">{inYear.filter((s) => s.semester === sem).length}</span>
                  </Chip>
                ))}
              </div>
              {SEMESTERS.filter((sem) => !semester || semester === sem).map((sem) => {
                const list = inYear.filter((s) => s.semester === sem).sort(byCode);
                return (
                  <section key={sem}>
                    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{semLabel(sem)}</h2>
                      <span className="text-xs text-gray-400">{loadLine(list)}</span>
                      <span className="h-px min-w-[2rem] flex-1 self-center bg-gray-200 dark:bg-gray-700" />
                    </div>
                    {list.length ? renderList(list, false) : (
                      <button
                        type="button"
                        onClick={handleCreate}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-6 py-8 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white"
                      >
                        <Plus className="h-4 w-4" /> No subjects in the {semLabel(sem).toLowerCase()} yet. Add one
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && <SubjectModal mode={modalMode} subject={selectedSubject} onClose={handleModalClose} />}
      {showEnrollmentModal && (
        <SubjectEnrollmentModal
          subject={selectedSubject}
          onClose={() => { setShowEnrollmentModal(false); setSelectedSubject(null); }}
        />
      )}
      {showExcelImportModal && (
        <ExcelImportModal
          type="subjects"
          onClose={() => setShowExcelImportModal(false)}
          onComplete={() => { setShowExcelImportModal(false); reloadSubjects(); }}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        itemName={confirmDialog.itemName}
      />
    </Layout>
  );
};

export default SubjectPage;
