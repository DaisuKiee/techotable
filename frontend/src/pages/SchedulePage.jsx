import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import { scheduleAPI, subjectAPI, sectionAPI, facultyAPI, roomAPI, getErrorMessage } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import {
  Calendar as CalendarIcon, Plus, Download, Search, X,
  Wand2, AlertTriangle, CheckCircle, FileText, Grid,
  Clock, BookOpen, School, List, MapPin,
  Edit2, Trash2, RefreshCw, Printer, RotateCcw,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import ScheduleModal from '../components/ScheduleModal';
import GenerateScheduleModal from '../components/GenerateScheduleModal';
import ConflictWarning from '../components/ConflictWarning';
import ConfirmDialog from '../components/ConfirmDialog';
import ScheduleBuilder from '../components/ScheduleBuilder';
import { exportToCSV, exportToOfficialPDF, exportToPrintableHTML, exportWeeklyTimetable } from '../utils/scheduleExport';
import { useAuth } from '../context/AuthContext';
import StudentSchedule from '../components/StudentSchedule';
import FacultySchedule from '../components/FacultySchedule';
import { usePrograms } from '../hooks/usePrograms';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const VIEW_MODE_KEY = 'schedulePage.viewMode';
const BATCH_SIZE = 5; // concurrent requests for bulk actions

// `countKey` indexes into `stats`, so the control carries its own counts. They
// used to sit in a separate strip above that wrote the same statusFilter state.
const STATUS_FILTERS = [
  { value: 'all', label: 'All', countKey: 'total' },
  { value: 'published', label: 'Published', countKey: 'published' },
  { value: 'draft', label: 'Draft', countKey: 'draft' }
];

const SELECT_CLASS =
  'px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all';
const CHIP_CLASS =
  'inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-md';
const TH_CLASS =
  'px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider';

/** June onwards counts as the start of a new academic year. */
const getCurrentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

const getFacultyName = (schedule) => {
  const u = schedule.faculty?.user;
  return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
};

const getSectionLabel = (schedule) =>
  (typeof schedule.section === 'string' ? schedule.section : schedule.section?.sectionCode) ||
  schedule.sectionCode ||
  '';

const SORT_ACCESSORS = {
  subject: (s) => (s.subject?.subjectCode || '').toLowerCase(),
  section: (s) => getSectionLabel(s).toLowerCase(),
  faculty: (s) => getFacultyName(s).toLowerCase(),
  room: (s) => (s.roomLabel || '').toLowerCase(),
  status: (s) => (s.status === 'published' ? 1 : 0)
};

/** Run async work in small groups so a big bulk action doesn't flood the API. */
const runInBatches = async (items, size, fn) => {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    // eslint-disable-next-line no-await-in-loop
    results.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return results;
};

/* ------------------------------------------------------------------ */
/* Small presentational components                                      */
/* ------------------------------------------------------------------ */

const FilterChip = ({ label, onRemove }) => (
  <span className={CHIP_CLASS}>
    {label}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="hover:text-blue-900 dark:hover:text-blue-100"
      >
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

const SortHeader = ({ label, sortKey, activeKey, dir, onSort }) => {
  const isActive = activeKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={TH_CLASS}
      aria-sort={!isActive ? 'none' : dir === 'asc' ? 'ascending' : 'descending'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {label}
        <Icon className={`w-3 h-3 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
      </button>
    </th>
  );
};

const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm py-2" aria-busy="true">
    {Array.from({ length: 7 }).map((_, i) => (
      <div key={i} className="h-12 mx-4 my-3 rounded-lg bg-gray-100 dark:bg-gray-700" />
    ))}
  </div>
);

/** Shared frame for the student and faculty views. */
const RoleScheduleShell = ({ subtitle, children }) => (
  <Layout>
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">{subtitle}</p>
      </div>
      {children}
    </div>
  </Layout>
);

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const SchedulePage = () => {
  const { user } = useAuth();
  const { programCodes: PROGRAMS } = usePrograms();

  // Support data
  const [subjects, setSubjects] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Filters & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filters, setFilters] = useState(() => ({
    program: '',
    yearLevel: '',
    semester: 1,
    shift: '',
    academicYear: getCurrentAcademicYear()
  }));
  const [selectedSection, setSelectedSection] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === 'builder' ? 'builder' : 'list';
    } catch {
      return 'list';
    }
  });
  const [sort, setSort] = useState({ key: 'subject', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals & menus
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null
  });

  // Actions
  const [conflicts, setConflicts] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const exportMenuRef = useRef(null);
  const searchRef = useRef(null);
  const headerCheckboxRef = useRef(null);

  // Permission checks
  const canEditSchedules =
    user?.role === 'admin' || user?.role === 'scheduling_officer' || user?.role === 'program_manager';
  const isStudent = user?.role === 'student';
  const isFaculty = user?.role === 'faculty';
  const isProgramManager = user?.role === 'program_manager';
  const usesManagementView = !!user && !isStudent && !isFaculty;

  // Only editors can see the builder, whatever was remembered from last time.
  const activeView = canEditSchedules ? viewMode : 'list';

  const closeConfirm = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

  /* ---------------------------- Schedules ---------------------------- */

  const schedulesCacheKey = useMemo(() => {
    const parts = ['schedules', user?.role];
    if (filters.program) parts.push(filters.program);
    if (filters.yearLevel) parts.push(`y${filters.yearLevel}`);
    if (filters.semester) parts.push(`s${filters.semester}`);
    if (filters.shift) parts.push(filters.shift);
    if (filters.academicYear) parts.push(filters.academicYear);
    if (selectedSection?.sectionCode) parts.push(selectedSection.sectionCode);
    return parts.join('-');
  }, [filters, user?.role, selectedSection?.sectionCode]);

  // Cached with stale-while-revalidate. Students and faculty render their own
  // components that load their own data, so skip this fetch for them.
  const {
    data: schedulesResponse,
    loading: schedulesLoading,
    error: schedulesError,
    refetch: reloadSchedulesFromCache,
    isFromCache: schedulesFromCache
  } = useCachedData(
    async () => {
      const params = { isActive: true };
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      if (filters.shift) params.shift = filters.shift;
      if (filters.academicYear) params.academicYear = filters.academicYear;
      if (selectedSection?.sectionCode) params.sectionCode = selectedSection.sectionCode;
      return scheduleAPI.getAll(params);
    },
    schedulesCacheKey,
    {
      cacheDuration: 3 * 60 * 1000,
      enabled: usesManagementView,
      onError: (err) => {
        console.error('Failed to load schedules:', err);
        toast.error(getErrorMessage(err, 'Failed to load schedules'));
      }
    }
  );

  const schedules = useMemo(
    () => (Array.isArray(schedulesResponse?.data) ? schedulesResponse.data : []),
    [schedulesResponse]
  );

  // Derived, so it can never drift out of sync with the list.
  // Status is 'draft' | 'published' | 'archived'.
  const stats = useMemo(() => {
    const published = schedules.filter((s) => s.status === 'published').length;
    return {
      total: schedules.length,
      published,
      draft: schedules.length - published,
      conflicts: conflicts.length
    };
  }, [schedules, conflicts]);

  /* --------------------------- Role presets --------------------------- */

  useEffect(() => {
    if (isStudent && user) {
      setFilters({
        program: user.program || '',
        yearLevel: user.yearLevel || '',
        semester: user.semester || 1,
        shift: user.shift || '',
        academicYear: user.academicYear || getCurrentAcademicYear()
      });
    } else if (isProgramManager && user?.program) {
      setFilters((prev) => ({ ...prev, program: user.program }));
    }
  }, [isStudent, isProgramManager, user]);

  /* --------------------------- Support data --------------------------- */

  // Sections, faculty and rooms don't depend on the filters: load them once
  // instead of on every filter change.
  useEffect(() => {
    if (!usesManagementView) return undefined;
    let cancelled = false;

    (async () => {
      const [sectionsRes, facultyRes, roomsRes] = await Promise.allSettled([
        sectionAPI.getAllLightweight(), // lightweight mode is much faster
        facultyAPI.getAll({ isActive: true }),
        roomAPI.getAll({ isActive: true })
      ]);
      if (cancelled) return;

      if (sectionsRes.status === 'fulfilled') setAllSections(sectionsRes.value.data.data || []);
      else console.error('Load sections error:', sectionsRes.reason);

      if (facultyRes.status === 'fulfilled') setFaculty(facultyRes.value.data.data || []);
      else console.error('Load faculty error:', facultyRes.reason);

      if (roomsRes.status === 'fulfilled') setRooms(roomsRes.value.data.data || []);
      else console.error('Load rooms error:', roomsRes.reason);
    })();

    return () => {
      cancelled = true;
    };
  }, [usesManagementView]);

  // Subjects do depend on program / year / semester.
  useEffect(() => {
    if (!usesManagementView) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const params = { isActive: true };
        if (filters.program) params.program = filters.program;
        if (filters.yearLevel) params.yearLevel = filters.yearLevel;
        if (filters.semester) params.semester = filters.semester;
        const response = await subjectAPI.getAll(params);
        if (!cancelled) setSubjects(response.data.data || []);
      } catch (error) {
        console.error('Load subjects error:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usesManagementView, filters.program, filters.yearLevel, filters.semester]);

  /* ---------------------- Derived section lists ---------------------- */

  // Sections offered in the picker: program + academic year only, so picking
  // one never hides the others (year/semester/shift come *from* the section).
  const sectionOptions = useMemo(
    () =>
      allSections.filter((s) => {
        if (filters.program && s.program !== filters.program) return false;
        if (filters.academicYear && s.academicYear && s.academicYear !== filters.academicYear) return false;
        return true;
      }),
    [allSections, filters.program, filters.academicYear]
  );

  // What the modals and builder receive (program + year scoped).
  const scopedSections = useMemo(
    () =>
      allSections.filter((s) => {
        if (filters.program && s.program !== filters.program) return false;
        if (filters.yearLevel && s.yearLevel !== parseInt(filters.yearLevel, 10)) return false;
        return true;
      }),
    [allSections, filters.program, filters.yearLevel]
  );

  // Academic years offered: a couple back and one ahead.
  const academicYearOptions = useMemo(() => {
    const start = parseInt(getCurrentAcademicYear().slice(0, 4), 10);
    const years = [];
    for (let offset = -2; offset <= 1; offset++) {
      years.push(`${start + offset}-${start + offset + 1}`);
    }
    if (filters.academicYear && !years.includes(filters.academicYear)) {
      years.unshift(filters.academicYear);
    }
    return years;
  }, [filters.academicYear]);

  // The builder can only place classes once the target section is known.
  const builderReady = !!(filters.program && filters.yearLevel && filters.semester);

  /* ------------------------ Filter / sort / page ----------------------- */

  const filteredSchedules = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return schedules.filter((s) => {
      if (statusFilter === 'published' && s.status !== 'published') return false;
      if (statusFilter === 'draft' && s.status === 'published') return false;
      if (!q) return true;
      return [
        s.subject?.subjectCode,
        s.subject?.subjectName,
        getSectionLabel(s),
        getFacultyName(s),
        s.roomLabel // `room` is an id, so search the resolved label
      ].some((value) => value && String(value).toLowerCase().includes(q));
    });
  }, [schedules, searchTerm, statusFilter]);

  const sortedSchedules = useMemo(() => {
    const get = SORT_ACCESSORS[sort.key] || SORT_ACCESSORS.subject;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filteredSchedules].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
    });
  }, [filteredSchedules, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedSchedules.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = sortedSchedules.slice(pageStart, pageStart + pageSize);

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, filters, selectedSection, pageSize]);

  // Never keep a selection that is no longer visible: otherwise "Delete
  // Selected" could act on rows the user can't see any more.
  useEffect(() => {
    setSelectedSchedules((prev) => {
      if (prev.length === 0) return prev;
      const visible = new Set(filteredSchedules.map((s) => s._id));
      const next = prev.filter((id) => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredSchedules]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        selectedSchedules.length > 0 && selectedSchedules.length < filteredSchedules.length;
    }
  }, [selectedSchedules, filteredSchedules]);

  const hasActiveFilters = !!(
    searchTerm ||
    statusFilter !== 'all' ||
    (!isProgramManager && filters.program) ||
    filters.yearLevel ||
    filters.shift
  );

  /* ------------------------- Misc effects ------------------------- */

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* storage unavailable: the preference just won't persist */
    }
  }, [viewMode]);

  // Close the export menu on outside click / Escape.
  useEffect(() => {
    if (!showExportMenu) return undefined;
    const onMouseDown = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowExportMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showExportMenu]);

  // "/" focuses the search box, unless the user is already typing somewhere.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ----------------------------- Handlers ----------------------------- */

  // Picking a section configures everything the builder and Publish need:
  // program, year level, semester and shift.
  const handleSectionSelect = (sectionId) => {
    if (!sectionId) {
      setSelectedSection(null);
      setFilters((prev) => ({ ...prev, yearLevel: '', shift: '' }));
      return;
    }
    const section = allSections.find((s) => s._id === sectionId);
    if (section) {
      setSelectedSection(section);
      setFilters((prev) => ({
        ...prev,
        program: section.program || prev.program,
        yearLevel: section.yearLevel,
        shift: section.shift,
        semester: section.semester,
        academicYear: section.academicYear || prev.academicYear
      }));
    }
  };

  // Changing semester / academic year away from the chosen section's own values
  // makes that section meaningless, so drop it instead of showing a mismatch.
  const handleContextChange = (patch) => {
    const clearsSection =
      !!selectedSection &&
      (('semester' in patch && patch.semester !== selectedSection.semester) ||
        ('academicYear' in patch &&
          selectedSection.academicYear &&
          patch.academicYear !== selectedSection.academicYear));

    if (clearsSection) setSelectedSection(null);
    setFilters((prev) => ({
      ...prev,
      ...patch,
      ...(clearsSection ? { yearLevel: '', shift: '' } : {})
    }));
  };

  const handleProgramChange = (program) => {
    setSelectedSection(null); // changing program invalidates the chosen section
    setFilters((prev) => ({ ...prev, program, yearLevel: '', shift: '' }));
  };

  const clearYearLevel = () => {
    setSelectedSection(null);
    setFilters((prev) => ({ ...prev, yearLevel: '' }));
  };

  const clearShift = () => {
    setSelectedSection(null);
    setFilters((prev) => ({ ...prev, shift: '' }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedSection(null);
    setFilters((prev) => ({
      program: isProgramManager ? user.program : '',
      yearLevel: '',
      semester: prev.semester,
      shift: '',
      academicYear: prev.academicYear
    }));
  };

  const handleSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const handleCreate = () => {
    setSelectedSchedule(null);
    setModalMode('create');
    setShowScheduleModal(true);
  };

  const handleGenerate = () => setShowGenerateModal(true);

  const handleEdit = (schedule) => {
    if (!canEditSchedules) {
      // react-hot-toast has no `toast.info`
      toast('View-only mode. Only administrators can edit schedules.');
      return;
    }
    setSelectedSchedule(schedule);
    setModalMode('edit');
    setShowScheduleModal(true);
  };

  const handleDelete = (schedule) => {
    const subjectCode = schedule.subject?.subjectCode || schedule.subjectCode || 'Unknown';
    const sectionCode = getSectionLabel(schedule) || 'Unknown';

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Schedule',
      message: 'Are you sure you want to delete this schedule? This action cannot be undone.',
      itemName: `${subjectCode} - ${sectionCode}`,
      onConfirm: async () => {
        try {
          await scheduleAPI.delete(schedule._id);
          toast.success('Schedule deleted successfully');
          reloadSchedulesFromCache();
        } catch (error) {
          console.error('Delete error:', error);
          if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.message;
            toast.error(
              errorMessage?.includes('program')
                ? errorMessage
                : 'You do not have permission to delete this schedule'
            );
          } else {
            toast.error(error.response?.data?.message || 'Failed to delete schedule');
          }
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleToggleStatus = async (schedule) => {
    const nextStatus = schedule.status === 'published' ? 'draft' : 'published';
    setBusyId(schedule._id);
    try {
      await scheduleAPI.update(schedule._id, { status: nextStatus });
      toast.success(nextStatus === 'published' ? 'Schedule published' : 'Schedule moved back to draft');
      reloadSchedulesFromCache();
    } catch (error) {
      console.error('Status change error:', error);
      toast.error(error.response?.data?.message || 'Failed to update schedule status');
    } finally {
      setBusyId(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedSchedules.length === filteredSchedules.length && filteredSchedules.length > 0) {
      setSelectedSchedules([]);
    } else {
      setSelectedSchedules(filteredSchedules.map((s) => s._id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedSchedules((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteSelected = () => {
    if (selectedSchedules.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Multiple Schedules',
      message: 'Are you sure you want to delete the selected schedules? This action cannot be undone.',
      itemName: `${selectedSchedules.length} schedule(s)`,
      onConfirm: async () => {
        try {
          const res = await scheduleAPI.batchDelete(selectedSchedules);
          toast.success(res.data.message || `Deleted ${selectedSchedules.length} schedule(s)`);
          setSelectedSchedules([]);
          reloadSchedulesFromCache();
        } catch (error) {
          console.error('Batch delete error:', error);
          toast.error(error.response?.data?.message || 'Failed to delete selected schedules');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleBatchPublishSelected = async () => {
    const targets = schedules.filter(
      (s) => selectedSchedules.includes(s._id) && s.status !== 'published'
    );
    if (targets.length === 0) {
      toast('The selected schedules are already published');
      return;
    }

    setBulkBusy(true);
    try {
      const results = await runInBatches(targets, BATCH_SIZE, (s) =>
        scheduleAPI.update(s._id, { status: 'published' })
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const ok = results.length - failed;

      if (ok > 0) toast.success(`Published ${ok} schedule(s)`);
      if (failed > 0) toast.error(`${failed} schedule(s) could not be published`);

      setSelectedSchedules([]);
      reloadSchedulesFromCache();
    } catch (error) {
      console.error('Batch publish error:', error);
      toast.error(getErrorMessage(error, 'Failed to publish selected schedules'));
    } finally {
      setBulkBusy(false);
    }
  };

  const handlePublish = async () => {
    // The endpoint needs all four of these.
    if (!filters.program || !filters.yearLevel || !filters.semester || !filters.academicYear) {
      toast.error('Select a program and year level (or a section) before publishing');
      return;
    }

    const count = schedules.filter((s) => s.status !== 'published').length;
    if (count === 0) {
      toast('Everything in this view is already published');
      return;
    }
    if (
      !window.confirm(
        `Publish ${count} schedule(s) for ${filters.program} year ${filters.yearLevel}? Students will be able to see them.`
      )
    ) {
      return;
    }

    try {
      await scheduleAPI.publish({
        program: filters.program,
        yearLevel: filters.yearLevel,
        semester: filters.semester,
        academicYear: filters.academicYear
      });
      toast.success('Schedule published successfully');
      reloadSchedulesFromCache();
    } catch (error) {
      console.error('Publish error:', error);
      toast.error(error.response?.data?.message || 'Failed to publish schedule');
    }
  };

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true);
    try {
      const response = await scheduleAPI.checkConflicts({
        program: filters.program,
        yearLevel: filters.yearLevel,
        semester: filters.semester,
        academicYear: filters.academicYear
      });
      const foundConflicts = response.data.conflicts || [];
      setConflicts(foundConflicts);
      setShowConflictWarning(foundConflicts.length > 0);

      if (foundConflicts.length === 0) {
        toast.success('No conflicts found!');
      } else {
        toast.error(`Found ${foundConflicts.length} conflict${foundConflicts.length === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.error('Check conflicts error:', error);
      toast.error(getErrorMessage(error, 'Failed to check conflicts'));
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Exports the ticked rows if there are any, otherwise everything in view
  // (so search / status filters are respected).
  const exportRows = useMemo(() => {
    if (selectedSchedules.length > 0) {
      const ids = new Set(selectedSchedules);
      return sortedSchedules.filter((s) => ids.has(s._id));
    }
    return sortedSchedules;
  }, [selectedSchedules, sortedSchedules]);

  const handleExport = (format) => {
    setShowExportMenu(false);

    if (exportRows.length === 0) {
      toast.error('No schedules to export');
      return;
    }

    const filename = `schedule_${filters.program || 'all'}_${filters.academicYear || 'current'}`;

    try {
      switch (format) {
        case 'csv':
          exportToCSV(exportRows, `${filename}.csv`);
          toast.success('Exported to CSV');
          break;
        case 'official':
          exportToOfficialPDF(exportRows, filters);
          toast.success('Opening official schedule format');
          break;
        case 'pdf':
          exportToPrintableHTML(exportRows, filters);
          toast.success('Opening print preview');
          break;
        case 'timetable':
          exportWeeklyTimetable(exportRows, filters);
          toast.success('Opening timetable view');
          break;
        default:
          toast.error('Unknown export format');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(getErrorMessage(error, 'Failed to export schedule'));
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setShowScheduleModal(false);
    setShowGenerateModal(false);
    setSelectedSchedule(null);
    if (shouldRefresh) reloadSchedulesFromCache();
  };

  /* ------------------------- Role-specific views ------------------------- */

  // Students and faculty get their own timetables. The management view filters
  // by program, which for a student would mean "every schedule in BSIT"
  // instead of "my classes".
  if (isStudent) {
    return (
      <RoleScheduleShell subtitle="Your weekly timetable, built from the classes you are enrolled in">
        <StudentSchedule />
      </RoleScheduleShell>
    );
  }

  if (isFaculty) {
    return (
      <RoleScheduleShell subtitle="Your teaching assignments and weekly timetable">
        <FacultySchedule />
      </RoleScheduleShell>
    );
  }

  /* ------------------------------- Render ------------------------------- */

  const showSkeleton = schedulesLoading && !schedulesResponse;
  const showError = !!schedulesError && !schedulesResponse;
  const allSelected = filteredSchedules.length > 0 && selectedSchedules.length === filteredSchedules.length;
  const showingFrom = sortedSchedules.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pageSize, sortedSchedules.length);

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Page actions.
            The app header already names this page, so the old <h1> plus its
            subtitle only repeated it - and together with the stats strip they
            pushed the table halfway down the viewport. What replaces them is a
            single line that says what you are actually looking at. */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {schedulesLoading ? (
                'Loading schedules…'
              ) : (
                <>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {stats.total}
                  </span>{' '}
                  schedule{stats.total === 1 ? '' : 's'}
                  <span className="mx-1.5 text-gray-300 dark:text-gray-500">·</span>
                  {filters.academicYear}
                  <span className="mx-1.5 text-gray-300 dark:text-gray-500">·</span>
                  {filters.semester === 1 ? '1st' : '2nd'} Sem
                  {filters.program && (
                    <>
                      <span className="mx-1.5 text-gray-300 dark:text-gray-500">·</span>
                      {filters.program}
                    </>
                  )}
                </>
              )}
            </p>
            <div className="flex gap-2">
              {canEditSchedules && (
                <>
                  <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Add Schedule</span>
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                  >
                    <Wand2 className="w-5 h-5" />
                    <span className="hidden sm:inline">Generate</span>
                  </button>
                </>
              )}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={showExportMenu}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {showExportMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10 dark:bg-gray-800 dark:border-gray-700"
                  >
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      {selectedSchedules.length > 0
                        ? `${exportRows.length} selected schedule(s)`
                        : `${exportRows.length} schedule(s) in view`}
                    </div>
                    {[
                      { key: 'official', label: 'Official Schedule (PDF)', Icon: FileText },
                      { key: 'csv', label: 'Export to CSV', Icon: FileText },
                      { key: 'timetable', label: 'Weekly Timetable', Icon: Grid },
                      { key: 'pdf', label: 'Print Preview', Icon: Printer }
                    ].map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        role="menuitem"
                        onClick={() => handleExport(key)}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Icon size={16} className="mr-3" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by subject, faculty, room, or section…  ( / )"
                aria-label="Search schedules"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchTerm('');
                    e.currentTarget.blur();
                  }
                }}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.academicYear}
                onChange={(e) => handleContextChange({ academicYear: e.target.value })}
                title="Academic year"
                aria-label="Academic year"
                className={SELECT_CLASS}
              >
                {academicYearOptions.map((ay) => (
                  <option key={ay} value={ay}>{ay}</option>
                ))}
              </select>

              <select
                value={filters.semester}
                onChange={(e) => handleContextChange({ semester: parseInt(e.target.value, 10) })}
                title="Semester"
                aria-label="Semester"
                className={SELECT_CLASS}
              >
                <option value={1}>1st Sem</option>
                <option value={2}>2nd Sem</option>
              </select>

              {/* Program: program managers are always in their own */}
              {!isProgramManager && (
                <select
                  value={filters.program}
                  onChange={(e) => handleProgramChange(e.target.value)}
                  title="Program"
                  aria-label="Program"
                  className={SELECT_CLASS}
                >
                  <option value="">All Programs</option>
                  {PROGRAMS.map((prog) => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                </select>
              )}

              {/* Section: the primary control. Choosing one sets program, year
                  level, semester and shift together. */}
              {canEditSchedules && (
                <select
                  value={selectedSection?._id || ''}
                  onChange={(e) => handleSectionSelect(e.target.value)}
                  title="Section to work on"
                  aria-label="Section to work on"
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-all focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    selectedSection
                      ? 'border-2 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'border-2 border-dashed border-blue-400 text-blue-600 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-900'
                  }`}
                >
                  <option value="">
                    {sectionOptions.length === 0 ? 'No sections available' : 'Choose a section…'}
                  </option>
                  {sectionOptions.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.sectionCode} — Year {s.yearLevel} · Sem {s.semester} · {s.shift}
                    </option>
                  ))}
                </select>
              )}

              {/* View toggle */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  aria-pressed={activeView === 'list'}
                  className={`px-3 py-2 transition-colors ${
                    activeView === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="List View"
                  aria-label="List view"
                >
                  <List className="w-5 h-5" />
                </button>
                {canEditSchedules && (
                  <button
                    onClick={() => setViewMode('builder')}
                    aria-pressed={activeView === 'builder'}
                    className={`px-3 py-2 border-l border-gray-300 dark:border-gray-600 transition-colors ${
                      activeView === 'builder'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title="Schedule Builder"
                    aria-label="Schedule builder"
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status + list actions on one line. Status used to be split across
              a stats strip above and this segmented control, two controls
              writing one piece of state; the counts moved onto the control. */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map(({ value, label, countKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  aria-pressed={statusFilter === value}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    statusFilter === value
                      ? 'bg-white/25'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-200'
                  }`}>
                    {stats[countKey]}
                  </span>
                </button>
              ))}
            </div>

            {stats.conflicts > 0 && (
              <button
                type="button"
                onClick={() => setShowConflictWarning(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {stats.conflicts} conflict{stats.conflicts === 1 ? '' : 's'}
              </button>
            )}

            {/* Actions sit with the list they act on, rather than in a third
                row of their own below the filters. */}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canEditSchedules && (
                <>
                  {!builderReady && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
                      Choose a section to enable
                    </span>
                  )}
                  <button
                    onClick={handleCheckConflicts}
                    disabled={!builderReady || checkingConflicts}
                    title={builderReady ? 'Check this section for clashes' : 'Choose a section first'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <AlertTriangle size={14} className={checkingConflicts ? 'animate-pulse' : ''} />
                    {checkingConflicts ? 'Checking…' : 'Check Conflicts'}
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={!builderReady || stats.draft === 0}
                    title={
                      !builderReady
                        ? 'Choose a section first'
                        : stats.draft === 0
                        ? 'Nothing left to publish in this view'
                        : `Publish ${stats.draft} draft schedule(s) to students`
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle size={14} />
                    Publish {stats.draft > 0 ? `(${stats.draft})` : ''}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => reloadSchedulesFromCache()}
                disabled={schedulesLoading}
                title={schedulesFromCache ? 'Showing cached data. Click to refresh.' : 'Refresh schedules'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${schedulesLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{schedulesFromCache && !schedulesLoading ? 'Cached' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Active filter chips get their own line so they can wrap without
              shoving the controls above around. */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">Active filters:</span>
                {searchTerm && <FilterChip label={`Search: ${searchTerm}`} onRemove={() => setSearchTerm('')} />}
                {statusFilter !== 'all' && (
                  <FilterChip
                    label={statusFilter === 'published' ? 'Published' : 'Draft'}
                    onRemove={() => setStatusFilter('all')}
                  />
                )}
                {filters.program && (
                  <FilterChip
                    label={`Program: ${filters.program}`}
                    onRemove={isProgramManager ? undefined : () => handleProgramChange('')}
                  />
                )}
                {filters.yearLevel && (
                  <FilterChip label={`Year ${filters.yearLevel}`} onRemove={clearYearLevel} />
                )}
                {filters.shift && (
                  <FilterChip label={`${filters.shift} Shift`} onRemove={clearShift} />
                )}
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Selected section. A single line rather than the four-line card it
            was: the section dropdown already states the choice, so this only
            needs to confirm it and carry the detail the dropdown omits. */}
        {canEditSchedules && selectedSection && (
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-700 dark:bg-blue-900/30">
            <School className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-blue-900 dark:text-blue-100">
              {selectedSection.sectionCode}
            </span>
            <span className="text-blue-700/90 dark:text-blue-300">
              {selectedSection.program} · Year {selectedSection.yearLevel} · Sem {selectedSection.semester} · {selectedSection.shift}
              {selectedSection.adviser?.user && (
                <> · Adviser: {selectedSection.adviser.user.firstName} {selectedSection.adviser.user.lastName}</>
              )}
            </span>
            <button
              onClick={() => handleSectionSelect('')}
              aria-label="Deselect section"
              className="ml-auto text-blue-400 transition-colors hover:text-blue-700 dark:hover:text-blue-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Conflicts alert */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 dark:bg-red-900 dark:border-red-700" role="alert">
            <div className="flex items-start">
              <AlertTriangle className="text-red-600 mt-0.5 mr-3 dark:text-red-400" size={20} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 mb-2 dark:text-red-100">
                  {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Found
                </h3>
                <ul className="text-sm text-red-800 space-y-1 dark:text-red-200">
                  {conflicts.slice(0, 5).map((conflict, idx) => (
                    <li key={idx}>• {conflict.message || conflict.type}</li>
                  ))}
                </ul>
                {conflicts.length > 5 && (
                  <button
                    onClick={() => setShowConflictWarning(true)}
                    className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
                  >
                    View all {conflicts.length}
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setConflicts([]);
                  setShowConflictWarning(false);
                }}
                aria-label="Dismiss conflicts"
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Main content.
            The builder is checked BEFORE the loading branch on purpose:
            `onAssignmentChange` triggers a cache reload, and keeping the builder
            mounted preserves pending cards, undo history, subject search and
            scroll position. */}
        {activeView === 'builder' && !builderReady ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-10 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <School className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Choose a section to start building
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mb-5">
              Picking a section sets the program, year level, semester and shift in one go,
              then you can drag subjects onto the timetable.
            </p>

            {sectionOptions.length > 0 ? (
              <select
                value={selectedSection?._id || ''}
                onChange={(e) => handleSectionSelect(e.target.value)}
                aria-label="Choose a section"
                className="px-4 py-2.5 border-2 border-blue-500 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-300 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a section…</option>
                {sectionOptions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sectionCode} — Year {s.yearLevel} · Sem {s.semester} · {s.shift}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No sections exist for {filters.program || 'this program'} in {filters.academicYear}.
                Create one on the Sections page first.
              </p>
            )}
          </div>
        ) : activeView === 'builder' ? (
          <ScheduleBuilder
            filters={filters}
            subjects={subjects}
            sections={scopedSections}
            faculty={faculty}
            rooms={rooms}
            selectedSection={selectedSection}
            onAssignmentChange={reloadSchedulesFromCache}
          />
        ) : showSkeleton ? (
          <TableSkeleton />
        ) : showError ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Couldn&apos;t load schedules
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-5">
              Check your connection and try again.
            </p>
            <button
              onClick={() => reloadSchedulesFromCache()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {sortedSchedules.length === 0 ? (
              <div className="p-16 text-center">
                <CalendarIcon className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No schedules found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {hasActiveFilters
                    ? 'Try adjusting your search or filter criteria'
                    : 'Get started by creating your first schedule'}
                </p>
                {hasActiveFilters ? (
                  <button
                    onClick={clearAllFilters}
                    className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    Clear all filters
                  </button>
                ) : (
                  canEditSchedules && (
                    <button
                      onClick={handleCreate}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Add First Schedule
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Bulk action bar */}
                {selectedSchedules.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-700 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {selectedSchedules.length} of {filteredSchedules.length} selected
                      {!allSelected && filteredSchedules.length > pageRows.length && (
                        <button
                          onClick={handleSelectAll}
                          className="ml-3 font-medium text-blue-700 dark:text-blue-300 underline"
                        >
                          Select all {filteredSchedules.length}
                        </button>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {canEditSchedules && (
                        <>
                          <button
                            onClick={handleBatchPublishSelected}
                            disabled={bulkBusy}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {bulkBusy ? 'Publishing…' : `Publish Selected (${selectedSchedules.length})`}
                          </button>
                          <button
                            onClick={handleBatchDeleteSelected}
                            disabled={bulkBusy}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected ({selectedSchedules.length})
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedSchedules([])}
                        className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}

                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={handleSelectAll}
                          aria-label={allSelected ? 'Deselect all schedules' : 'Select all schedules'}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          title={allSelected ? 'Deselect All' : 'Select All'}
                        />
                      </th>
                      <SortHeader label="Subject" sortKey="subject" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                      <SortHeader label="Section" sortKey="section" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                      <SortHeader label="Faculty" sortKey="faculty" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                      <SortHeader label="Room" sortKey="room" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                      <th className={TH_CLASS}>Schedule</th>
                      <SortHeader label="Status" sortKey="status" activeKey={sort.key} dir={sort.dir} onSort={handleSort} />
                      {canEditSchedules && (
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {pageRows.map((schedule) => {
                      const isSelected = selectedSchedules.includes(schedule._id);
                      const isPublished = schedule.status === 'published';
                      const facultyName = getFacultyName(schedule);
                      const slots = schedule.timeSlots || [];
                      const allSlotsLabel = slots.map((ts) => `${ts.day}: ${ts.startTime} - ${ts.endTime}`).join('\n');

                      return (
                        <tr
                          key={schedule._id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <td className="px-4 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(schedule._id)}
                              aria-label={`Select ${schedule.subject?.subjectCode || 'schedule'}`}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {schedule.subject?.subjectCode || 'N/A'}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                  {schedule.subject?.subjectName || ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <School className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {getSectionLabel(schedule) || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {facultyName || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {schedule.roomLabel || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4" title={allSlotsLabel || undefined}>
                            <div className="text-sm text-gray-900 dark:text-white space-y-1">
                              {slots.length > 0 ? (
                                slots.slice(0, 2).map((ts, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span>{ts.day}: {ts.startTime} - {ts.endTime}</span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-gray-400">No time slots</span>
                              )}
                              {slots.length > 2 && (
                                <div className="text-xs text-gray-500">+{slots.length - 2} more</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isPublished
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                              }`}
                            >
                              {isPublished ? 'Published' : 'Draft'}
                            </span>
                          </td>
                          {canEditSchedules && (
                            <td className="px-4 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleToggleStatus(schedule)}
                                  disabled={busyId === schedule._id}
                                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                    isPublished
                                      ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900'
                                      : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900'
                                  }`}
                                  title={isPublished ? 'Revert to draft' : 'Publish'}
                                  aria-label={isPublished ? 'Revert to draft' : 'Publish schedule'}
                                >
                                  {isPublished ? <RotateCcw className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleEdit(schedule)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                                  title="Edit"
                                  aria-label="Edit schedule"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(schedule)}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                                  title="Delete"
                                  aria-label="Delete schedule"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    Showing {showingFrom}–{showingTo} of {sortedSchedules.length}
                  </span>
                  {sortedSchedules.length > PAGE_SIZE_OPTIONS[0] && (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span className="hidden sm:inline">Rows</span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                          aria-label="Rows per page"
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage(currentPage - 1)}
                          disabled={currentPage <= 1}
                          aria-label="Previous page"
                          className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 tabular-nums">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setPage(currentPage + 1)}
                          disabled={currentPage >= totalPages}
                          aria-label="Next page"
                          className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Builder hint */}
        {activeView === 'builder' && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-900 dark:border-blue-700">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              📚 Schedule Builder: pick a duration, drag a subject onto a time slot, then click the card to assign faculty and a room.
              Drag a placed card to move it, or onto the sidebar bin to remove it.
            </p>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          mode={modalMode}
          schedule={selectedSchedule}
          subjects={subjects}
          sections={scopedSections}
          faculty={faculty}
          rooms={rooms}
          onClose={handleModalClose}
          onDelete={handleDelete}
        />
      )}

      {/* Generate Modal */}
      {showGenerateModal && <GenerateScheduleModal onClose={handleModalClose} />}

      {/* Conflict Warning */}
      {showConflictWarning && conflicts.length > 0 && (
        <ConflictWarning conflicts={conflicts} onDismiss={() => setShowConflictWarning(false)} />
      )}

      {/* Confirm Dialog */}
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

export default SchedulePage;