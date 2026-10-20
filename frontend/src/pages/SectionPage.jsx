import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '../components/Layout';
import SectionModal from '../components/SectionModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { sectionAPI, facultyAPI, studentAPI } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import {
  Plus, Edit2, Trash2, Search, Sun, Moon,
  Users, BookOpen, GraduationCap, X, Download,
  Calendar, Grid3x3, List, RefreshCw, Copy, AlertTriangle,
  TrendingUp, UserCheck
} from 'lucide-react';
import { usePrograms } from '../hooks/usePrograms';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const YEAR_LEVELS = [1, 2, 3, 4];

const SORT_OPTIONS = [
  { key: 'code', label: 'Section code' },
  { key: 'year', label: 'Year level' },
  { key: 'fill', label: 'Most full' },
  { key: 'students', label: 'Most students' },
];

/** Percentage of seats taken. Guards against a missing/zero capacity. */
const fillPct = (s) =>
  s?.maxStudents ? Math.min(100, Math.round(((s.currentStudents || 0) / s.maxStudents) * 100)) : 0;

const fillBarColor = (pct) =>
  pct >= 90 ? 'bg-red-600' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-600';

const adviserNameOf = (s) =>
  s?.adviser?.user ? `${s.adviser.user.firstName || ''} ${s.adviser.user.lastName || ''}`.trim() : '';

const avatarSrc = (path) =>
  path ? `${process.env.REACT_APP_API_URL?.replace('/api', '')}${path}` : null;

/**
 * Normalise whatever the roster endpoint returns into a flat student list.
 * Handles `[student]`, `[{ student }]` (enrollment records) and the wrapped
 * `{ data: [...] }` / `{ students: [...] }` shapes.
 */
const normaliseStudents = (payload) => {
  let list = payload;
  if (!Array.isArray(list)) {
    list = list?.students || list?.enrolledStudents || list?.data || [];
  }
  if (!Array.isArray(list)) list = list?.students || list?.enrolledStudents || [];

  return list
    .map((entry, i) => {
      const st = entry?.student || entry;
      const u = st?.user || st || {};
      return {
        id: st?._id || entry?._id || `row-${i}`,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email || '',
        picture: u.profilePicture || null,
        studentId: st?.studentId || '',
        irregular: st?.studentType === 'irregular' || entry?.enrollmentType === 'subject',
      };
    })
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
    );
};

/** Load the roster for one section: look up its code, then fetch students in that section. */
const fetchSectionStudents = async (sectionId) => {
  const sectionRes = await sectionAPI.getById(sectionId);
  const section = sectionRes.data?.data ?? sectionRes.data;

  if (!section?.sectionCode) {
    return [];
  }

  const studentsRes = await studentAPI.getAll({ section: section.sectionCode });
  return normaliseStudents(studentsRes.data?.data ?? studentsRes.data);
};

