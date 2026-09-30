import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Layout from '../components/Layout';
import { classSpaceAPI, resolveUploadUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePageState } from '../context/PageStateContext';
import toast from 'react-hot-toast';
import {
  BookOpen, Bell, FileText, Users, Plus, Upload,
  UserPlus, Search, Download, Trash2, Pin,
  User, X, Edit2, ChevronLeft, Copy, RefreshCw,
  TrendingUp, MessageSquare, FolderOpen, Clock, MapPin, LogOut
} from 'lucide-react';
import CreateAnnouncementModal from '../components/CreateAnnouncementModal';
import UploadMaterialModal from '../components/UploadMaterialModal';
import EnrollModal from '../components/EnrollModal';
import ConfirmDialog from '../components/ConfirmDialog';

/* Fields are denormalised onto the ClassSpace, so read subject/faculty/section
   directly and fall back to the populated schedule only for time/room. */
const subjectCodeOf = (cs) => cs?.subject?.subjectCode || cs?.sectionCode || 'Class';
const subjectNameOf = (cs) => cs?.subject?.subjectName || '';
const facultyNameOf = (cs) => {
  const u = cs?.faculty?.user;
  return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : null;
};
const timeSlotsOf = (cs) => cs?.schedule?.timeSlots || [];

/**
 * One-line summary of when a class meets.
 *
 * A class holds every meeting time for the subject, so showing only the first
 * one ("Monday 08:00-09:00 +2") hid the days that matter most at a glance.
 */
