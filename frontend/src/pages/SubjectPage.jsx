import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { subjectAPI } from '../services/api';
import toast from 'react-hot-toast';
import useCachedData from '../hooks/useCachedData';
import { useCache } from '../context/CacheContext';
import { 
  Plus, Search, Edit2, Trash2, BookOpen, 
  X, GraduationCap, Clock, FileText, Grid3x3, List,
  Layers, TrendingUp, CheckCircle, Upload, Copy
} from 'lucide-react';
import SubjectModal from '../components/SubjectModal';
import ExcelImportModal from '../components/ExcelImportModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../hooks/usePrograms';

const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];
const SUBJECT_TYPES = ['Lecture', 'Laboratory', 'Both'];

const SubjectPage = () => {
  const { user } = useAuth();
  const { programCodes: PROGRAMS } = usePrograms();
  const { invalidateCache } = useCache();
  
  // Use cached data for subjects
  const { 
    data: subjects, 
    loading, 
    refetch: reloadSubjects 
  } = useCachedData(
    () => subjectAPI.getAll({ isActive: true }),
    'subjects-list',
    { 
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      onError: () => toast.error('Failed to load subjects')
    }
  );
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    program: '',
    yearLevel: '',
    semester: '',
    type: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    byProgram: {}
  });

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null
  });

  // Auto-set program filter for program managers
  useEffect(() => {
    if (user?.role === 'program_manager' && user?.program) {
      setFilters(prev => ({ ...prev, program: user.program }));
    }
  }, [user]);

  // PROGRAMS arrives asynchronously, so recompute once it loads
  useEffect(() => {
    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, PROGRAMS]);

  // // Disable body scroll when modal is open
  // useEffect(() => {
  //   if (showModal || showExcelImportModal) {
  //     document.body.style.overflow = 'hidden';
  //   } else {
  //     document.body.style.overflow = 'unset';
  //   }
  //   return () => {
  //     document.body.style.overflow = 'unset';
  //   };
  // }, [showModal, showExcelImportModal]);

  const calculateStats = () => {
    if (!subjects || !Array.isArray(subjects)) {
      // Keep existing stats if subjects not loaded yet
      return;
    }
    
    const byProgram = {};
    PROGRAMS.forEach(prog => {
      byProgram[prog] = subjects.filter(s => s.program === prog).length;
    });

    setStats({
      total: subjects.length,
      active: subjects.filter(s => s.isActive).length,
      byProgram
    });
  };

  const handleCreate = () => {
    setSelectedSubject(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEdit = (subject) => {
    setSelectedSubject(subject);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (subject) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Subject',
      message: 'Are you sure you want to delete this subject? This action cannot be undone.',
      itemName: `${subject.subjectCode} - ${subject.subjectName}`,
      onConfirm: async () => {
        try {
          await subjectAPI.delete(subject._id);
          toast.success('Subject deleted successfully');
          
          // Invalidate cache and refetch
          invalidateCache('subjects-list');
          reloadSubjects();
          
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error('Delete error:', error);
          
          // Show specific error message from backend
          const errorMessage = error.response?.data?.message || 
                              error.message || 
                              'Failed to delete subject';
          
          // If it's a program access error, show more specific message
          if (error.response?.status === 403) {
            const programError = error.response?.data?.message;
            if (programError?.includes('program')) {
              toast.error(programError);
            } else {
              toast.error('You do not have permission to delete this subject');
            }
          } else {
            toast.error(errorMessage);
          }
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
  };

  const copySubjectCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success(`Copied: ${code}`);
    }).catch(() => {
      toast.error('Failed to copy code');
    });
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedSubject(null);
    if (shouldRefresh) {
      // Invalidate cache and refetch
      invalidateCache('subjects-list');
      reloadSubjects();
    }
  };

  const handleExcelImportComplete = () => {
    setShowExcelImportModal(false);
    // Invalidate cache and refetch
    invalidateCache('subjects-list');
    reloadSubjects();
  };

  const clearFilters = () => {
    setFilters({
      program: '',
      yearLevel: '',
      semester: '',
      type: ''
    });
    setSearchTerm('');
  };

  // Filter subjects
  const filteredSubjects = (subjects || []).filter((subject) => {
    const matchesSearch = 
      subject.subjectCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.subjectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProgram = !filters.program || subject.program === filters.program;
    const matchesYear = !filters.yearLevel || subject.yearLevel === parseInt(filters.yearLevel);
    const matchesSemester = !filters.semester || subject.semester === parseInt(filters.semester);
    const matchesType = !filters.type || subject.type === filters.type;

    return matchesSearch && matchesProgram && matchesYear && matchesSemester && matchesType;
  });

  const hasActiveFilters = filters.program || filters.yearLevel || filters.semester || filters.type || searchTerm;

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Subject Management
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExcelImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                <Upload className="w-5 h-5" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Subject</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Manage curriculum subjects across all programs
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">TOTAL</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Subjects</div>
          </div>

          <div className="bg-green-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">ACTIVE</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.active}</div>
            <div className="text-xs opacity-80 mt-1">Available</div>
          </div>

          <div className="bg-blue-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Layers className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">PROGRAMS</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{PROGRAMS.length}</div>
            <div className="text-xs opacity-80 mt-1">Total Programs</div>
          </div>

          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">AVERAGE</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">
              {stats.total > 0 && PROGRAMS.length > 0 ? Math.round(stats.total / PROGRAMS.length) : 0}
            </div>
            <div className="text-xs opacity-80 mt-1">Per Program</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by subject code, name, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.program}
                onChange={(e) => setFilters({ ...filters, program: e.target.value })}
                disabled={user?.role === 'program_manager'}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {user?.role === 'program_manager' ? (
                  <option value={user.program}>{user.program}</option>
                ) : (
                  <>
                    <option value="">All Programs</option>
                    {PROGRAMS.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </>
                )}
              </select>

              <select
                value={filters.yearLevel}
                onChange={(e) => setFilters({ ...filters, yearLevel: e.target.value })}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Years</option>
                {YEAR_LEVELS.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>

              <select
                value={filters.semester}
                onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Semesters</option>
                {SEMESTERS.map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
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
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Search: {searchTerm}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setSearchTerm('')}
                    />
                  </span>
                )}
                {filters.program && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Program: {filters.program}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilters({ ...filters, program: '' })}
                    />
                  </span>
                )}
                {filters.yearLevel && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Year: {filters.yearLevel}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilters({ ...filters, yearLevel: '' })}
                    />
                  </span>
                )}
                {filters.semester && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Semester: {filters.semester}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilters({ ...filters, semester: '' })}
                    />
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Subjects Display */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading subjects...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <BookOpen className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {(subjects || []).length === 0 ? 'No subjects created yet' : 'No subjects match your filters'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {(subjects || []).length === 0 
                ? 'Get started by creating your first subject'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {(subjects || []).length === 0 && (
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create First Subject
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.map((subject) => (
              <div
                key={subject._id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-green-300 dark:hover:border-green-700 transition-all duration-200 transform hover:-translate-y-1"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
                        {subject.subjectCode}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        subject.isActive 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`}>
                        {subject.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-2">
                      {subject.subjectName}
                    </h3>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Program & Level</p>
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {subject.program} • Year {subject.yearLevel} • Sem {subject.semester}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Units & Type</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {subject.units} {subject.units === 1 ? 'unit' : 'units'} • {subject.type}
                      </p>
                    </div>
                  </div>

                  {subject.prerequisites && subject.prerequisites.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-600 dark:text-gray-400 text-xs">Prerequisites</p>
                        <p className="font-medium text-gray-900 dark:text-white text-xs line-clamp-2">
                          {subject.prerequisites.map(p => p.subjectCode).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {subject.description && (
                  <div className="mb-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {subject.description}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => copySubjectCode(subject.subjectCode)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    title="Copy subject code"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={() => handleEdit(subject)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(subject)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Subject Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Subject Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Program & Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Units
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSubjects.map((subject) => (
                    <tr 
                      key={subject._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs font-bold rounded">
                          {subject.subjectCode}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {subject.subjectName}
                        </div>
                        {subject.description && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                            {subject.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {subject.program}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Year {subject.yearLevel} • Sem {subject.semester}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {subject.units}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {subject.type}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          subject.isActive 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}>
                          {subject.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copySubjectCode(subject.subjectCode)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="Copy Code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(subject)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(subject)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Create/Edit Modal */}
      {showModal && (
        <SubjectModal
          mode={modalMode}
          subject={selectedSubject}
          onClose={handleModalClose}
        />
      )}

      {/* Excel Import Modal */}
      {showExcelImportModal && (
        <ExcelImportModal
          type="subjects"
          onClose={() => setShowExcelImportModal(false)}
          onComplete={handleExcelImportComplete}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        itemName={confirmDialog.itemName}
      />
    </Layout>
  );
};

export default SubjectPage;
