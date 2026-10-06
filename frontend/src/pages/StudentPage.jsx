import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { studentAPI } from '../services/api';
import useCachedData from '../hooks/useCachedData';
import toast from 'react-hot-toast';
import StudentModal from '../components/StudentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  Plus, Upload, Edit2, Trash2, Search, X, 
  Users, GraduationCap, UserCheck, TrendingUp, 
  Grid3x3, List, Download, FileText, BookOpen, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../hooks/usePrograms';

const StudentPage = () => {
  const { user } = useAuth();
  const { programCodes } = usePrograms();
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [filters, setFilters] = useState({
    program: '',
    yearLevel: '',
    section: '',
    search: '',
    studentType: ''
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

  // ✅ CACHE: Students list with 5-minute cache
  const {
    data: studentsResponse,
    loading: studentsLoading,
    error: studentsError,
    refetch: reloadStudents,
    isFromCache: studentsFromCache
  } = useCachedData(
    () => studentAPI.getAll(filters),
    `students-list-${JSON.stringify(filters)}`,
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      onSuccess: (data) => {
        console.log('✅ Students loaded:', studentsFromCache ? '📦 from cache' : '🌐 fresh fetch');
      },
      onError: (err) => {
        console.error('Failed to load students:', err);
        toast.error(err.response?.data?.message || 'Failed to fetch students');
      }
    }
  );

  // ✅ CACHE: Student stats with 5-minute cache
  const {
    data: statsResponse,
    loading: statsLoading,
    error: statsError,
    refetch: reloadStats,
    isFromCache: statsFromCache
  } = useCachedData(
    () => studentAPI.getStats(),
    'student-stats',
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      onSuccess: (data) => {
        console.log('✅ Student stats loaded:', statsFromCache ? '📦 from cache' : '🌐 fresh fetch');
      },
      onError: (err) => {
        console.error('Failed to fetch stats:', err);
      }
    }
  );

  // Extract data from responses
  const students = React.useMemo(() => {
    if (!studentsResponse) return [];
    const data = studentsResponse.data || studentsResponse;
    return data?.data || data || [];
  }, [studentsResponse]);

  const stats = React.useMemo(() => {
    if (!statsResponse) return null;
    const data = statsResponse.data || statsResponse;
    return data?.data || data || null;
  }, [statsResponse]);

  const loading = studentsLoading || statsLoading;

  // Reload when filters change
  useEffect(() => {
    reloadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleCreate = () => {
    setSelectedStudent(null);
    setShowModal(true);
  };

  const handleEdit = (student) => {
    setSelectedStudent(student);
    setShowModal(true);
  };

  const handleDelete = async (student) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Student',
      message: 'Are you sure you want to delete this student? All associated data will be removed.',
      itemName: `${student.user?.firstName} ${student.user?.lastName} (${student.studentId})`,
      onConfirm: async () => {
        try {
          await studentAPI.delete(student._id);
          toast.success('Student deleted successfully');
          reloadStudents();
          reloadStats();
        } catch (error) {
          console.error('Delete error:', error);
          
          // Show specific error message from backend
          if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.message;
            if (errorMessage?.includes('program')) {
              toast.error(errorMessage);
            } else {
              toast.error('You do not have permission to delete this student');
            }
          } else {
            toast.error(error.response?.data?.message || 'Failed to delete student');
          }
        }
      }
    });
  };

  const handleModalClose = (refresh) => {
    setShowModal(false);
    setSelectedStudent(null);
    if (refresh) {
      reloadStudents();
      reloadStats();
    }
  };

  const exportToExcel = () => {
    // Prepare data for Excel export
    const exportData = students.map(student => ({
      'Student ID': student.studentId || '',
      'First Name': student.user?.firstName || '',
      'Last Name': student.user?.lastName || '',
      'Middle Name': student.user?.middleName || '',
      'Email': student.user?.email || '',
      'Program': student.program || '',
      'Year Level': student.yearLevel || '',
      'Section': student.sectionCode || '',
      'Student Type': student.studentType || '',
      'Academic Year': student.academicYear || '',
      'Semester': student.semester || '',
      'Contact Number': student.user?.contactNumber || '',
      'Enrollment Status': student.enrollmentStatus || ''
    }));

    // Convert to CSV format
    if (exportData.length === 0) {
      toast.error('No students to export');
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
    const programFilter = filters.program ? `_${filters.program}` : '';
    link.download = `students${programFilter}_${timestamp}.csv`;
    
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${exportData.length} students to Excel`);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      program: '',
      yearLevel: '',
      section: '',
      search: '',
      studentType: ''
    });
  };

  const downloadTemplate = () => {
    const csvContent = 'studentId,email,password,firstName,lastName,middleName,program,yearLevel,section,studentType,academicYear,semester,contactNumber\n' +
      '2024-00001,student1@ctu.edu.ph,student123,Juan,Dela Cruz,Santos,BSIT,1,A,regular,2024-2025,1,09123456789\n' +
      '2024-00002,student2@ctu.edu.ph,student123,Maria,Garcia,Lopez,BSHM,2,B,regular,2024-2025,1,09123456788';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getEnrollmentStatusColor = (status) => {
    const colors = {
      enrolled: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      not_enrolled: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300',
      dropped: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      graduated: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const hasActiveFilters = filters.search || filters.program || filters.yearLevel || filters.section || filters.studentType;

  // Calculate simplified stats from current data
  const calculatedStats = {
    total: students.length,
    enrolled: students.filter(s => s.enrollmentStatus === 'enrolled').length,
    regular: students.filter(s => s.studentType === 'regular').length,
    irregular: students.filter(s => s.studentType === 'irregular').length
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Student Management
            </h1>
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                title="Download student data as Excel file"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            Manage student profiles and enrollment records
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">TOTAL</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{calculatedStats.total}</div>
            <div className="text-xs opacity-80 mt-1">Students</div>
          </div>

          <div className="bg-green-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <UserCheck className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">ENROLLED</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{calculatedStats.enrolled}</div>
            <div className="text-xs opacity-80 mt-1">Active Students</div>
          </div>

          <div className="bg-blue-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <GraduationCap className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">REGULAR</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{calculatedStats.regular}</div>
            <div className="text-xs opacity-80 mt-1">Regular Students</div>
          </div>

          <div className="bg-orange-600 text-white rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-5 h-5 opacity-80" />
              <span className="text-xs font-medium opacity-80">IRREGULAR</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold">{calculatedStats.irregular}</div>
            <div className="text-xs opacity-80 mt-1">Irregular Students</div>
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
                placeholder="Search by name, ID, email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.program}
                onChange={(e) => handleFilterChange('program', e.target.value)}
                disabled={user?.role === 'program_manager'}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {user?.role === 'program_manager' ? (
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
                value={filters.yearLevel}
                onChange={(e) => handleFilterChange('yearLevel', e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>

              <select
                value={filters.studentType}
                onChange={(e) => handleFilterChange('studentType', e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
              >
                <option value="">All Types</option>
                <option value="regular">Regular</option>
                <option value="irregular">Irregular</option>
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
                {filters.search && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Search: {filters.search}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => handleFilterChange('search', '')}
                    />
                  </span>
                )}
                {filters.program && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Program: {filters.program}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => handleFilterChange('program', '')}
                    />
                  </span>
                )}
                {filters.yearLevel && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Year: {filters.yearLevel}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => handleFilterChange('yearLevel', '')}
                    />
                  </span>
                )}
                {filters.studentType && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs rounded-md">
                    Type: {filters.studentType}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100" 
                      onClick={() => handleFilterChange('studentType', '')}
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

        {/* Student List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading students...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Users className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No students found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {students.length === 0 
                ? 'Get started by adding your first student'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {students.length === 0 && (
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add First Student
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <div
                key={student._id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 transform hover:-translate-y-1"
              >
                {/* Student Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0">
                    {student.user?.profilePicture ? (
                      <img
                        className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-900"
                        src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${student.user.profilePicture}`}
                        alt=""
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center ring-2 ring-indigo-200 dark:ring-indigo-800">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                          {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                      {student.user?.firstName} {student.user?.lastName}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{student.user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
                      {student.studentId}
                    </span>
                  </div>
                </div>

                {/* Student Details */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Program & Year</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {student.program} • Year {student.yearLevel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Section Code & Type</p>
                      <p className="font-medium text-gray-900 dark:text-white capitalize">
                        {student.sectionCode || `${student.section} (Not Assigned)`} • {student.studentType}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-600 dark:text-gray-400 text-xs">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getEnrollmentStatusColor(student.enrollmentStatus)} capitalize`}>
                        {student.enrollmentStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleEdit(student)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(student)}
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
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Program
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Year & Section
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {students.map((student) => (
                    <tr 
                      key={student._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 text-xs font-bold rounded">
                          {student.studentId}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            {student.user?.profilePicture ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${student.user.profilePicture}`}
                                alt=""
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                  {student.user?.firstName?.[0]}{student.user?.lastName?.[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {student.user?.firstName} {student.user?.lastName}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{student.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white font-medium">{student.program}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          Year {student.yearLevel} - {student.section}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300 capitalize">
                          {student.studentType}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getEnrollmentStatusColor(student.enrollmentStatus)} capitalize`}>
                          {student.enrollmentStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{student.contactNumber || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(student)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(student)}
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

      {/* Modals */}
      {showModal && (
        <StudentModal
          student={selectedStudent}
          onClose={handleModalClose}
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

export default StudentPage;