const downloadCsv = (filename, rows) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const Chip = ({ children, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
    {children}
    <X
      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100"
      onClick={onRemove}
    />
  </span>
);

const ShiftBadge = ({ shift, solid = false }) => {
  const day = shift === 'Day';
  const cls = solid
    ? day ? 'bg-yellow-500 text-white' : 'bg-indigo-600 text-white'
    : day
    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${solid ? 'shadow-sm' : ''} ${cls}`}>
      {day ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      {shift}
    </span>
  );
};

const GridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading sections">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-700/60" />
          </div>
          <div className="h-7 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-10 rounded bg-gray-100 dark:bg-gray-700/60" />
        <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    ))}
  </div>
);

/* ─── Students slide-over ────────────────────────────────────────────────── */

const SectionStudentsPanel = ({ section, onClose, onEdit, onCopyCode }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const sectionId = section._id;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStudents(await fetchSectionStudents(sectionId));
    } catch (err) {
      console.error('Load section students error:', err);
      setError(err.response?.data?.message || 'Could not load the students in this section');
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    setQuery('');
    load();
  }, [load]);

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.studentId} ${s.email}`.toLowerCase().includes(q)
    );
  }, [students, query]);

  const pct = fillPct(section);
  const adviser = adviserNameOf(section);

  const handleExport = () => {
    if (students.length === 0) return;
    downloadCsv(`${section.sectionCode || 'section'}_students.csv`, [
      ['Student ID', 'Last name', 'First name', 'Email'],
      ...students.map((s) => [s.studentId, s.lastName, s.firstName, s.email]),
    ]);
    toast.success('Student list exported');
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <aside className="relative w-full sm:max-w-md h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-br from-indigo-600 to-blue-600 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs opacity-80">
                {section.program} · Year {section.yearLevel}
              </p>
              <h2 className="text-2xl font-bold break-words">{section.sectionCode}</h2>
              <p className="text-xs opacity-80 mt-0.5">
                {section.academicYear} · Sem {section.semester}
                {adviser && ` · Adviser: ${adviser}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="opacity-90">Capacity</span>
              <span className="font-semibold">
                {section.currentStudents || 0} / {section.maxStudents} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/25 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ShiftBadge shift={section.shift} solid />
            {section.enrollmentCode && (
              <button
                onClick={() => onCopyCode(section.enrollmentCode)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-mono tracking-wider transition-colors"
                title="Copy enrollment code"
              >
                {section.enrollmentCode}
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Enrolled students
              {!loading && !error && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300">
                  {students.length}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={load}
                title="Refresh"
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExport}
                disabled={students.length === 0}
                title="Export student list (CSV)"
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, student ID or email..."
              className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2" aria-label="Loading students">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-700/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-14 px-4">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="font-medium text-gray-900 dark:text-white mb-1">No students enrolled yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Students appear here once they join this section with its enrollment code.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-12">
              No students match "{query}".
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((s, i) => {
                const src = avatarSrc(s.picture);
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    <span className="w-6 text-right text-xs text-gray-400 flex-shrink-0">{i + 1}</span>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0">
                      {src ? (
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                          {(s.firstName[0] || '?')}{s.lastName[0] || ''}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {s.lastName ? `${s.lastName}, ${s.firstName}` : s.firstName || 'Unnamed student'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {s.studentId || s.email || '—'}
                      </p>
                    </div>
                    {s.irregular && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 flex-shrink-0">
                        IRREGULAR
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={() => onEdit(section)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
          >
            <Edit2 className="w-4 h-4" />
            Edit section
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  );
};

/* ─── Page ───────────────────────────────────────────────────────────────── */

const SectionPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [sortKey, setSortKey] = useState('code');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [viewingId, setViewingId] = useState(null); // section whose students are open
  const [refreshing, setRefreshing] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null
  });
  const closeConfirmDialog = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

  const { programCodes: programs } = usePrograms();

  // ✅ CACHE: Sections with 5-minute cache
  const {
    data: sectionsResponse,
    loading: sectionsLoading,
    error: sectionsError,
    refetch: reloadSections
  } = useCachedData(
    () => sectionAPI.getAll(),
    'sections-list',
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      onError: (err) => {
        console.error('Failed to load sections:', err);
        toast.error('Failed to load sections');
      }
    }
  );

  // ✅ CACHE: Faculty list with 5-minute cache
  const {
    data: facultyResponse,
    loading: facultyLoading
  } = useCachedData(
    () => facultyAPI.getAll({ isActive: true }),
    'faculty-for-sections',
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      onError: (err) => {
        console.error('Failed to load faculty:', err);
      }
    }
  );

  // Extract data from responses
  const sections = useMemo(() => {
    if (!sectionsResponse) return [];
    const data = sectionsResponse.data || sectionsResponse;
    return data?.data || data || [];
  }, [sectionsResponse]);

  const faculty = useMemo(() => {
    if (!facultyResponse) return [];
    const data = facultyResponse.data || facultyResponse;
    return data?.data || data || [];
  }, [facultyResponse]);

  const loading = sectionsLoading || facultyLoading;

  // The open panel always reflects the latest section data (after edits/code changes)
  const viewingSection = useMemo(
    () => sections.find((s) => s._id === viewingId) || null,
    [sections, viewingId]
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reloadSections();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingSection) {
        await sectionAPI.update(editingSection._id, formData);
        toast.success('Section updated successfully!');
      } else {
        await sectionAPI.create(formData);
        toast.success('Section created successfully!');
      }

      handleCloseModal();
      reloadSections();
    } catch (error) {
      console.error('Error saving section:', error);
      toast.error(error.response?.data?.message || 'Failed to save section');
      throw error; // Re-throw to let modal handle it for field validation
    }
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setShowModal(true);
  };

  const handleDelete = (section) => {
    const enrolled = section.currentStudents || 0;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Section',
      message:
        enrolled > 0
          ? `This section has ${enrolled} enrolled student${enrolled === 1 ? '' : 's'}. Deleting it removes the section and all associated data.`
          : 'Are you sure you want to delete this section? All associated data will be removed.',
      itemName: `${section.sectionCode} (${section.program} ${section.yearLevel}-${section.sectionLetter})`,
      onConfirm: async () => {
        try {
          await sectionAPI.delete(section._id);
          toast.success('Section deleted successfully!');
          if (viewingId === section._id) setViewingId(null);
          reloadSections();
        } catch (error) {
          console.error('Error deleting section:', error);

          // Show specific error message from backend
          if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.message;
            if (errorMessage?.includes('program')) {
              toast.error(errorMessage);
            } else {
              toast.error('You do not have permission to delete this section');
            }
          } else {
            toast.error(error.response?.data?.message || 'Failed to delete section');
          }
        } finally {
          closeConfirmDialog();
        }
      }
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSection(null);
  };

  const handleRegenerateCode = (section) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Regenerate Enrollment Code',
      message: 'Are you sure you want to regenerate the enrollment code? The old code will no longer work.',
      itemName: `${section.sectionCode} - Current Code: ${section.enrollmentCode}`,
      type: 'warning',
      confirmText: 'Regenerate',
      onConfirm: async () => {
        try {
          setRegeneratingId(section._id);
          await sectionAPI.regenerateEnrollmentCode(section._id);
          toast.success('Enrollment code regenerated successfully!');
          reloadSections();
        } catch (error) {
          console.error('Regenerate code error:', error);
          toast.error(error.response?.data?.message || 'Failed to regenerate enrollment code');
        } finally {
          setRegeneratingId(null);
          closeConfirmDialog();
        }
      }
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success('Enrollment code copied!');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterProgram('');
    setFilterShift('');
    setFilterYear('');
  };

  const hasFilters = !!(searchTerm || filterProgram || filterShift || filterYear);

  const filteredSections = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = sections.filter((section) => {
      const matchesSearch =
        !q ||
        (section.sectionCode || '').toLowerCase().includes(q) ||
        (section.program || '').toLowerCase().includes(q) ||
        adviserNameOf(section).toLowerCase().includes(q) ||
        (section.enrollmentCode || '').toLowerCase().includes(q);
      const matchesProgram = !filterProgram || section.program === filterProgram;
      const matchesShift = !filterShift || section.shift === filterShift;
      const matchesYear = !filterYear || section.yearLevel === parseInt(filterYear, 10);

      return matchesSearch && matchesProgram && matchesShift && matchesYear;
    });

    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'year':
          return (a.yearLevel || 0) - (b.yearLevel || 0) ||
            (a.sectionCode || '').localeCompare(b.sectionCode || '');
        case 'fill':
          return fillPct(b) - fillPct(a);
        case 'students':
          return (b.currentStudents || 0) - (a.currentStudents || 0);
        case 'code':
        default:
          return (a.sectionCode || '').localeCompare(b.sectionCode || '');
      }
    });
  }, [sections, searchTerm, filterProgram, filterShift, filterYear, sortKey]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalStudents = sections.reduce((sum, s) => sum + (s.currentStudents || 0), 0);
    const totalSeats = sections.reduce((sum, s) => sum + (s.maxStudents || 0), 0);
    return {
      total: sections.length,
      day: sections.filter(s => s.shift === 'Day').length,
      night: sections.filter(s => s.shift === 'Night').length,
      totalStudents,
      averageCapacity: totalSeats > 0 ? Math.round((totalStudents / totalSeats) * 100) : 0
    };
  }, [sections]);

  const toggleShift = (shift) => setFilterShift((cur) => (cur === shift ? '' : shift));

  const selectClass =
    'px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all';

  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const openStudents = (section) => setViewingId(section._id);

  const cardKeyDown = (section) => (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openStudents(section);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Section Management
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={refreshing}
                title="Refresh sections"
                className="p-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Section</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Create and manage sections with Day/Night shift indicators. Click a section to see who is enrolled.
          </p>
        </div>

        {/* Statistics Cards. Day and Night double as quick shift filters. */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
          <button
            onClick={clearFilters}
            title="Show all sections"
            className="text-left bg-indigo-600 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">TOTAL</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Sections</div>
          </button>

          <button
            onClick={() => toggleShift('Day')}
            aria-pressed={filterShift === 'Day'}
            title="Filter Day shift"
            className={`text-left bg-yellow-500 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all ${
              filterShift === 'Day' ? 'ring-4 ring-yellow-300 dark:ring-yellow-700' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Sun className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">DAY</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.day}</div>
            <div className="text-xs opacity-80 mt-1">Day Shift</div>
          </button>

          <button
            onClick={() => toggleShift('Night')}
            aria-pressed={filterShift === 'Night'}
            title="Filter Night shift"
            className={`text-left bg-blue-600 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-all ${
              filterShift === 'Night' ? 'ring-4 ring-blue-300 dark:ring-blue-700' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Moon className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">NIGHT</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.night}</div>
            <div className="text-xs opacity-80 mt-1">Night Shift</div>
          </button>

          <div className="bg-green-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">STUDENTS</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.totalStudents}</div>
            <div className="text-xs opacity-80 mt-1">Total Enrolled</div>
          </div>

          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-md col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">CAPACITY</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.averageCapacity}%</div>
            <div className="text-xs opacity-80 mt-1">Avg. Filled</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by section code, program, adviser or enrollment code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                title="Program"
                className={selectClass}
              >
                <option value="">All Programs</option>
                {programs.map(prog => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                title="Year level"
                className={selectClass}
              >
                <option value="">All Years</option>
                {YEAR_LEVELS.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>

              <select
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                title="Shift"
                className={selectClass}
              >
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                title="Sort by"
                className={selectClass}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>Sort: {o.label}</option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="Grid View"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 border-l border-gray-300 dark:border-gray-600 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title="List View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              {searchTerm && <Chip onRemove={() => setSearchTerm('')}>Search: {searchTerm}</Chip>}
              {filterProgram && <Chip onRemove={() => setFilterProgram('')}>Program: {filterProgram}</Chip>}
              {filterYear && <Chip onRemove={() => setFilterYear('')}>Year: {filterYear}</Chip>}
              {filterShift && <Chip onRemove={() => setFilterShift('')}>Shift: {filterShift}</Chip>}
              <button
                onClick={clearFilters}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Clear all
              </button>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                {filteredSections.length} of {sections.length}
              </span>
            </div>
          )}
        </div>

        {/* Sections Grid or List */}
        {loading ? (
          <GridSkeleton />
        ) : sectionsError && sections.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Couldn't load sections
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Check your connection and try again.</p>
            <button
              onClick={refresh}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <BookOpen className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {sections.length === 0 ? 'No sections created yet' : 'No sections match your filters'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {sections.length === 0
                ? 'Get started by creating your first section'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {sections.length === 0 ? (
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Section
              </button>
            ) : (
              <button
                onClick={clearFilters}
                className="px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections.map((section) => {
              const pct = fillPct(section);
              const adviserName = adviserNameOf(section);
              return (
                <div
                  key={section._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openStudents(section)}
                  onKeyDown={cardKeyDown(section)}
                  title="Click to see enrolled students"
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 flex flex-col"
                >
                  {/* Section Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                          {section.sectionCode}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {section.program} • Year {section.yearLevel}
                      </p>
                      {/* Enrollment Code Badge */}
                      {section.enrollmentCode ? (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg px-3 py-1.5">
                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">Enrollment Code:</p>
                            <p className="text-lg font-bold text-green-900 dark:text-green-100 font-mono tracking-wider">{section.enrollmentCode}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={stop(() => handleCopyCode(section.enrollmentCode))}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                              title="Copy Code"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={stop(() => handleRegenerateCode(section))}
                              disabled={regeneratingId === section._id}
                              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                              title="Regenerate Code"
                            >
                              <RefreshCw className={`w-4 h-4 ${regeneratingId === section._id ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 inline-block">
                          <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5">
                            <p className="text-xs text-gray-500 font-medium">Enrollment Code:</p>
                            <p className="text-sm text-gray-400 italic">Not generated yet</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <ShiftBadge shift={section.shift} solid />
                  </div>

                  {/* Capacity */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-600 dark:text-gray-400 font-medium flex items-center gap-2">
                        Student Capacity
                        {pct >= 100 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            FULL
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {section.currentStudents || 0} / {section.maxStudents}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fillBarColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Section Details */}
                  <div className="space-y-2.5 mb-4 flex-1">
                    {adviserName && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-600 dark:text-gray-400 text-xs">Adviser</p>
                          <p className="font-medium text-gray-900 dark:text-white truncate">{adviserName}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Academic Period</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {section.academicYear} • Sem {section.semester}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={stop(() => openStudents(section))}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors font-medium"
                    >
                      <Users className="w-4 h-4" />
                      Students
                    </button>
                    <button
                      onClick={stop(() => handleEdit(section))}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={stop(() => handleDelete(section))}
                      className="flex items-center justify-center px-3 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    {['Section', 'Program & Year', 'Shift', 'Students', 'Adviser', 'Academic Year', 'Code'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSections.map((section) => {
                    const pct = fillPct(section);
                    const adviserName = adviserNameOf(section);
                    return (
                      <tr
                        key={section._id}
                        onClick={() => openStudents(section)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        title="Click to see enrolled students"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {section.sectionCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 dark:text-white">{section.program}</div>
                            <div className="text-gray-600 dark:text-gray-400">Year {section.yearLevel}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <ShiftBadge shift={section.shift} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white font-medium">
                              {section.currentStudents || 0} / {section.maxStudents}
                            </span>
                          </div>
                          <div className="mt-1 w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${fillBarColor(pct)}`} style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {adviserName ? (
                            <div className="text-sm text-gray-900 dark:text-white">{adviserName}</div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">No adviser</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {section.academicYear}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            Semester {section.semester}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {section.enrollmentCode ? (
                            <button
                              onClick={stop(() => handleCopyCode(section.enrollmentCode))}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-mono text-xs tracking-wider hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
                              title="Copy enrollment code"
                            >
                              {section.enrollmentCode}
                              <Copy className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={stop(() => openStudents(section))}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                              title="View students"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                            <button
                              onClick={stop(() => handleEdit(section))}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={stop(() => handleDelete(section))}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Enrolled students panel */}
        {viewingSection && (
          <SectionStudentsPanel
            section={viewingSection}
            onClose={() => setViewingId(null)}
            onEdit={(s) => {
              setViewingId(null);
              handleEdit(s);
            }}
            onCopyCode={handleCopyCode}
          />
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <SectionModal
            section={editingSection}
            faculty={faculty}
            onClose={handleCloseModal}
            onSubmit={handleSubmit}
          />
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={closeConfirmDialog}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          itemName={confirmDialog.itemName}
          type={confirmDialog.type}
          confirmText={confirmDialog.confirmText}
        />
      </div>
    </Layout>
  );
};

export default SectionPage;