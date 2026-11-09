import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { classSpaceAPI, resolveUploadUrl, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePageState } from '../context/PageStateContext';
import useCachedData from '../hooks/useCachedData';
import { useLiveRefresh } from '../context/NotificationContext';
import toast from 'react-hot-toast';
import {
  BookOpen, Users, Plus, Search, Download, Trash2, Pin, Edit2, ChevronLeft, ChevronRight,
  Copy, RefreshCw, MapPin, LogOut, Mail, Phone, UserPlus, Megaphone, Paperclip,
  LayoutList, FolderOpen, CalendarDays, KeyRound, X,
} from 'lucide-react';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';
import UploadMaterialModal from '../components/UploadMaterialModal';
import EnrollModal from '../components/EnrollModal';
import TypeToConfirmDialog from '../components/TypeToConfirmDialog';
import {
  accentFor, tint, subjectCodeOf, subjectNameOf, facultyNameOf, timeSlotsOf, roomOf,
  WEEK, toMin, fmtRange, nextMeeting, weeklyHours, dayLabel, timeAgo, fileKind,
  FILE_KIND_NAMES, fmtSize, generateClassSlug,
} from '../components/classSpaces/classMeta';
import {
  Avatar, FileBadge, WeekRhythm, NextPill, TodayRail, ClassCard, GridSkeleton,
} from '../components/classSpaces/ClassVisuals';
import FolderGlyph from '../components/classSpaces/FolderGlyph';

const findClassBySlug = (classes, slug) => classes.find((cs) => generateClassSlug(cs) === slug);

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

/** Static placeholder rows while a class's posts load (no pulse). */
const PostSkeleton = ({ count = 3 }) => (
  <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: count }).map((_, n) => (
      <div key={n} className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
          <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
          <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-700" />
        </div>
      </div>
    ))}
  </div>
);

