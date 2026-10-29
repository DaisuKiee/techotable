import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Upload, Edit2, Trash2, Search, X, Users, GraduationCap, Grid3x3, List,
  Download, FileText, BookOpen, AlertTriangle, UserCheck, Shuffle, RefreshCw, Mail, User,
} from 'lucide-react';
import Layout from '../components/Layout';
import { studentAPI, getErrorMessage } from '../services/api';
import StudentModal from '../components/StudentModal';
import BulkImportModal from '../components/BulkImportModal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../hooks/usePrograms';

const EMPTY_FILTERS = { program: '', yearLevel: '', status: '', studentType: '', assignment: '' };

const STATUS = {
  enrolled: { label: 'Enrolled', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  not_enrolled: { label: 'Not enrolled', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300' },
  dropped: { label: 'Dropped', cls: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  graduated: { label: 'Graduated', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' },
};

const YEAR_LABEL = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year', 5: '5th year' };

const AVATAR_TONES = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/70 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-200',
];

const FILE_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const nameOf = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
// A record whose login was removed has no name; show the student ID instead
const displayName = (s) => nameOf(s.user) || s.studentId || 'Unknown student';

const Avatar = ({ student, size = 'h-11 w-11' }) => {
  const [failed, setFailed] = useState(false);
  const pic = student.user?.profilePicture;
  if (pic && !failed) {
    return <img src={`${FILE_BASE}${pic}`} alt="" onError={() => setFailed(true)} className={`${size} flex-shrink-0 rounded-full object-cover`} />;
  }
  const name = displayName(student);
  const tone = AVATAR_TONES[Math.abs([...name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)) % AVATAR_TONES.length];
  const initials = `${student.user?.firstName?.[0] || ''}${student.user?.lastName?.[0] || ''}`.toUpperCase();
  return (
    <div className={`${size} flex flex-shrink-0 items-center justify-center rounded-full ${tone}`}>
      {initials ? <span className="text-sm font-bold">{initials}</span> : <User className="h-5 w-5" />}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.not_enrolled;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const SectionBadge = ({ student }) => (student.sectionCode ? (
  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
    {student.sectionCode}
  </span>
) : (
  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
    <AlertTriangle className="h-3 w-3" /> No section
  </span>
));

const TypeLabel = ({ type }) => (
  <span className="capitalize">{type || <span className="text-gray-400 dark:text-gray-500">type not set</span>}</span>
);

const FilterSelect = ({ value, onChange, children, label, disabled }) => (
  <select
    aria-label={label}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className={`rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70 dark:text-white ${
      value
        ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-900/30'
        : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700'
    }`}
  >
    {children}
  </select>
);

// Static placeholders shaped like the real cards and rows (no pulse/shimmer)
const Bone = ({ className = '' }) => <span className={`block rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;

const CardSkeleton = () => (
  <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4 flex items-start gap-3">
      <Bone className="h-11 w-11 flex-shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-4 w-2/3" />
        <Bone className="h-3 w-1/2" />
        <Bone className="h-4 w-24" />
      </div>
      <Bone className="h-5 w-16 rounded-full" />
    </div>
    <div className="mb-4 grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-2.5 w-12" />
          <Bone className="h-3.5 w-20" />
        </div>
      ))}
    </div>
    <div className="mt-auto flex gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
      <Bone className="h-9 flex-1 rounded-lg" />
      <Bone className="h-9 w-10 rounded-lg" />
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-700">
      <Bone className="h-3 w-1/3 bg-gray-300 dark:bg-gray-600" />
    </div>
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Bone className="h-9 w-9 flex-shrink-0 rounded-full" />
          <div className="w-48 space-y-1.5">
            <Bone className="h-3.5 w-36" />
            <Bone className="h-3 w-44" />
          </div>
          <Bone className="hidden h-3.5 w-20 sm:block" />
          <Bone className="hidden h-3.5 w-24 md:block" />
          <Bone className="hidden h-5 w-20 rounded-md md:block" />
          <Bone className="ml-auto h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

const csvCell =(v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (filename, rows) => {
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const StudentPage = () => {
  const { user } = useAuth();
  const { programCodes } = usePrograms();
  const isManager = user?.role === 'program_manager';

  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, program: isManager ? user?.program || '' : '' }));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('students.view') || 'grid'; } catch (_) { return 'grid'; }
  });
  const [modal, setModal] = useState(null); // { student } | { student: null } | null
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const requestId = useRef(0);
  const searchRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem('students.view', viewMode); } catch (_) { /* storage blocked */ }
  }, [viewMode]);

  // Wait for typing to pause instead of searching on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Every load gets a number and only the newest one may update the list,
  // so a slow earlier response can't overwrite a newer filter's results
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, search }).filter(([, v]) => v));
      const res = await studentAPI.getAll(params);
      if (id !== requestId.current) return;
      setStudents(res.data.data || []);
      setLoadError('');
    } catch (error) {
      if (id !== requestId.current) return;
      setLoadError(getErrorMessage(error, 'Could not load students'));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters, search]);

  useEffect(() => { load(); }, [load]);

  // "/" jumps to search, like most list pages
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '') && !document.querySelector('[role=dialog]')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const toggleFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS, program: isManager ? user?.program || '' : '' });
    setSearchInput('');
  };

  const counts = useMemo(() => ({
    total: students.length,
    enrolled: students.filter((s) => s.enrollmentStatus === 'enrolled').length,
    unassigned: students.filter((s) => !s.sectionCode).length,
    irregular: students.filter((s) => s.studentType === 'irregular').length,
  }), [students]);

  const chips = [
    searchInput && { key: 'search', label: `“${searchInput}”`, clear: () => setSearchInput('') },
    !isManager && filters.program && { key: 'program', label: filters.program, clear: () => setFilter('program', '') },
    filters.yearLevel && { key: 'yearLevel', label: YEAR_LABEL[filters.yearLevel], clear: () => setFilter('yearLevel', '') },
    filters.status && { key: 'status', label: STATUS[filters.status]?.label, clear: () => setFilter('status', '') },
    filters.studentType && { key: 'studentType', label: filters.studentType === 'unset' ? 'Type not set' : filters.studentType, clear: () => setFilter('studentType', '') },
    filters.assignment && { key: 'assignment', label: filters.assignment === 'unassigned' ? 'No section' : 'Has section', clear: () => setFilter('assignment', '') },
  ].filter(Boolean);

  const handleModalClose = (saved) => {
    setModal(null);
    if (saved) load();
  };

  const askDelete = (student) => setConfirm({
    title: 'Delete student',
    message: `This removes ${displayName(student)}'s student record and login account, and takes them out of any class spaces they joined.`,
    itemName: `${displayName(student)} (${student.studentId})`,
    onConfirm: async () => {
      try {
        const res = await studentAPI.delete(student._id);
        const n = res.data?.data?.removedFromClasses || 0;
        toast.success(n ? `Student deleted and removed from ${n} class${n === 1 ? '' : 'es'}` : 'Student deleted');
        setStudents((prev) => prev.filter((s) => s._id !== student._id));
        load();
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not delete the student'));
      }
    },
  });

  const exportCsv = () => {
    if (!students.length) {
      toast.error('No students to export');
      return;
    }
    downloadCsv(
      `students${filters.program ? `_${filters.program}` : ''}_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Student ID', 'Last Name', 'First Name', 'Middle Name', 'Email', 'Program', 'Year Level', 'Section', 'Student Type', 'Subject Codes', 'Academic Year', 'Semester', 'Status', 'Contact Number'],
        ...students.map((s) => [
          s.studentId, s.user?.lastName, s.user?.firstName, s.user?.middleName, s.user?.email, s.program,
          s.yearLevel, s.sectionCode, s.studentType, (s.subjectCodes || []).join(' '), s.academicYear, s.semester,
          STATUS[s.enrollmentStatus]?.label || s.enrollmentStatus, s.contactNumber,
        ]),
      ]
    );
    toast.success(`Exported ${students.length} student${students.length === 1 ? '' : 's'}`);
  };

  const downloadTemplate = () => downloadCsv('student_import_template.csv', [
    ['studentId', 'email', 'password', 'firstName', 'lastName', 'middleName', 'program', 'yearLevel', 'sectionCode', 'studentType', 'subjectCodes', 'contactNumber'],
    ['2025-00001', 'juan.delacruz@example.com', '', 'Juan', 'Dela Cruz', 'Santos', isManager ? user.program : 'BSIT', '1', '', 'regular', '', '09123456789'],
    ['2025-00002', 'maria.garcia@example.com', 'ChangeMe2025', 'Maria', 'Garcia', 'Lopez', isManager ? user.program : 'BSIT', '2', '', 'irregular', 'CC 111; GEC-RPH', '09123456788'],
  ]);

  const actions = (student, compact) => (
    <>
      <button
        type="button"
        onClick={() => setModal({ student })}
        className={compact
          ? 'rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/40'
          : 'flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70'}
        aria-label={`Edit ${displayName(student)}`}
        title="Edit"
      >
        <Edit2 className="h-4 w-4" />{!compact && 'Edit'}
      </button>
      <button
        type="button"
        onClick={() => askDelete(student)}
        className={compact
          ? 'rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/40'
          : 'flex items-center justify-center rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/40'}
        aria-label={`Delete ${displayName(student)}`}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </>
  );

  const hasFilters = chips.length > 0;

  return (
    <Layout>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Student Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 md:text-base">
              {isManager ? `${user.program} students` : 'Student records'}, their sections and enrollment status
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" title="CSV template for importing">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Template</span>
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              <Upload className="h-4 w-4" /> Import
            </button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" title="Download the students shown as CSV (opens in Excel)">
              <Download className="h-4 w-4" /> Export
            </button>
            <button type="button" onClick={() => setModal({ student: null })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/30">
              <Plus className="h-4 w-4" /> Add student
            </button>
          </div>
        </div>

        {/* Stats double as quick filters */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard icon={Users} label="Students" value={counts.total} hint={hasFilters ? 'matching filters' : 'in total'} tone="indigo" active={!hasFilters} onClick={clearFilters} />
          <StatCard icon={UserCheck} label="Enrolled" value={counts.enrolled} hint="click to show only these" tone="emerald" active={filters.status === 'enrolled'} onClick={() => toggleFilter('status', 'enrolled')} />
          <StatCard icon={AlertTriangle} label="No section" value={counts.unassigned} hint={counts.unassigned ? 'need a section assigned' : 'everyone is placed'} tone="amber" active={filters.assignment === 'unassigned'} onClick={() => toggleFilter('assignment', 'unassigned')} />
          <StatCard icon={Shuffle} label="Irregular" value={counts.irregular} hint="take individual subjects" tone="orange" active={filters.studentType === 'irregular'} onClick={() => toggleFilter('studentType', 'irregular')} />
        </div>

        {/* Search and filters */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchInput('')}
                placeholder="Search name, student ID, email or section   ( / )"
                aria-label="Search students"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-9 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              {refreshing && !loading && <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isManager && (
                <FilterSelect label="Program" value={filters.program} onChange={(v) => setFilter('program', v)}>
                  <option value="">All programs</option>
                  {programCodes.map((p) => <option key={p} value={p}>{p}</option>)}
                </FilterSelect>
              )}
              <FilterSelect label="Year level" value={filters.yearLevel} onChange={(v) => setFilter('yearLevel', v)}>
                <option value="">All years</option>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{YEAR_LABEL[y]}</option>)}
              </FilterSelect>
              <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)}>
                <option value="">Any status</option>
                {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </FilterSelect>
              <FilterSelect label="Student type" value={filters.studentType} onChange={(v) => setFilter('studentType', v)}>
                <option value="">All types</option>
                <option value="regular">Regular</option>
                <option value="irregular">Irregular</option>
                <option value="unset">Type not set</option>
              </FilterSelect>
              <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600" role="group" aria-label="View">
                {[['grid', Grid3x3, 'Cards'], ['list', List, 'Table']].map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    title={label}
                    className={`px-3 py-2 transition-colors ${viewMode === mode ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {loading ? 'Filtering…' : `${students.length} match${students.length === 1 ? '' : 'es'}:`}
              </span>
              {chips.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-1 text-xs capitalize text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {c.label}
                  <button type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`} className="hover:text-indigo-900 dark:hover:text-indigo-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button type="button" onClick={clearFilters} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">Clear all</button>
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading students">
            {viewMode === 'list' ? <TableSkeleton /> : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}
          </div>
        ) : loadError && !students.length ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-900/20">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-3 font-semibold text-red-900 dark:text-red-200">{loadError}</p>
            <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-600 dark:bg-gray-800">
            <GraduationCap className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              {hasFilters ? 'No students match' : 'No students yet'}
            </h3>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              {hasFilters ? 'Try a different search or clear the filters.' : 'Add students one by one, or import a CSV of the whole class.'}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Clear filters
              </button>
            ) : (
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                  <Upload className="h-4 w-4" /> Import CSV
                </button>
                <button type="button" onClick={() => setModal({ student: null })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Plus className="h-4 w-4" /> Add student
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`grid grid-cols-1 gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3 ${refreshing ? 'opacity-60' : ''}`}>
            {students.map((student) => (
              <div key={student._id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-indigo-300 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700">
                <div className="mb-4 flex items-start gap-3">
                  <Avatar student={student} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-gray-900 dark:text-white" title={displayName(student)}>{displayName(student)}</h3>
                    {student.user?.email ? (
                      <a href={`mailto:${student.user.email}`} className="flex items-center gap-1 truncate text-xs text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                        <Mail className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{student.user.email}</span>
                      </a>
                    ) : null}
                    <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {student.studentId}
                    </span>
                  </div>
                  <StatusBadge status={student.enrollmentStatus} />
                </div>

                <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Program</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {student.program}{student.yearLevel ? ` · ${YEAR_LABEL[student.yearLevel] || `Year ${student.yearLevel}`}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Section</dt>
                    <dd className="mt-0.5"><SectionBadge student={student} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Type</dt>
                    <dd className="font-medium text-gray-900 dark:text-white"><TypeLabel type={student.studentType} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">Term</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{student.academicYear} · Sem {student.semester}</dd>
                  </div>
                  {student.studentType === 'irregular' && student.subjectCodes?.length > 0 && (
                    <div className="col-span-2">
                      <dt className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><BookOpen className="h-3 w-3" /> Subjects</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {student.subjectCodes.map((c) => (
                          <span key={c} className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{c}</span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-auto flex gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">{actions(student, false)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity dark:border-gray-700 dark:bg-gray-800 ${refreshing ? 'opacity-60' : ''}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">
                  <tr>
                    {['Student', 'Student ID', 'Program & year', 'Section', 'Type', 'Status', 'Contact'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">{h}</th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {students.map((student) => (
                    <tr key={student._id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar student={student} size="h-9 w-9" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{displayName(student)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{student.user?.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{student.studentId}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {student.program}{student.yearLevel ? ` · ${YEAR_LABEL[student.yearLevel] || `Year ${student.yearLevel}`}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><SectionBadge student={student} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300"><TypeLabel type={student.studentType} /></td>
                      <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={student.enrollmentStatus} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {student.contactNumber ? <a href={`tel:${student.contactNumber}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{student.contactNumber}</a> : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">{actions(student, true)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && <StudentModal student={modal.student} onClose={handleModalClose} />}

      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onComplete={() => { setShowImport(false); load(); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        itemName={confirm?.itemName}
        confirmText="Delete student"
      />
    </Layout>
  );
};

export default StudentPage;