const summariseSlots = (slots) => {
  if (slots.length === 1) {
    const s = slots[0];
    return `${s.day.slice(0, 3)} ${s.startTime}-${s.endTime}`;
  }
  const days = [...new Set(slots.map((s) => s.day.slice(0, 3)))].join(', ');
  return `${days} · ${slots.length} meetings`;
};
const fmtSize = (bytes) => {
  if (!bytes) return '';
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Card header colors — cycles through for variety like Google Classroom
const CARD_COLORS = [
  'bg-blue-600',
  'bg-green-700',
  'bg-purple-700',
  'bg-teal-700',
  'bg-red-700',
  'bg-orange-600',
  'bg-indigo-700',
  'bg-pink-700',
  'bg-cyan-700',
  'bg-emerald-700',
];

const ClassSpacePage = () => {
  const { user } = useAuth();
  const { getPageState, savePageState } = usePageState();
  
  // Get saved state or use defaults
  const savedState = getPageState('classSpaces', {
    searchTerm: '',
    filterSection: 'all'
  });

  const [classSpaces, setClassSpaces] = useState([]);
  const [notEnrolled, setNotEnrolled] = useState(false); // student has no sectionCode yet
  const [selectedClass, setSelectedClass] = useState(null); // null = grid view
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stream');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [searchTerm, setSearchTerm] = useState(savedState.searchTerm);
  const [filterSection, setFilterSection] = useState(savedState.filterSection);
  
  // Whether the server says the current user may post in the open class
  const [canPostHere, setCanPostHere] = useState(false);
  const [studentType, setStudentType] = useState(null); // null until backend tells us or student chooses
  const [joinHint, setJoinHint] = useState(null);

  const isFaculty = user?.role === 'faculty';
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin' || user?.role === 'scheduling_officer';
  const isManager = user?.role === 'program_manager';
  const isIrregular = isStudent && studentType === 'irregular';

  useEffect(() => {
    loadClassSpaces();
  }, []);

  // Save filter/search state when they change
  useEffect(() => {
    savePageState('classSpaces', {
      searchTerm,
      filterSection
    });
  }, [searchTerm, filterSection]); // Removed savePageState from dependencies

  const loadClassSpaces = async () => {
    try {
      setLoading(true);
      // Everyone uses /my-classes: it resolves per role on the server.
      // Students are never allowed to list all class spaces.
      const response = await classSpaceAPI.getMyClasses();
      const payload = response.data;

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
    } catch (error) {
      console.error('Load class spaces error:', error);
      toast.error(error.response?.data?.message || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  const openClass = async (cs) => {
    setActiveTab('stream');
    try {
      // Fetch the full record: the list response omits announcements/materials
      const response = await classSpaceAPI.getById(cs._id);
      setSelectedClass(response.data.data);
      setCanPostHere(!!response.data.canPost);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not open this class');
    }
  };

  const refreshSelectedClass = async () => {
    if (!selectedClass) return;
    try {
      const response = await classSpaceAPI.getById(selectedClass._id);
      const updated = response.data.data;
      setSelectedClass(updated);
      setCanPostHere(!!response.data.canPost);
      setClassSpaces(prev => prev.map(cs => (cs._id === updated._id ? { ...cs, ...updated } : cs)));
    } catch (error) {
      console.error('Refresh class error:', error);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code);
    toast.success(`Class code ${code} copied`);
  };

  const handleRegenerateCode = async () => {
    if (!window.confirm('Generate a new class code? The old code stops working.')) return;
    try {
      const response = await classSpaceAPI.regenerateClassCode(selectedClass._id);
      setSelectedClass(prev => ({ ...prev, classCode: response.data.data.classCode }));
      toast.success('New class code generated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not regenerate code');
    }
  };

  const handleLeaveClass = async () => {
    if (!window.confirm('Leave this subject? You will lose access to its posts.')) return;
    try {
      await classSpaceAPI.leave(selectedClass._id);
      toast.success('Left the class');
      setSelectedClass(null);
      loadClassSpaces();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not leave this class');
    }
  };

  const handleModalClose = (shouldRefresh) => {
    setShowAnnouncementModal(false);
    setShowMaterialModal(false);
    setShowEnrollModal(false);
    setEditingAnnouncement(null);
    if (shouldRefresh === 'reload') loadClassSpaces();
    else if (shouldRefresh) refreshSelectedClass();
  };

  const handleDeleteAnnouncement = async (announcement) => {
    // Create a custom toast with confirm/cancel buttons
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Delete Announcement</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Are you sure you want to delete "{announcement.title}"?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const announcementId = announcement._id || announcement;
                await classSpaceAPI.deleteAnnouncement(selectedClass._id, announcementId);
                toast.success('Announcement deleted successfully');
                refreshSelectedClass();
              } catch (error) {
                console.error('Delete announcement error:', error);
                toast.error(error.response?.data?.message || 'Failed to delete announcement');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center',
      style: {
        minWidth: '400px',
        maxWidth: '500px',
        background: 'rgb(254, 254, 255)', // dark:bg-gray-800
        color: 'white',
        borderRadius: '1rem',
        padding: '0.5rem',
      },
    });
  };

  const handleDownloadMaterial = async (material) => {
    try {
      const fileUrl = resolveUploadUrl(material.fileUrl);
      const fileName = material.fileName || material.title || 'download';
      
      // Fetch the file as a blob
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      
      // Create a temporary download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleDeleteMaterial = async (material) => {
    // Create a custom toast with confirm/cancel buttons
    toast((t) => (
      <div className="flex flex-col gap-3 p-2">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Delete Material</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Are you sure you want to delete "{material.title || material.fileName}"?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const materialId = material._id || material;
                await classSpaceAPI.deleteMaterial(selectedClass._id, materialId);
                toast.success('Material deleted successfully');
                refreshSelectedClass();
              } catch (error) {
                console.error('Delete material error:', error);
                toast.error(error.response?.data?.message || 'Failed to delete material');
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      position: 'top-center',
      style: {
        minWidth: '400px',
        maxWidth: '500px',
        background: 'rgb(241, 244, 249)', // dark:bg-gray-800
        color: 'white',
        borderRadius: '1rem',
        padding: '0.5rem',
      },
    });
  };

  // Get unique sections for filter
  const uniqueSections = ['all', ...new Set(classSpaces.map(cs => cs.sectionCode).filter(Boolean))].sort();

  const filteredClasses = classSpaces.filter(cs => {
    const q = searchTerm.toLowerCase();
    const searchMatch = (
      subjectCodeOf(cs).toLowerCase().includes(q) ||
      subjectNameOf(cs).toLowerCase().includes(q) ||
      (cs.sectionCode || '').toLowerCase().includes(q) ||
      (facultyNameOf(cs) || '').toLowerCase().includes(q)
    );

    const sectionMatch = filterSection === 'all' || cs.sectionCode === filterSection;

    return searchMatch && sectionMatch;
  });

  const sortedAnnouncements = selectedClass?.announcements
    ? [...selectedClass.announcements].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
    : [];

  const sortedMaterials = selectedClass?.materials
    ? [...selectedClass.materials].sort(
        (a, b) => new Date(b.createdAt || b.uploadedAt) - new Date(a.createdAt || a.uploadedAt)
      )
    : [];

  const streamItems = [];
  if (selectedClass) {
    sortedAnnouncements.forEach(ann =>
      streamItems.push({ type: 'announcement', data: ann, timestamp: new Date(ann.createdAt) })
    );
    sortedMaterials.forEach(mat =>
      streamItems.push({
        type: 'material',
        data: mat,
        timestamp: new Date(mat.createdAt || mat.uploadedAt),
      })
    );
    streamItems.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading classes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Detail view (class selected) ─────────────────────────────────────────
  if (selectedClass) {
    const idx = classSpaces.findIndex(cs => cs._id === selectedClass._id);
    const headerColor = CARD_COLORS[(idx < 0 ? 0 : idx) % CARD_COLORS.length];
    const subjectCode = subjectCodeOf(selectedClass);
    const subjectName = subjectNameOf(selectedClass);
    const facultyName = facultyNameOf(selectedClass);
    const canManage = canPostHere;
    const slots = timeSlotsOf(selectedClass);
    // Students receive enrolledCount instead of the roster
    const studentCount =
      selectedClass.enrolledStudents?.length ?? selectedClass.enrolledCount ?? 0;

    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          {/* Top bar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => { setSelectedClass(null); setActiveTab('stream'); }}
              className="flex items-center gap-1 sm:gap-2 flex-shrink-0 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
              {/* "All Classes" is redundant next to the back chevron on mobile */}
              <span className="font-medium hidden sm:inline">All Classes</span>
              <span className="font-medium sm:hidden">Back</span>
            </button>
            <div className="text-gray-300 dark:text-gray-600 flex-shrink-0">|</div>
            <span className="font-semibold text-gray-900 dark:text-white truncate">{subjectCode}</span>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-4 sm:py-6 space-y-4">
            {/* Class header banner */}
            <div className={`${headerColor} rounded-2xl p-5 sm:p-8 text-white relative overflow-hidden`}>
              <div className="relative z-10">
                <p className="text-sm font-medium opacity-80 mb-1">{selectedClass.sectionCode}</p>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1 break-words">{subjectCode}</h1>
                {subjectName && <p className="text-base sm:text-lg opacity-90">{subjectName}</p>}
                {facultyName && <p className="text-sm opacity-75 mt-2">{facultyName}</p>}

                {/* Meeting times come from the linked schedule */}
                {slots.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {slots.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-md text-xs"
                      >
                        <Clock className="w-3 h-3" />
                        {s.day} {s.startTime}-{s.endTime}
                      </span>
                    ))}
                    {selectedClass.schedule?.roomLabel && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 rounded-md text-xs">
                        <MapPin className="w-3 h-3" />
                        {selectedClass.schedule.roomLabel}
                      </span>
                    )}
                  </div>
                )}

                {/* Join code: only staff and the teacher ever receive it */}
                {selectedClass.classCode && (
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-xs opacity-75">Subject class code</span>
                    <code className="px-2 py-1 bg-white/20 rounded font-mono text-sm tracking-widest">
                      {selectedClass.classCode}
                    </code>
                    <button
                      onClick={() => handleCopyCode(selectedClass.classCode)}
                      title="Copy code"
                      className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {canManage && (
                      <button
                        onClick={handleRegenerateCode}
                        title="Generate a new code"
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="absolute right-6 bottom-6 opacity-10">
                <BookOpen className="w-32 h-32" />
              </div>
            </div>

            {/* Irregular students joined this one subject and may drop it */}
            {isIrregular && (
              <div className="flex justify-end">
                <button
                  onClick={handleLeaveClass}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Leave this subject
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {[
                  { key: 'stream', label: 'Stream', icon: TrendingUp, count: streamItems.length },
                  { key: 'materials', label: 'Classwork', icon: FileText, count: sortedMaterials.length },
                  { key: 'people', label: 'People', icon: Users, count: studentCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-all ${
                      activeTab === tab.key
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-[11px] flex-shrink-0">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-6">
                {/* ── Stream Tab ── */}
                {activeTab === 'stream' && (
                  <div className="space-y-4">
                    {canManage && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                          onClick={() => { setEditingAnnouncement(null); setShowAnnouncementModal(true); }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all"
                        >
                          <MessageSquare className="w-5 h-5 flex-shrink-0" />
                          Announce
                        </button>
                        <button
                          onClick={() => setShowMaterialModal(true)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all"
                        >
                          <Upload className="w-5 h-5 flex-shrink-0" />
                          Upload Material
                        </button>
                      </div>
                    )}

                    {streamItems.length === 0 ? (
                      <div className="text-center py-16">
                        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">Nothing posted yet</p>
                      </div>
                    ) : (
                      streamItems.map((item, i) => (
                        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          {item.type === 'announcement' ? (
                            <div className="p-5">
                              {item.data.isPinned && (
                                <div className="flex items-center gap-1 text-blue-600 text-xs font-semibold mb-2">
                                  <Pin className="w-3 h-3" /> Pinned
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Bell className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1 text-sm text-gray-500">
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {item.data.postedBy?.firstName} {item.data.postedBy?.lastName}
                                      </span>
                                      · {new Date(item.data.createdAt).toLocaleDateString()}
                                    </div>
                                    <p className="font-semibold text-gray-900 dark:text-white mb-1">{item.data.title}</p>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-wrap">{item.data.content}</p>
                                  </div>
                                </div>
                                {canManage && (
                                  <div className="flex gap-1">
                                    <button onClick={() => { setEditingAnnouncement(item.data); setShowAnnouncementModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Delete announcement clicked', item.data);
                                        handleDeleteAnnouncement(item.data);
                                      }} 
                                      className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                      type="button"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 flex items-start gap-4">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  Material · {new Date(item.data.createdAt || item.data.uploadedAt).toLocaleDateString()}
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">{item.data.title}</p>
                                {item.data.description && (
                                  <p className="text-sm text-gray-500 mb-2">{item.data.description}</p>
                                )}
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleDownloadMaterial(item.data)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" /> Download
                                  </button>
                                  <span className="text-xs text-gray-400">{fmtSize(item.data.fileSize)}</span>
                                  {canManage && (
                                    <button 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Delete button clicked', item.data);
                                        handleDeleteMaterial(item.data);
                                      }} 
                                      className="ml-auto p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                      type="button"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Classwork Tab ── */}
                {activeTab === 'materials' && (
                  <div>
                    {canManage && (
                      <button
                        onClick={() => setShowMaterialModal(true)}
                        className="w-full mb-5 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all"
                      >
                        <Upload className="w-5 h-5" /> Upload Material
                      </button>
                    )}
                    {sortedMaterials.length === 0 ? (
                      <div className="text-center py-12">
                        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No materials yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedMaterials.map((mat, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">{mat.title}</p>
                              <p className="text-xs text-gray-500">
                                {fmtSize(mat.fileSize)} · {new Date(mat.createdAt || mat.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDownloadMaterial(mat)}
                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900 rounded-lg transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {canManage && (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('Delete button clicked (materials tab)', mat);
                                    handleDeleteMaterial(mat);
                                  }} 
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors cursor-pointer"
                                  type="button"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── People Tab ── */}
                {activeTab === 'people' && (
                  <div className="space-y-4">
                    {/* Instructor */}
                    {facultyName && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Instructor</h3>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-blue-600">
                            {selectedClass.faculty?.user?.profilePicture ? (
                              <img
                                src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${selectedClass.faculty.user.profilePicture}`}
                                alt={facultyName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-sm">
                                {facultyName[0]}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{facultyName}</p>
                            <p className="text-xs text-gray-500">
                              {selectedClass.faculty?.employeeId || 'Instructor'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Students. The server withholds the roster from students,
                        sending only a count, so respect that here. */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Students ({studentCount})
                      </h3>

                      {!selectedClass.enrolledStudents ? (
                        <p className="text-gray-500 text-sm">
                          {studentCount} {studentCount === 1 ? 'classmate' : 'classmates'} in this class.
                        </p>
                      ) : selectedClass.enrolledStudents.length === 0 ? (
                        <div className="text-center py-8">
                          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No students enrolled yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedClass.enrolledStudents.map((enr, i) => {
                            // enrolledStudents[].student is a Student doc whose
                            // name lives on the nested user
                            const student = enr.student;
                            const u = student?.user;
                            const firstName = u?.firstName || '?';
                            const lastName = u?.lastName || '';
                            const profilePicture = u?.profilePicture;
                            return (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-300 dark:bg-gray-600">
                                  {profilePicture ? (
                                    <img
                                      src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${profilePicture}`}
                                      alt={`${firstName} ${lastName}`}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                                      {firstName[0]}{lastName[0] || ''}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-gray-900 dark:text-white text-sm font-medium truncate">
                                    {firstName} {lastName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {student?.studentId}
                                    {enr.enrollmentType === 'subject' && ' · irregular'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showAnnouncementModal && (
          <CreateAnnouncementModal
            classSpaceId={selectedClass._id}
            announcement={editingAnnouncement}
            onClose={handleModalClose}
          />
        )}
        {showMaterialModal && (
          <UploadMaterialModal
            classSpaceId={selectedClass._id}
            onClose={handleModalClose}
          />
        )}
      </Layout>
    );
  }

  // ─── Grid view (no class selected) ────────────────────────────────────────
  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
        {/* Page header. Stacks on mobile: side by side there isn't room for the
            title, a search field and the join button on a ~375px screen. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {isStudent ? 'My Classes' : 'Class Spaces'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search grows to fill the row on mobile, fixed width from sm up */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section Filter */}
        {classSpaces.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Section:
              </label>
              <select
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <option value="all">All Sections</option>
                {uniqueSections
                  .filter(section => section !== 'all')
                  .map(section => {
                    const count = classSpaces.filter(cs => cs.sectionCode === section).length;
                    return (
                      <option key={section} value={section}>
                        {section} ({count})
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Clear Filter Button - only show when filter is active */}
            {filterSection !== 'all' && (
              <button
                onClick={() => setFilterSection('all')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
                Clear Filter
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-10 h-10 text-blue-600" />
            </div>

            {isStudent && notEnrolled ? (
              /* Student has not joined anything yet. Which code they need
                 depends on whether they are regular or irregular. */
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  You haven't joined yet
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md text-center">
                  {joinHint || 'Join your section for regular enrollment, or add subjects individually if you\'re an irregular student.'}
                </p>
                
                {/* Two buttons: Section Code and Subject Code */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                  <button
                    onClick={() => {
                      setStudentType('regular');
                      setShowEnrollModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-md hover:shadow-lg"
                  >
                    <UserPlus className="w-5 h-5" />
                    <div className="text-left">
                      <div>Enter Section Code</div>
                      <div className="text-xs text-blue-100 font-normal">For regular students</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setStudentType('irregular');
                      setShowEnrollModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors shadow-md hover:shadow-lg"
                  >
                    <BookOpen className="w-5 h-5" />
                    <div className="text-left">
                      <div>Enter Subject Code</div>
                      <div className="text-xs text-purple-100 font-normal">For irregular students</div>
                    </div>
                  </button>
                </div>
                
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 max-w-md text-center">
                  <strong>Regular:</strong> Join your section to see all subjects automatically<br />
                  <strong>Irregular:</strong> Add subjects one by one using subject codes
                </p>
              </>
            ) : isStudent && !notEnrolled ? (
              /* Student is enrolled in a section but no schedules published yet */
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No subjects published yet
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                  You're enrolled in your section. Your subjects will appear here once the schedule is published by your administrator.
                </p>
              </>
            ) : searchTerm ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No classes match your search</h2>
                <p className="text-gray-500 dark:text-gray-400">Try a different search term.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No class spaces yet</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                  {isFaculty
                    ? 'A class space appears here for each subject you are assigned to teach.'
                    : 'One class space is created for every subject in a schedule. Add schedules to see them here.'}
                </p>
              </>
            )}
          </div>
        ) : (
          /* Google Classroom-style card grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredClasses.map((cs, index) => {
              const color = CARD_COLORS[index % CARD_COLORS.length];
              const code = subjectCodeOf(cs);
              const name = subjectNameOf(cs);
              const facultyName = facultyNameOf(cs);
              const profilePicture = cs?.faculty?.user?.profilePicture;
              const initials = facultyName
                ? facultyName.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('')
                : null;
              const slots = timeSlotsOf(cs);

              return (
                <div
                  key={cs._id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col"
                  onClick={() => openClass(cs)}
                >
                  {/* Colored header */}
                  <div className={`${color} p-5 relative h-28 flex flex-col justify-between`}>
                    <div className="pr-12">
                      <h3 className="text-white font-bold text-base leading-tight line-clamp-2">
                        {name || code}
                      </h3>
                      <p className="text-white/80 text-xs mt-0.5">{cs.sectionCode}</p>
                      {facultyName && (
                        <p className="text-white/70 text-xs mt-0.5 truncate">{facultyName}</p>
                      )}
                    </div>
                    {/* Instructor avatar */}
                    <div className="absolute bottom-3 right-3 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/40 overflow-hidden">
                      {profilePicture ? (
                        <img
                          src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${profilePicture}`}
                          alt={facultyName || 'Instructor'}
                          className="w-full h-full object-cover"
                        />
                      ) : initials ? (
                        <span className="text-white font-bold text-sm">{initials}</span>
                      ) : (
                        <User className="w-5 h-5 text-white/70" />
                      )}
                    </div>
                  </div>

                  {/* Subject code + meeting time */}
                  <div className="px-4 py-3 flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{code}</p>
                    {name && name !== code && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{name}</p>
                    )}
                    {slots.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {summariseSlots(slots)}
                      </p>
                    )}
                  </div>

                  {/* Bottom action bar */}
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-gray-400">
                      <button
                        onClick={e => { e.stopPropagation(); openClass(cs).then(() => setActiveTab('people')); }}
                        className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                        title="People"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openClass(cs).then(() => setActiveTab('materials')); }}
                        className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                        title="Materials"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Bell className="w-3 h-3" />
                        {cs.announcements?.length || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {cs.materials?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEnrollModal && (
        <EnrollModal studentType={studentType} onClose={handleModalClose} />
      )}
    </Layout>
  );
};

export default ClassSpacePage;
