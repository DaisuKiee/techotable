import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { facultyAPI } from '../services/api';
import toast from 'react-hot-toast';
import useCachedData from '../hooks/useCachedData';
import { useCache } from '../context/CacheContext';
import { 
  Plus, Search, Edit2, Trash2, Eye, X,
  User, Mail, Phone, BookOpen, Award, FileText,
  Users, UserCheck, TrendingUp, AlertCircle,
  Grid3x3, List, GraduationCap, Briefcase, Star, Layers, Clock, Download, RefreshCw
} from 'lucide-react';
import FacultyModal from '../components/FacultyModal';
import FacultyDetailsModal from '../components/FacultyDetailsModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../hooks/usePrograms';
import { summarizeAllSubjects, describeRecency } from '../utils/teachingExperience';

// Accessors for the Faculty schema (backend/models/Faculty.model.js).
const getMaxLoad = (f) => f.maxTeachingHours || f.maxTeachingLoad || 36;
const getCurrentLoad = (f) => f.currentTeachingHours || f.currentLoad || 0;
const getPositionHours = (f) => {
  switch(f.position) {
    case 'Chairman': return 12;
    case 'Dean': return 9;
    case 'CD': return 6;
    default: return 0;
  }
};
const getTotalHours = (f) => getCurrentLoad(f) + getPositionHours(f);
const getSpecializations = (f) => f.specializations || [];
const getPrograms = (f) => f.programs || [];
const getTopQualification = (f) => {
  const q = (f.qualifications || [])[0];
  if (!q) return null;
  return [q.degree, q.field].filter(Boolean).join(' in ');
};

// Get load status with color (Green: 0-36, Yellow: 37-40, Red: 40+)
const getLoadStatus = (f) => {
  const total = getTotalHours(f);
  const standard = 36;
  
  if (total <= standard) {
    return { status: 'normal', color: 'green', bgColor: 'bg-green-600', percent: (total / standard) * 100 };
  } else if (total <= 40) {
    return { status: 'warning', color: 'yellow', bgColor: 'bg-yellow-500', percent: 100 };
  } else {
    return { status: 'overload', color: 'red', bgColor: 'bg-red-600', percent: 100 };
  }
};

const getLoadPercent = (f) => {
  const status = getLoadStatus(f);
  return Math.min(status.percent, 100);
};

// The schema has no `averageRating` field — ratings live on individual
// teachingHistory entries, so average the ones that have a score.
const getAverageRating = (f) => {
  const rated = (f.teachingHistory || []).filter(h => typeof h.rating === 'number' && h.rating > 0);
  if (rated.length === 0) return null;
  return rated.reduce((sum, h) => sum + h.rating, 0) / rated.length;
};