/** Long posts fold to a few lines with a "Show more". */
const Expandable = ({ text }) => {
  const [open, setOpen] = useState(false);
  const long = (text || '').length > 320 || (text || '').split('\n').length > 5;
  return (
    <div>
      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300 ${long && !open ? 'line-clamp-4' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white">
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

const IconButton = ({ title, onClick, danger, children }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
    className={`rounded-lg p-1.5 text-gray-400 transition-colors ${
      danger ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30' : 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
    }`}
  >
    {children}
  </button>
);

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

const Empty = ({ icon: Icon, title, children }) => (
  <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-700">
    <Icon className="mx-auto mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" />
    <p className="font-medium text-gray-700 dark:text-gray-200">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{children}</p>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const ClassSpacePage = () => {
  const { user } = useAuth();
  const { getPageState, savePageState } = usePageState();
  const { classSlug } = useParams();
  const navigate = useNavigate();

  const savedState = getPageState('classSpaces', { searchTerm: '', filterSection: 'all' });

  const [classSpaces, setClassSpaces] = useState([]);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [activeTab, setActiveTab] = useState('board');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [searchTerm, setSearchTerm] = useState(savedState.searchTerm);
  const [filterSection, setFilterSection] = useState(savedState.filterSection);
  const [fileQuery, setFileQuery] = useState('');
  const [fileKindFilter, setFileKindFilter] = useState('all');
  const [peopleQuery, setPeopleQuery] = useState('');

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showLeaveSectionConfirm, setShowLeaveSectionConfirm] = useState(false);

  const lastLoadedClassId = useRef(null);
  const [canPostHere, setCanPostHere] = useState(false);
  const [studentType, setStudentType] = useState(null);
  const [joinHint, setJoinHint] = useState(null);

  // Re-render once a minute so "in 25 min" and the live bars stay current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const isFaculty = user?.role === 'faculty';
  const isStudent = user?.role === 'student';
  const isIrregular = isStudent && studentType === 'irregular';
  const isRegular = isStudent && studentType === 'regular';

  const { data: classSpacesResponse, loading: classSpacesLoading, refetch: reloadClassSpaces } = useCachedData(
    () => classSpaceAPI.getMyClasses(),
    `class-spaces-${user?._id}-${user?.role}`,
    {
      cacheDuration: 5 * 60 * 1000,
      enabled: !!user,
      onError: (err) => {
        console.error('Failed to load class spaces:', err);
        toast.error(err.response?.data?.message || 'Failed to load classes');
      },
    }
  );

  useLiveRefresh(['classes', 'schedule'], () => reloadClassSpaces());

  useEffect(() => {
    if (!classSpacesResponse) return;
    const payload = classSpacesResponse;
    if (payload.studentType) setStudentType(payload.studentType);
    if (payload.enrolled === false) {
      setNotEnrolled(true);
      setJoinHint(payload.message || null);
      setClassSpaces([]);
    } else {
      setNotEnrolled(false);
      setJoinHint(null);
      setClassSpaces(payload.data || []);
    }
  }, [classSpacesResponse]);

  // Open the class named in the URL: show the grid's copy at once, then load details
  useEffect(() => {
    if (!classSlug || classSpaces.length === 0) {
      setSelectedClass(null);
      lastLoadedClassId.current = null;
      return;
    }
    const classToOpen = findClassBySlug(classSpaces, classSlug);
    if (!classToOpen) {
      toast.error('Class not found');
      navigate('/classes');
      return;
    }
    if (lastLoadedClassId.current === classToOpen._id) return;
    lastLoadedClassId.current = classToOpen._id;
    setShowLeaveConfirm(false);
    setShowRegenerateConfirm(false);
    setFileQuery('');
    setFileKindFilter('all');
    setPeopleQuery('');
    setSelectedClass({ ...classToOpen, _isLoading: true });

    classSpaceAPI.getById(classToOpen._id)
      .then((response) => {
        setSelectedClass({ ...response.data.data, _isLoading: false });
        setCanPostHere(!!response.data.canPost);
      })
      .catch((error) => {
        console.error('Failed to load class details:', error);
        toast.error(error.response?.data?.message || 'Could not open this class');
        lastLoadedClassId.current = null;
        navigate('/classes');
      });
  }, [classSlug, classSpaces, navigate]);

  useEffect(() => {
    savePageState('classSpaces', { searchTerm, filterSection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterSection]);

  const openClass = (cs, tab = 'board') => {
    navigate(`/classes/${generateClassSlug(cs)}`);
    setActiveTab(tab);
  };

  const refreshSelectedClass = async () => {
    if (!selectedClass) return;
    try {
      const response = await classSpaceAPI.getById(selectedClass._id);
      const updated = response.data.data;
      setSelectedClass(updated);
      setCanPostHere(!!response.data.canPost);
      setClassSpaces((prev) => prev.map((cs) => (cs._id === updated._id ? { ...cs, ...updated } : cs)));
    } catch (error) {
      console.error('Refresh class error:', error);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Class code ${code} copied`);
  };

  const handleRegenerateCode = async () => {
    try {
      const response = await classSpaceAPI.regenerateClassCode(selectedClass._id);
      setSelectedClass((prev) => ({ ...prev, classCode: response.data.data.classCode }));
      toast.success('New class code generated');
      setShowRegenerateConfirm(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not regenerate code');
    }
  };

  const handleLeaveClass = async () => {
    try {
      await classSpaceAPI.leave(selectedClass._id);
      toast.success('Left the class');
      setShowLeaveConfirm(false);
      navigate('/classes');
      reloadClassSpaces();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not leave this class');
    }
  };

  const handleLeaveSection = async () => {
    try {
      await classSpaceAPI.leaveSection();
      toast.success('You have left your section');
      setShowLeaveSectionConfirm(false);
      setClassSpaces([]);
      setStudentType(null);
      reloadClassSpaces();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not leave your section');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setShowAnnouncementModal(false);
    setShowMaterialModal(false);
    setShowEnrollModal(false);
    setEditingAnnouncement(null);
    if (shouldRefresh === 'reload') reloadClassSpaces();
    else if (shouldRefresh) refreshSelectedClass();
  };

  /** "Are you sure?" toast for deleting posts and files. */
  const confirmDeleteToast = ({ title, name, action, successMsg, errorMsg }) => {
    toast((t) => (
      <div className="flex w-full flex-col gap-4 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="mb-1 break-words text-sm text-gray-600 dark:text-gray-300">Delete "{name}"?</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">This can't be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => toast.dismiss(t.id)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Cancel</button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await action();
                toast.success(successMsg);
                refreshSelectedClass();
              } catch (error) {
                console.error(errorMsg, error);
                toast.error(error.response?.data?.message || errorMsg);
              }
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center',
      style: { background: 'transparent', boxShadow: 'none', padding: 0, maxWidth: 'none', width: 'min(440px, calc(100vw - 32px))' },
    });
  };

  const handleDeleteAnnouncement = (announcement) => confirmDeleteToast({
    title: 'Delete post',
    name: announcement.title,
    successMsg: 'Post deleted',
    errorMsg: 'Failed to delete post',
    action: () => classSpaceAPI.deleteAnnouncement(selectedClass._id, announcement._id || announcement),
  });

  const handleDeleteMaterial = (material) => confirmDeleteToast({
    title: 'Delete file',
    name: material.title || material.fileName,
    successMsg: 'File deleted',
    errorMsg: 'Failed to delete file',
    action: () => classSpaceAPI.deleteMaterial(selectedClass._id, material._id || material),
  });

  const handleDownloadMaterial = async (material) => {
    try {
      const response = await fetch(resolveUploadUrl(material.fileUrl));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = material.fileName || material.title || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(getErrorMessage(error, 'Failed to download file'));
    }
  };

  /* ---- Grid data --------------------------------------------------- */

  const sectionCounts = useMemo(() => {
    const m = {};
    classSpaces.forEach((cs) => { if (cs.sectionCode) m[cs.sectionCode] = (m[cs.sectionCode] || 0) + 1; });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [classSpaces]);

  const filteredClasses = classSpaces.filter((cs) => {
    const q = searchTerm.toLowerCase().trim();
    const searchMatch = !q || [subjectCodeOf(cs), subjectNameOf(cs), cs.sectionCode, facultyNameOf(cs), roomOf(cs)]
      .some((v) => (v || '').toLowerCase().includes(q));
    return searchMatch && (filterSection === 'all' || cs.sectionCode === filterSection);
  });

  const groupedClasses = Object.entries(
    filteredClasses.reduce((acc, cs) => {
      const key = cs.sectionCode || 'Unassigned';
      (acc[key] = acc[key] || []).push(cs);
      return acc;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b));

  // Folders at the top level for staff with many sections; searching lists flat
  const showFolderGrid = !isStudent && filterSection === 'all' && !searchTerm.trim() && groupedClasses.length > 1;

  const weekStats = useMemo(() => {
    const slots = classSpaces.flatMap(timeSlotsOf);
    return { meetings: slots.length, hours: weeklyHours(slots) };
  }, [classSpaces]);

  const termLabel = classSpaces[0]
    ? `${classSpaces[0].semester === 2 ? '2nd' : '1st'} semester · ${classSpaces[0].academicYear || ''}`
    : null;

  /* ---- Detail data ------------------------------------------------- */

  const announcements = useMemo(() => [...(selectedClass?.announcements || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [selectedClass]);
  const pinned = announcements.filter((a) => a.isPinned);
  const materials = useMemo(() => [...(selectedClass?.materials || [])]
    .sort((a, b) => new Date(b.createdAt || b.uploadedAt) - new Date(a.createdAt || a.uploadedAt)), [selectedClass]);

  // Board: everything not pinned, newest first, grouped under day headings
  const boardDays = useMemo(() => {
    const items = [
      ...announcements.filter((a) => !a.isPinned).map((a) => ({ type: 'post', data: a, at: new Date(a.createdAt) })),
      ...materials.map((m) => ({ type: 'file', data: m, at: new Date(m.createdAt || m.uploadedAt) })),
    ].sort((a, b) => b.at - a.at);
    const days = [];
    items.forEach((it) => {
      const label = dayLabel(it.at);
      const last = days[days.length - 1];
      if (last && last.label === label) last.items.push(it);
      else days.push({ label, items: [it] });
    });
    return days;
  }, [announcements, materials]);

  const confirmPhrase = subjectNameOf(selectedClass) || subjectCodeOf(selectedClass);
  const confirmDialogs = (
    <>
      <TypeToConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveClass}
        title="Leave this subject?"
        message="You will lose access to all posts, files and announcements in this class."
        confirmationText={confirmPhrase}
        confirmButtonText="Leave class"
        cancelButtonText="Cancel"
        type="danger"
        placeholder="Type the subject name to confirm"
      />
      <TypeToConfirmDialog
        isOpen={showRegenerateConfirm}
        onClose={() => setShowRegenerateConfirm(false)}
        onConfirm={handleRegenerateCode}
        title="Generate a new class code?"
        message="The current code stops working immediately. Students using the old code won't be able to join."
        confirmationText={confirmPhrase}
        confirmButtonText="Generate new code"
        cancelButtonText="Cancel"
        type="warning"
        placeholder="Type the subject name to confirm"
      />
    </>
  );

  /* ================================================================ *
   * Detail view
   * ================================================================ */
  if (selectedClass) {
    const code = subjectCodeOf(selectedClass);
    const hex = accentFor(code);
    const name = subjectNameOf(selectedClass);
    const teacher = facultyNameOf(selectedClass);
    const teacherUser = selectedClass.faculty?.user;
    const canManage = canPostHere;
    const slots = timeSlotsOf(selectedClass);
    const room = roomOf(selectedClass);
    const next = nextMeeting(slots);
    const isLoading = selectedClass._isLoading;
    const studentCount = selectedClass.enrolledStudents?.length ?? selectedClass.enrolledCount ?? 0;
    const units = selectedClass.subject?.units;

    const kindsPresent = FILE_KIND_NAMES.filter((k) => materials.some((m) => fileKind(m).kind === k));
    const visibleFiles = materials.filter((m) => {
      const q = fileQuery.toLowerCase().trim();
      const okQ = !q || [m.title, m.fileName, m.description].some((v) => (v || '').toLowerCase().includes(q));
      return okQ && (fileKindFilter === 'all' || fileKind(m).kind === fileKindFilter);
    });
    const roster = (selectedClass.enrolledStudents || []).filter((enr) => {
      const q = peopleQuery.toLowerCase().trim();
      if (!q) return true;
      const u = enr.student?.user;
      return [`${u?.firstName || ''} ${u?.lastName || ''}`, enr.student?.studentId].some((v) => (v || '').toLowerCase().includes(q));
    }).sort((a, b) => (a.student?.user?.lastName || '').localeCompare(b.student?.user?.lastName || ''));

    const tabs = [
      { key: 'board', label: 'Board', icon: LayoutList, count: announcements.length + materials.length },
      { key: 'files', label: 'Files', icon: Paperclip, count: materials.length },
      { key: 'people', label: 'People', icon: Users, count: studentCount },
    ];

    const sortedSlots = [...slots].sort((a, b) => WEEK.indexOf(a.day) - WEEK.indexOf(b.day) || toMin(a.startTime) - toMin(b.startTime));

    const renderPost = (a, pinnedStyle) => (
      <div
        key={a._id}
        className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${pinnedStyle ? '' : 'border-gray-200 dark:border-gray-700'}`}
        style={pinnedStyle ? { borderColor: tint(hex, 0.35), background: undefined } : undefined}
      >
        <div className="flex items-start gap-3">
          <Avatar name={`${a.postedBy?.firstName || ''} ${a.postedBy?.lastName || ''}`} size={36} hex={hex} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{a.postedBy?.firstName} {a.postedBy?.lastName}</span>
                <span title={new Date(a.createdAt).toLocaleString()}> · {timeAgo(a.createdAt)}</span>
                {a.editedAt && <span> · edited</span>}
              </div>
              {canManage && (
                <div className="-mr-1 -mt-1 flex flex-shrink-0">
                  <IconButton title="Edit post" onClick={() => { setEditingAnnouncement(a); setShowAnnouncementModal(true); }}><Edit2 className="h-4 w-4" /></IconButton>
                  <IconButton title="Delete post" danger onClick={() => handleDeleteAnnouncement(a)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              )}
            </div>
            <p className="mt-1 break-words font-semibold text-gray-900 dark:text-white">{a.title}</p>
            <div className="mt-1"><Expandable text={a.content} /></div>
          </div>
        </div>
      </div>
    );

    const renderFile = (m, compact) => (
      <div key={m._id} className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600">
        <FileBadge material={m} size={compact ? 38 : 42} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 dark:text-white">{m.title || m.fileName}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[m.fileName !== m.title ? m.fileName : null, fmtSize(m.fileSize), timeAgo(m.createdAt || m.uploadedAt)].filter(Boolean).join(' · ')}
          </p>
          {!compact && m.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{m.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => handleDownloadMaterial(m)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors"
          style={{ color: hex, background: tint(hex, 0.08) }}
          title="Download"
        >
          <Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span>
        </button>
        {canManage && <IconButton title="Delete file" danger onClick={() => handleDeleteMaterial(m)}><Trash2 className="h-4 w-4" /></IconButton>}
      </div>
    );

    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <button type="button" onClick={() => navigate('/classes')} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-gray-200/70 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white">
                <ChevronLeft className="h-4 w-4" /> Classes
              </button>
              {selectedClass.sectionCode && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                  <button
                    type="button"
                    onClick={() => { if (!isStudent) setFilterSection(selectedClass.sectionCode); navigate('/classes'); }}
                    className="rounded-lg px-1.5 py-1 hover:bg-gray-200/70 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    {selectedClass.sectionCode}
                  </button>
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
              <span className="truncate font-mono font-semibold text-gray-900 dark:text-white">{code}</span>
            </nav>

            {/* Header: identity on the left, where the class stands on the right */}
            <header className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: hex }} />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full"
                style={{ background: `radial-gradient(closest-side, ${tint(hex, 0.16)}, transparent)` }}
              />
              <div className="relative flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg px-2.5 py-1 font-mono text-sm font-bold tracking-wide" style={{ background: tint(hex, 0.12), color: hex }}>{code}</span>
                    {units != null && <span className="text-xs font-medium text-gray-400">{units} {units === 1 ? 'unit' : 'units'}</span>}
                    {isIrregular && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Joined by subject</span>}
                  </div>
                  <h1 className="mt-3 break-words text-2xl font-bold leading-tight text-gray-900 dark:text-white sm:text-3xl">{name || code}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {teacher && (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={teacher} picture={teacherUser?.profilePicture} size={24} hex={hex} />{teacher}
                      </span>
                    )}
                    {selectedClass.sectionCode && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-gray-400" />{selectedClass.sectionCode}</span>}
                    {room && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-gray-400" />{room}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-start gap-2 md:items-end">
                  {next ? <NextPill next={next} hex={hex} className="!text-sm" /> : <span className="text-sm text-gray-400">No meeting times set</span>}
                  {isIrregular && (
                    <button type="button" onClick={() => setShowLeaveConfirm(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                      <LogOut className="h-3.5 w-3.5" /> Leave subject
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented tabs */}
              <div className="relative border-t border-gray-100 px-3 dark:border-gray-700/70 sm:px-5">
                <div role="tablist" className="flex gap-1 overflow-x-auto py-2">
                  {tabs.map((t) => {
                    const on = activeTab === t.key;
                    return (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={on}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium transition-colors sm:flex-none sm:gap-2 sm:px-3.5 ${on ? '' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'}`}
                        style={on ? { background: tint(hex, 0.1), color: hex } : undefined}
                      >
                        <t.icon className="hidden h-4 w-4 sm:block" />{t.label}
                        <span className={`rounded-md px-1.5 text-[11px] font-semibold ${on ? '' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`} style={on ? { background: tint(hex, 0.15) } : undefined}>{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* ---------------- Main column ---------------- */}
              <main className="min-w-0 space-y-4">
                {activeTab === 'board' && (
                  <>
                    {canManage && (
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                        <Avatar name={`${user?.firstName || ''} ${user?.lastName || ''}`} picture={user?.profilePicture} size={36} hex={hex} />
                        <button
                          type="button"
                          onClick={() => { setEditingAnnouncement(null); setShowAnnouncementModal(true); }}
                          className="min-w-0 flex-1 truncate rounded-xl bg-gray-100 px-4 py-2.5 text-left text-sm text-gray-500 transition-colors hover:bg-gray-200/80 dark:bg-gray-700/60 dark:text-gray-400 dark:hover:bg-gray-700"
                        >
                          Post an update to {selectedClass.sectionCode || 'this class'}…
                        </button>
                        <button type="button" onClick={() => setShowMaterialModal(true)} title="Share a file" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                          <Paperclip className="h-4 w-4" /><span className="hidden sm:inline">File</span>
                        </button>
                      </div>
                    )}

                    {isLoading ? <PostSkeleton /> : (
                      <>
                        {pinned.length > 0 && (
                          <section>
                            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: hex }}>
                              <Pin className="h-3.5 w-3.5" /> Pinned
                            </h3>
                            <div className="space-y-3">{pinned.map((a) => renderPost(a, true))}</div>
                          </section>
                        )}

                        {boardDays.length === 0 && pinned.length === 0 ? (
                          <Empty icon={Megaphone} title="The board is empty">
                            {canManage ? 'Post an update or share a file. Everyone in the class sees it here.' : 'Updates and files from your teacher will show up here.'}
                          </Empty>
                        ) : (
                          boardDays.map((day) => (
                            <section key={day.label}>
                              <div className="mb-2 flex items-center gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{day.label}</span>
                                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                              </div>
                              <ol className="relative space-y-3 border-l-2 border-gray-200 pl-5 dark:border-gray-700">
                                {day.items.map((it) => (
                                  <li key={`${it.type}-${it.data._id}`} className="relative">
                                    <span
                                      className="absolute -left-[29px] top-4 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-gray-50 dark:ring-gray-900"
                                      style={{ background: it.type === 'post' ? hex : fileKind(it.data).hex }}
                                    />
                                    {it.type === 'post' ? renderPost(it.data) : renderFile(it.data, true)}
                                  </li>
                                ))}
                              </ol>
                            </section>
                          ))
                        )}
                      </>
                    )}
                  </>
                )}

                {activeTab === 'files' && (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <SearchField value={fileQuery} onChange={setFileQuery} placeholder="Search files" className="flex-1" />
                      {canManage && (
                        <button type="button" onClick={() => setShowMaterialModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ background: hex }}>
                          <Plus className="h-4 w-4" /> Share file
                        </button>
                      )}
                    </div>
                    {kindsPresent.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {['all', ...kindsPresent].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setFileKindFilter(k)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${fileKindFilter === k ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'}`}
                          >
                            {k === 'all' ? `All ${materials.length}` : `${k} ${materials.filter((m) => fileKind(m).kind === k).length}`}
                          </button>
                        ))}
                      </div>
                    )}
                    {isLoading ? <PostSkeleton count={2} /> : visibleFiles.length === 0 ? (
                      <Empty icon={FolderOpen} title={materials.length ? 'No files match' : 'No files yet'}>
                        {materials.length ? 'Try another search or type.' : canManage ? 'Share slides, handouts and readings for the class.' : 'Files your teacher shares will appear here.'}
                      </Empty>
                    ) : (
                      <div className="space-y-2">{visibleFiles.map((m) => renderFile(m))}</div>
                    )}
                  </>
                )}

                {activeTab === 'people' && (
                  <div className="space-y-4">
                    {teacher && (
                      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <Avatar name={teacher} picture={teacherUser?.profilePicture} size={52} hex={hex} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: hex }}>Teacher</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{teacher}</p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {selectedClass.faculty?.employeeId && <span>{selectedClass.faculty.employeeId}</span>}
                            {teacherUser?.email && <a href={`mailto:${teacherUser.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3.5 w-3.5" />{teacherUser.email}</a>}
                            {teacherUser?.phoneNumber && <a href={`tel:${teacherUser.phoneNumber}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3.5 w-3.5" />{teacherUser.phoneNumber}</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {!selectedClass.enrolledStudents ? (
                      <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold" style={{ background: tint(hex, 0.12), color: hex }}>{studentCount}</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{studentCount === 1 ? 'student' : 'students'} in this class</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">The class list is visible to your teacher.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Students <span className="font-normal text-gray-400">{studentCount}</span></h3>
                          {studentCount > 6 && <SearchField value={peopleQuery} onChange={setPeopleQuery} placeholder="Find a student" className="w-56" />}
                        </div>
                        {isLoading ? <PostSkeleton count={2} /> : studentCount === 0 ? (
                          <Empty icon={UserPlus} title="No students yet">Students appear here once they join with the section or class code.</Empty>
                        ) : roster.length === 0 ? (
                          <Empty icon={Search} title="No one matches that search" />
                        ) : (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {roster.map((enr, i) => {
                              const u = enr.student?.user;
                              const full = `${u?.firstName || '?'} ${u?.lastName || ''}`.trim();
                              return (
                                <div key={enr.student?._id || i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                                  <Avatar name={full} picture={u?.profilePicture} size={34} hex="#64748b" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{full}</p>
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{enr.student?.studentId}</p>
                                  </div>
                                  {enr.enrollmentType === 'subject' && (
                                    <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" title="Joined this subject only">Irregular</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </main>

              {/* ---------------- Side column ---------------- */}
              <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white"><CalendarDays className="h-4 w-4 text-gray-400" /> This week</h3>
                    {slots.length > 0 && <span className="text-xs text-gray-400">{weeklyHours(slots)} h · {slots.length}×</span>}
                  </div>
                  {slots.length ? (
                    <>
                      <WeekRhythm slots={slots} hex={hex} />
                      <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
                        {sortedSlots.map((s, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-700 dark:text-gray-200">{s.day}</span>
                            <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtRange(s)}</span>
                          </li>
                        ))}
                      </ul>
                      {room && (
                        <p className="mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm" style={{ background: tint(hex, 0.07) }}>
                          <MapPin className="h-4 w-4" style={{ color: hex }} />
                          <span className="text-gray-700 dark:text-gray-200">Room <strong>{room}</strong></span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No meeting times have been set for this class.</p>
                  )}
                </section>

                {selectedClass.classCode && (
                  <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white"><KeyRound className="h-4 w-4 text-gray-400" /> Subject code</h3>
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Irregular students join just this subject with it.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-xl border border-dashed px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.25em]" style={{ borderColor: tint(hex, 0.45), color: hex }}>
                        {selectedClass.classCode}
                      </code>
                      <IconButton title="Copy code" onClick={() => handleCopyCode(selectedClass.classCode)}><Copy className="h-4 w-4" /></IconButton>
                      {canManage && <IconButton title="Generate a new code" onClick={() => setShowRegenerateConfirm(true)}><RefreshCw className="h-4 w-4" /></IconButton>}
                    </div>
                  </section>
                )}

                <section className="grid grid-cols-3 divide-x divide-gray-100 rounded-2xl border border-gray-200 bg-white text-center dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                  {[
                    { label: 'Posts', value: announcements.length, tab: 'board' },
                    { label: 'Files', value: materials.length, tab: 'files' },
                    { label: 'Students', value: studentCount, tab: 'people' },
                  ].map((s) => (
                    <button key={s.label} type="button" onClick={() => setActiveTab(s.tab)} className="px-2 py-3 hover:bg-gray-50 first:rounded-l-2xl last:rounded-r-2xl dark:hover:bg-gray-700/50">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{isLoading && s.tab !== 'people' ? '–' : s.value}</p>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{s.label}</p>
                    </button>
                  ))}
                </section>
              </aside>
            </div>
          </div>
        </div>

        {showAnnouncementModal && <CreateAnnouncementModal classSpaceId={selectedClass._id} announcement={editingAnnouncement} onClose={handleModalClose} />}
        {showMaterialModal && <UploadMaterialModal classSpaceId={selectedClass._id} onClose={handleModalClose} />}
        {confirmDialogs}
      </Layout>
    );
  }

  /* ================================================================ *
   * Grid view
   * ================================================================ */
  const hasClasses = classSpaces.length > 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              {termLabel && <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{termLabel}</p>}
              <div className="mt-0.5 flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{isStudent ? 'My Classes' : 'Class Spaces'}</h1>
                {isIrregular && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Irregular</span>}
              </div>
              {hasClasses && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {classSpaces.length} {classSpaces.length === 1 ? 'class' : 'classes'}
                  {sectionCounts.length > 1 && ` across ${sectionCounts.length} sections`}
                  {weekStats.meetings > 0 && ` · ${weekStats.meetings} meetings, ${weekStats.hours} h a week`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasClasses && <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Subject, section, teacher, room" className="flex-1 md:w-72 md:flex-none" />}
              {isRegular && !notEnrolled && (
                <button type="button" onClick={() => setShowLeaveSectionConfirm(true)} title="Leave your section" className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-red-900/30">
                  <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Leave section</span>
                </button>
              )}
              {isStudent && !isRegular && hasClasses && (
                <button
                  type="button"
                  onClick={() => { if (!studentType) setStudentType('irregular'); setShowEnrollModal(true); }}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">Join subject</span>
                </button>
              )}
            </div>
          </div>

          {classSpacesLoading && !hasClasses ? <GridSkeleton /> : (
            <>
              {hasClasses && (isStudent || isFaculty) && <TodayRail classes={classSpaces} onOpen={(cs) => openClass(cs)} />}

              {/* Section chips (replace the old dropdown) */}
              {sectionCounts.length > 1 && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {[['all', classSpaces.length], ...sectionCounts].map(([sec, n]) => {
                    const on = filterSection === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setFilterSection(sec)}
                        className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700'}`}
                      >
                        {sec === 'all' ? 'All sections' : sec}
                        <span className={`text-xs ${on ? 'opacity-70' : 'text-gray-400'}`}>{n}</span>
                        {on && sec !== 'all' && <X className="h-3.5 w-3.5 opacity-70" onClick={(e) => { e.stopPropagation(); setFilterSection('all'); }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredClasses.length === 0 ? (
                isStudent && notEnrolled ? (
                  <div className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800 sm:p-10">
                    <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900"><KeyRound className="h-6 w-6" /></span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Join your classes</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                      {joinHint || 'Pick how you\'re enrolled this term. Your teacher or program office can give you the code.'}
                    </p>
                    <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
                      {[
                        { type: 'regular', icon: Users, title: 'I have a section code', body: 'Regular students. You get every subject of your section at once.', hex: '#2563eb' },
                        { type: 'irregular', icon: BookOpen, title: 'I have a subject code', body: 'Irregular students. Add your subjects one at a time.', hex: '#2563eb' },
                      ].map((o) => (
                        <button
                          key={o.type}
                          type="button"
                          onClick={() => { setStudentType(o.type); setShowEnrollModal(true); }}
                          className="group rounded-2xl border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700"
                        >
                          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: tint(o.hex, 0.12), color: o.hex }}><o.icon className="h-5 w-5" /></span>
                          <p className="font-semibold text-gray-900 dark:text-white">{o.title}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{o.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : isStudent ? (
                  <Empty icon={CalendarDays} title="No subjects published yet">
                    You're in your section. Your subjects appear here once the schedule is published.
                  </Empty>
                ) : searchTerm ? (
                  <Empty icon={Search} title="No classes match your search">Try a subject code, section, teacher or room.</Empty>
                ) : (
                  <Empty icon={BookOpen} title="No class spaces yet">
                    {isFaculty ? 'A class space appears here for each published class you teach.' : 'Every subject in a schedule gets its own class space.'}
                  </Empty>
                )
              ) : showFolderGrid ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {groupedClasses.map(([sectionCode, classes]) => (
                    <button
                      key={sectionCode}
                      type="button"
                      onClick={() => setFilterSection(sectionCode)}
                      title={`Open ${sectionCode}: ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}
                      className="group flex flex-col items-center gap-1 rounded-2xl p-3 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-800"
                    >
                      <FolderGlyph />
                      <span className="mt-1 w-full truncate text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{sectionCode}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{classes.length} {classes.length === 1 ? 'class' : 'classes'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredClasses.map((cs) => (
                    <ClassCard key={cs._id} cs={cs} onOpen={(c) => openClass(c)} showSection={filterSection === 'all' && !isStudent} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showEnrollModal && <EnrollModal studentType={studentType} onClose={handleModalClose} />}

      <TypeToConfirmDialog
        isOpen={showLeaveSectionConfirm}
        onClose={() => setShowLeaveSectionConfirm(false)}
        onConfirm={handleLeaveSection}
        title="Leave your section?"
        message="You'll be removed from your section and lose access to ALL of its subject classes, posts and files. You'll need your section code to join again."
        confirmationText={classSpaces[0]?.sectionCode || 'LEAVE'}
        confirmButtonText="Leave section"
        cancelButtonText="Cancel"
        type="danger"
        placeholder={classSpaces[0]?.sectionCode ? 'Type the section code to confirm' : 'Type LEAVE to confirm'}
      />
    </Layout>
  );
};

export default ClassSpacePage;