const FacultyPage = () => {
  const { user } = useAuth();
  const { programCodes } = usePrograms();
  const { invalidateCache } = useCache();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  
  // Use cached data for faculty with program filter as dependency
  const { 
    data: faculty, 
    loading, 
    refetch: reloadFaculty,
    error 
  } = useCachedData(
    () => {
      const params = { isActive: true };
      if (filterProgram) params.program = filterProgram;
      return facultyAPI.getAll(params);
    },
    `faculty-list-${filterProgram || 'all'}`, // Different cache key per program filter
    { 
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      dependencies: [filterProgram], // Re-fetch when filter changes
      onError: (err) => {
        console.error('Faculty fetch error:', err);
        toast.error('Failed to load faculty');
      }
    }
  );

  // Debug logging
  useEffect(() => {
    console.log('FacultyPage state:', { faculty, loading, error });
  }, [faculty, loading, error]);
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemName: '',
    onConfirm: null
  });

  // Program managers are locked to their own program
  useEffect(() => {
    if (user?.role === 'program_manager' && user?.program) {
      setFilterProgram(user.program);
    }
  }, [user]);

  const handleCreate = () => {
    setSelectedFaculty(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEdit = (facultyMember) => {
    setSelectedFaculty(facultyMember);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleView = (facultyMember) => {
    setSelectedFaculty(facultyMember);
    setShowDetailsModal(true);
  };

  const handleDelete = async (facultyMember) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Faculty Member',
      message: 'Are you sure you want to delete this faculty member? This action cannot be undone.',
      itemName: `${facultyMember.user?.firstName} ${facultyMember.user?.lastName}`,
      onConfirm: async () => {
        try {
          await facultyAPI.delete(facultyMember._id);
          toast.success('Faculty member deleted successfully');
          
          // Invalidate all program caches since faculty can belong to multiple programs
          invalidateCache(`faculty-list-${filterProgram || 'all'}`);
          invalidateCache('faculty-list-all');
          reloadFaculty();
          
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error('Delete error:', error);
          
          // Show specific error message from backend
          if (error.response?.status === 403) {
            toast.error(error.response?.data?.message || 'You do not have permission to delete this faculty member');
          } else {
            toast.error(error.response?.data?.message || 'Failed to delete faculty member');
          }
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedFaculty(null);
    if (shouldRefresh) {
      // Invalidate all program caches
      invalidateCache(`faculty-list-${filterProgram || 'all'}`);
      invalidateCache('faculty-list-all');
      reloadFaculty();
    }
  };

  const exportToExcel = () => {
    // Prepare data for Excel export
    const exportData = (faculty || []).map(f => ({
      'Employee ID': f.employeeId || '',
      'First Name': f.user?.firstName || '',
      'Last Name': f.user?.lastName || '',
      'Email': f.user?.email || '',
      'Contact Number': f.user?.contactNumber || '',
      'Position': f.position || '',
      'Employment Type': f.employmentType || '',
      'Programs': getPrograms(f).join(', ') || '',
      'Specializations': getSpecializations(f).join(', ') || '',
      'Max Teaching Hours': getMaxLoad(f) || '',
      'Current Load': getCurrentLoad(f) || '',
      'Position Load': getPositionHours(f) || '',
      'Total Hours': getTotalHours(f) || '',
      'Status': f.isActive ? 'Active' : 'Inactive',
      'Highest Qualification': getTopQualification(f) || ''
    }));

    if (exportData.length === 0) {
      toast.error('No faculty to export');
      return;
    }

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes in values
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const programFilter = filterProgram ? `_${filterProgram}` : '';
    link.download = `faculty${programFilter}_${timestamp}.csv`;
    
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${exportData.length} faculty members to Excel`);
  };

  // Filter faculty based on search and specialization
  const filteredFaculty = (faculty || []).filter((f) => {
    const matchesSearch = 
      f.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSpecialization = 
      !filterSpecialization || 
      f.specializations?.some(s => s.toLowerCase().includes(filterSpecialization.toLowerCase()));
    
    return matchesSearch && matchesSpecialization;
  });

  // Get unique specializations for filter
  const allSpecializations = [...new Set((faculty || []).flatMap(f => f.specializations || []))];

  // A program manager's locked program isn't a filter they can clear
  const isProgramManager = user?.role === 'program_manager';
  const hasActiveFilters = searchTerm || filterSpecialization || (filterProgram && !isProgramManager);

  // Calculate statistics
  const stats = {
    total: (faculty || []).length,
    active: (faculty || []).filter(f => f.isActive).length,
    avgLoad: (faculty || []).length > 0 
      ? Math.round((faculty || []).reduce((sum, f) => sum + getTotalHours(f), 0) / (faculty || []).length)
      : 0,
    overloaded: (faculty || []).filter(f => getTotalHours(f) > 40).length,
    warning: (faculty || []).filter(f => getTotalHours(f) > 36 && getTotalHours(f) <= 40).length
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Faculty Management
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  loadFaculty();
                  toast.success('Faculty data refreshed');
                }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                title="Refresh faculty data"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                title="Download faculty data as Excel file"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Faculty</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Manage faculty profiles, qualifications, and workload
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">TOTAL</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
            <div className="text-xs opacity-80 mt-1">Faculty Members</div>
          </div>

          <div className="bg-green-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">ACTIVE</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.active}</div>
            <div className="text-xs opacity-80 mt-1">Active Faculty</div>
          </div>

          <div className="bg-blue-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">AVG LOAD</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.avgLoad}</div>
            <div className="text-xs opacity-80 mt-1">Hours/Week</div>
          </div>

          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">OVERLOAD</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{stats.overloaded}</div>
            <div className="text-xs opacity-80 mt-1">Over Capacity</div>
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
                placeholder="Search by name, email, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                disabled={isProgramManager}
                title={isProgramManager ? `You manage ${user.program}` : 'Filter by program'}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {isProgramManager ? (
                  <option value={user.program}>{user.program}</option>
                ) : (
                  <>
                    <option value="">All Programs</option>
                    {programCodes.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </>
                )}
              </select>

              <select
                value={filterSpecialization}
                onChange={(e) => setFilterSpecialization(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Specializations</option>
                {allSpecializations.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
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
                {filterProgram && !isProgramManager && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Program: {filterProgram}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilterProgram('')}
                    />
                  </span>
                )}
                {filterSpecialization && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Specialization: {filterSpecialization}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => setFilterSpecialization('')}
                    />
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterSpecialization('');
                    // A program manager's program stays locked
                    if (!isProgramManager) setFilterProgram('');
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Faculty List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading faculty...</p>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Users className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {(faculty || []).length === 0 ? 'No faculty members yet' : 'No faculty found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {(faculty || []).length === 0 
                ? 'Get started by adding your first faculty member'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {(faculty || []).length === 0 && (
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add First Faculty
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFaculty.map((facultyMember) => (
              <div
                key={facultyMember._id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-200 transform hover:-translate-y-1"
              >
                {/* Faculty Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0">
                    {facultyMember.user?.profilePicture ? (
                      <img 
                        src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${facultyMember.user.profilePicture}`}
                        alt={`${facultyMember.user?.firstName} ${facultyMember.user?.lastName}`}
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-200 dark:ring-indigo-800"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center ring-2 ring-indigo-200 dark:ring-indigo-800">
                        <User className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                      {facultyMember.user?.firstName} {facultyMember.user?.lastName}
                    </h3>
                    {facultyMember.position && (
                      <p className="text-xs font-medium text-teal-700 dark:text-teal-400 truncate flex items-center gap-1">
                        <Briefcase className="w-3 h-3 flex-shrink-0" />
                        {facultyMember.position}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {facultyMember.user?.email}
                    </p>
                    {facultyMember.contactNumber && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {facultyMember.contactNumber}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
                        {facultyMember.employeeId}
                      </span>
                      {facultyMember.employmentType && (
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                          facultyMember.employmentType === 'Part-time'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          {facultyMember.employmentType}
                        </span>
                      )}
                      {facultyMember.department && (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 text-xs font-semibold rounded">
                          {facultyMember.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Qualified Programs */}
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Qualified Programs
                  </p>
                  {getPrograms(facultyMember).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getPrograms(facultyMember).map((prog) => (
                        <span
                          key={prog}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
                        >
                          {prog}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertCircle className="w-3 h-3" />
                      None assigned
                    </span>
                  )}
                </div>

                {/* Specializations */}
                {getSpecializations(facultyMember).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Specializations
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {getSpecializations(facultyMember).slice(0, 3).map((spec, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
                        >
                          {spec}
                        </span>
                      ))}
                      {getSpecializations(facultyMember).length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                          +{getSpecializations(facultyMember).length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Educational Background */}
                {(facultyMember.bachelorsDegree?.degree || facultyMember.mastersDegree?.degree || facultyMember.doctoralDegree?.degree) && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      Education
                    </p>
                    <div className="space-y-1">
                      {facultyMember.bachelorsDegree?.degree && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 flex-shrink-0">
                            BS
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 flex-1">
                            {facultyMember.bachelorsDegree.major || facultyMember.bachelorsDegree.degree}
                            {facultyMember.bachelorsDegree.minor && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Minor: {facultyMember.bachelorsDegree.minor})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {facultyMember.mastersDegree?.degree && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 flex-shrink-0">
                            MS
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 flex-1">
                            {facultyMember.mastersDegree.major || facultyMember.mastersDegree.degree}
                            {facultyMember.mastersDegree.minor && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Minor: {facultyMember.mastersDegree.minor})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {facultyMember.doctoralDegree?.degree && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex-shrink-0">
                            PhD
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 flex-1">
                            {facultyMember.doctoralDegree.major || facultyMember.doctoralDegree.degree}
                            {facultyMember.doctoralDegree.minor && (
                              <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(Minor: {facultyMember.doctoralDegree.minor})</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Qualification / experience / rating */}
                <div className="mb-3 space-y-1">
                  {getTopQualification(facultyMember) && (
                    <p className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      <span className="truncate">{getTopQualification(facultyMember)}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      {(facultyMember.teachingHistory || []).length} sem taught
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      {getAverageRating(facultyMember)
                        ? `${getAverageRating(facultyMember).toFixed(1)}/5.0`
                        : 'Not rated'}
                    </p>
                  </div>
                </div>

                {/* Strongest subject experience, recency-weighted */}
                {(facultyMember.experiencedSubjects?.length > 0 || summarizeAllSubjects(facultyMember).length > 0) && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Most Experienced In
                    </p>
                    <div className="space-y-1">
                      {/* Prioritize experiencedSubjects (faculty-edited) over teachingHistory (auto-generated) */}
                      {facultyMember.experiencedSubjects?.length > 0 ? (
                        // Display faculty-edited experienced subjects
                        facultyMember.experiencedSubjects.slice(0, 2).map((exp, idx) => {
                          // Build display parts
                          const parts = [];
                          if (exp.semestersTaught && exp.semestersTaught > 0) {
                            parts.push(`${exp.semestersTaught} sem`);
                          }
                          if (exp.rating && exp.rating > 0) {
                            parts.push(`⭐${exp.rating}/5`);
                          }
                          if (exp.frequency && exp.period) {
                            parts.push(`${exp.frequency}x · ${exp.period}`);
                          }
                          
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                {exp.subjectCode}
                              </span>
                              {parts.length > 0 && (
                                <span className="flex-shrink-0 px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  {parts.join(' · ')}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        // Fallback to auto-generated summary from teachingHistory
                        summarizeAllSubjects(facultyMember).slice(0, 2).map((s) => (
                          <div
                            key={s.key}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                              {s.subjectCode || s.subjectName}
                            </span>
                            <span
                              className={`flex-shrink-0 px-1.5 py-0.5 rounded font-medium ${
                                s.isStale
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
                                  : s.lastTaughtYearsAgo <= 1
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {s.timesTaught}x · {describeRecency(s.lastTaughtYearsAgo)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Workload Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Total Hours</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {getTotalHours(facultyMember)} hrs
                      {getPositionHours(facultyMember) > 0 && (
                        <span className="text-xs text-gray-500"> ({getCurrentLoad(facultyMember)}T + {getPositionHours(facultyMember)}A)</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getLoadStatus(facultyMember).bgColor}`}
                      style={{ width: `${getLoadPercent(facultyMember)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.max(36 - getTotalHours(facultyMember), 0)} hrs below standard
                    </p>
                    <span className={`text-xs font-semibold ${
                      getLoadStatus(facultyMember).color === 'green' ? 'text-green-600' :
                      getLoadStatus(facultyMember).color === 'yellow' ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {getLoadStatus(facultyMember).status === 'normal' ? '✓ Normal' :
                       getLoadStatus(facultyMember).status === 'warning' ? '⚠️ Warning' :
                       '⛔ Overload'}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      facultyMember.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}
                  >
                    {facultyMember.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleView(facultyMember)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleEdit(facultyMember)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(facultyMember)}
                    className="px-3 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
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
                      Faculty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Programs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Specialization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Education
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Workload
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
                  {filteredFaculty.map((facultyMember) => (
                    <tr 
                      key={facultyMember._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {facultyMember.user?.profilePicture ? (
                            <img 
                              src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${facultyMember.user.profilePicture}`}
                              alt={`${facultyMember.user?.firstName} ${facultyMember.user?.lastName}`}
                              className="flex-shrink-0 h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex-shrink-0 h-10 w-10 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {facultyMember.user?.firstName} {facultyMember.user?.lastName}
                            </div>
                            {facultyMember.position && (
                              <div className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                                {facultyMember.position}
                                {facultyMember.employmentType ? ` · ${facultyMember.employmentType}` : ''}
                              </div>
                            )}
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {facultyMember.user?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 text-xs font-bold rounded">
                          {facultyMember.employeeId}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getPrograms(facultyMember).length > 0 ? (
                            getPrograms(facultyMember).map((prog) => (
                              <span
                                key={prog}
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
                              >
                                {prog}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-amber-700 dark:text-amber-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getSpecializations(facultyMember).slice(0, 2).map((spec, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
                            >
                              {spec}
                            </span>
                          ))}
                          {getSpecializations(facultyMember).length > 2 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                              +{getSpecializations(facultyMember).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Education Column */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {facultyMember.bachelorsDegree?.degree && (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                BS
                              </span>
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={`${facultyMember.bachelorsDegree.degree}${facultyMember.bachelorsDegree.major ? ` (${facultyMember.bachelorsDegree.major})` : ''}`}>
                                {facultyMember.bachelorsDegree.major || facultyMember.bachelorsDegree.degree}
                              </span>
                            </div>
                          )}
                          {facultyMember.mastersDegree?.degree && (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                MS
                              </span>
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={`${facultyMember.mastersDegree.degree}${facultyMember.mastersDegree.major ? ` (${facultyMember.mastersDegree.major})` : ''}`}>
                                {facultyMember.mastersDegree.major || facultyMember.mastersDegree.degree}
                              </span>
                            </div>
                          )}
                          {facultyMember.doctoralDegree?.degree && (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                PhD
                              </span>
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={`${facultyMember.doctoralDegree.degree}${facultyMember.doctoralDegree.major ? ` (${facultyMember.doctoralDegree.major})` : ''}`}>
                                {facultyMember.doctoralDegree.major || facultyMember.doctoralDegree.degree}
                              </span>
                            </div>
                          )}
                          {!facultyMember.bachelorsDegree?.degree && !facultyMember.mastersDegree?.degree && !facultyMember.doctoralDegree?.degree && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">Not specified</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 min-w-[140px]">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600 dark:text-gray-400">
                                {getTotalHours(facultyMember)} hrs
                              </span>
                              <span className={`font-semibold ${
                                getLoadStatus(facultyMember).color === 'green' ? 'text-green-600' :
                                getLoadStatus(facultyMember).color === 'yellow' ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {getLoadStatus(facultyMember).status === 'normal' ? '✓' :
                                 getLoadStatus(facultyMember).status === 'warning' ? '⚠️' : '⛔'}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getLoadStatus(facultyMember).bgColor}`}
                                style={{ width: `${getLoadPercent(facultyMember)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            facultyMember.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }`}
                        >
                          {facultyMember.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(facultyMember)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(facultyMember)}
                            className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(facultyMember)}
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
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <FacultyModal
          mode={modalMode}
          faculty={selectedFaculty}
          onClose={handleModalClose}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <FacultyDetailsModal
          faculty={selectedFaculty}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedFaculty(null);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            handleEdit(selectedFaculty);
          }}
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

export default FacultyPage;
