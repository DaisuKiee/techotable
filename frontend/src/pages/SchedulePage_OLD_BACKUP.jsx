import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { scheduleAPI, subjectAPI, sectionAPI, facultyAPI, roomAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Plus, Download, 
  Wand2, AlertTriangle, CheckCircle, X, FileText, Grid, Users,
  Search, Filter, Clock, BookOpen, School, Grid3x3, List, MapPin
} from 'lucide-react';
import ScheduleModal from '../components/ScheduleModal';
import GenerateScheduleModal from '../components/GenerateScheduleModal';
import ConflictWarning from '../components/ConflictWarning';
import FacultyDragDrop from '../components/FacultyDragDrop';
import ScheduleBuilder from '../components/ScheduleBuilder';
import TimetableGrid from '../components/TimetableGrid';
import { exportToCSV, exportToOfficialPDF, exportToPrintableHTML, exportWeeklyTimetable } from '../utils/scheduleExport';
import { useAuth } from '../context/AuthContext';

const PROGRAMS = ['BSIT', 'BSHM', 'BIT-ET', 'BIT-CT', 'BIT-AT', 'BSFI', 'BSIE'];
const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];

const SchedulePage = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    program: '',
    yearLevel: '',
    semester: 1,
    shift: '',
    academicYear: '2024-2025'
  });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [conflicts, setConflicts] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    conflicts: 0,
    draft: 0
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'list', 'dragdrop', or 'builder'
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { id, schedule } for confirmation
  const [timetableView, setTimetableView] = useState('week'); // 'week', 'day', 'month'
  const [shiftFilter, setShiftFilter] = useState('all'); // 'all', 'Day', 'Night'

  // Permission check: admin, scheduling_officer, and program_manager can create/edit schedules
  const canEditSchedules = user?.role === 'admin' 
    || user?.role === 'scheduling_officer' 
    || user?.role === 'program_manager';
  
  // Students can only view their own section's schedules
  const isStudent = user?.role === 'student';
  
  // Program managers can only view their program's schedules
  const isProgramManager = user?.role === 'program_manager';

  useEffect(() => {
    // Auto-set filters for students based on their profile
    if (isStudent && user) {
      setFilters({
        program: user.program || '',
        yearLevel: user.yearLevel || '',
        semester: user.semester || 1,
        shift: user.shift || '', // Use student's shift
        academicYear: user.academicYear || '2024-2025'
      });
      
      // Auto-set shift filter to match student's shift
      if (user.shift) {
        setShiftFilter(user.shift);
      }
    }
    // Auto-set program filter for program managers
    else if (isProgramManager && user?.program) {
      setFilters(prev => ({ ...prev, program: user.program }));
    }
  }, [isStudent, isProgramManager, user]);

  useEffect(() => {
    loadAllData();
  }, [filters]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadSchedules(),
      loadSubjects(),
      loadSections(),
      loadFaculty(),
      loadRooms()
    ]);
    setLoading(false);
  };

  const loadSchedules = async () => {
    try {
      const params = { isActive: true }; // Only load active schedules
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      if (filters.shift) params.shift = filters.shift;
      if (filters.academicYear) params.academicYear = filters.academicYear;

      const response = await scheduleAPI.getAll(params);
      const scheduleData = response.data.data || [];
      setSchedules(scheduleData);
      calculateStats(scheduleData);
    } catch (error) {
      console.error('Load schedules error:', error);
      toast.error(getErrorMessage(error, 'Failed to load schedules'));
    }
  };

  const loadSubjects = async () => {
    try {
      const params = { isActive: true };
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      
      const response = await subjectAPI.getAll(params);
      setSubjects(response.data.data || []);
    } catch (error) {
      console.error('Load subjects error:', error);
    }
  };

  const loadSections = async () => {
    try {
      const response = await sectionAPI.getAll();
      let sectionData = response.data.data || [];
      
      // Filter by program if specified
      if (filters.program) {
        sectionData = sectionData.filter(s => s.program === filters.program);
      }
      if (filters.yearLevel) {
        sectionData = sectionData.filter(s => s.yearLevel === parseInt(filters.yearLevel));
      }
      
      setSections(sectionData);
    } catch (error) {
      console.error('Load sections error:', error);
    }
  };

  const loadFaculty = async () => {
    try {
      const response = await facultyAPI.getAll({ isActive: true });
      setFaculty(response.data.data || []);
    } catch (error) {
      console.error('Load faculty error:', error);
    }
  };

  const loadRooms = async () => {
    try {
      const response = await roomAPI.getAll({ isActive: true });
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Load rooms error:', error);
    }
  };

  const calculateStats = (scheduleData) => {
    const published = scheduleData.filter(s => s.isPublished || s.status === 'active').length;
    const draft = scheduleData.filter(s => !s.isPublished && s.status === 'draft').length;
    
    setStats({
      total: scheduleData.length,
      published: published,
      draft: draft,
      conflicts: conflicts.length
    });
  };

  const handleCreate = () => {
    setSelectedSchedule(null);
    setModalMode('create');
    setShowScheduleModal(true);
  };

  const handleGenerate = () => {
    setShowGenerateModal(true);
  };

  const handleEventClick = (schedule) => {
    // Only allow editing for admin and scheduling officer
    if (!canEditSchedules) {
      toast.info('View-only mode. Only administrators can edit schedules.');
      return;
    }

    if (schedule) {
      setSelectedSchedule(schedule);
      setModalMode('edit');
      setShowScheduleModal(true);
    }
  };

  const handleDelete = async (id) => {
    // Show confirmation toast instead of alert
    setDeleteConfirmation({ id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      await scheduleAPI.delete(deleteConfirmation.id);
      toast.success('Schedule deleted successfully');
      setDeleteConfirmation(null);
      loadAllData(); // Reload all data
    } catch (error) {
      console.error('Delete error:', error);
      
      // Show specific error message
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.message;
        if (errorMessage?.includes('program')) {
          toast.error(errorMessage);
        } else {
          toast.error('You do not have permission to delete this schedule');
        }
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete schedule');
      }
      setDeleteConfirmation(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handlePublish = async () => {
    try {
      const publishData = {
        program: filters.program,
        yearLevel: filters.yearLevel,
        semester: filters.semester,
        academicYear: filters.academicYear
      };

      await scheduleAPI.publish(publishData);
      toast.success('Schedule published successfully');
      loadAllData();
    } catch (error) {
      console.error('Publish error:', error);
      toast.error(error.response?.data?.message || 'Failed to publish schedule');
    }
  };

  const handleCheckConflicts = async () => {
    try {
      const conflictData = {
        program: filters.program,
        yearLevel: filters.yearLevel,
        semester: filters.semester,
        academicYear: filters.academicYear
      };

      const response = await scheduleAPI.checkConflicts(conflictData);
      const foundConflicts = response.data.conflicts || [];
      setConflicts(foundConflicts);
      setShowConflictWarning(true);

      if (foundConflicts.length === 0) {
        toast.success('No conflicts found!');
      } else {
        toast.error(`Found ${foundConflicts.length} conflicts`);
      }
    } catch (error) {
      console.error('Check conflicts error:', error);
      toast.error(getErrorMessage(error, 'Failed to check conflicts'));
    }
  };

  const handleExport = (format) => {
    setShowExportMenu(false);
    
    if (schedules.length === 0) {
      toast.error('No schedules to export');
      return;
    }

    const filename = `schedule_${filters.program || 'all'}_${filters.academicYear || 'current'}`;
    
    try {
      switch (format) {
        case 'csv':
          exportToCSV(schedules, `${filename}.csv`);
          toast.success('Exported to CSV');
          break;
        case 'official':
          exportToOfficialPDF(schedules, filters);
          toast.success('Opening official schedule format');
          break;
        case 'pdf':
          exportToPrintableHTML(schedules, filters);
          toast.success('Opening print preview');
          break;
        case 'timetable':
          exportWeeklyTimetable(schedules, filters);
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
    if (shouldRefresh) {
      loadAllData();
    }
  };

  const hasFilters = filters.program || filters.yearLevel;

  // Filter schedules based on search term
  const filteredSchedules = schedules.filter((schedule) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      schedule.subject?.subjectCode?.toLowerCase().includes(searchLower) ||
      schedule.subject?.subjectName?.toLowerCase().includes(searchLower) ||
      schedule.section?.toLowerCase().includes(searchLower) ||
      schedule.faculty?.user?.firstName?.toLowerCase().includes(searchLower) ||
      schedule.faculty?.user?.lastName?.toLowerCase().includes(searchLower) ||
      schedule.room?.roomCode?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        {/* View-Only Notice for Students and Faculty */}
        {!canEditSchedules && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900 dark:border-blue-700">
            <div className="flex items-start">
              <CalendarIcon className="text-blue-600 mt-0.5 mr-3 dark:text-blue-400" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1 dark:text-blue-100">
                  {isStudent ? 'Your Class Schedule' : 'View-Only Mode'}
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {isStudent 
                    ? `Showing schedules for ${user?.program || 'your program'} - Year ${user?.yearLevel || 'N/A'} - Section ${user?.section || 'N/A'}` 
                    : 'You can view schedules but cannot create or edit them. Only administrators and scheduling officers can manage schedules.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Schedule Management</h1>
            <p className="text-gray-600 mt-1 dark:text-gray-400">
              {canEditSchedules 
                ? 'View and manage class schedules' 
                : 'View class schedules'}
            </p>
          </div>
          <div className="flex gap-2">
            {canEditSchedules && (
              <>
                <button
                  onClick={handleCreate}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} className="mr-2" />
                  Add Schedule
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Wand2 size={20} className="mr-2" />
                  Generate
                </button>
                <button
                  onClick={() => {
                    if (viewMode === 'calendar') setViewMode('builder');
                    else if (viewMode === 'builder') setViewMode('dragdrop');
                    else setViewMode('calendar');
                  }}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {viewMode === 'calendar' && (
                    <>
                      <Grid size={20} className="mr-2" />
                      Schedule Builder
                    </>
                  )}
                  {viewMode === 'builder' && (
                    <>
                      <Users size={20} className="mr-2" />
                      Assign Faculty
                    </>
                  )}
                  {viewMode === 'dragdrop' && (
                    <>
                      <CalendarIcon size={20} className="mr-2" />
                      Calendar View
                    </>
                  )}
                </button>
              </>
            )}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download size={20} className="mr-2" />
                Export
              </button>
              
              {/* Export Dropdown */}
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10 dark:bg-gray-800 dark:border-gray-700">
                  <button
                    onClick={() => handleExport('official')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} className="mr-3" />
                    Official Schedule (PDF)
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} className="mr-3" />
                    Export to CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <FileText size={16} className="mr-3" />
                    Simple PDF
                  </button>
                  <button
                    onClick={() => handleExport('timetable')}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Grid size={16} className="mr-3" />
                    Weekly Timetable
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters - Hidden for students */}
        {!isStudent && (
          <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <select
                value={filters.program}
                onChange={(e) => setFilters({ ...filters, program: e.target.value })}
                disabled={isProgramManager}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:disabled:bg-gray-600"
              >
                {isProgramManager ? (
                  // Program managers only see their assigned program
                  <option value={user.program}>{user.program}</option>
                ) : (
                  // Admin and scheduling officers see all programs
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
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">All Years</option>
                {YEAR_LEVELS.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>

              <select
                value={filters.semester}
                onChange={(e) => setFilters({ ...filters, semester: parseInt(e.target.value) })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                {SEMESTERS.map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>

              <select
                value={filters.shift}
                onChange={(e) => setFilters({ ...filters, shift: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="">All Shifts</option>
                <option value="Day">Day (7AM-4PM)</option>
                <option value="Night">Night (4PM-10PM)</option>
              </select>

              <input
                type="text"
                value={filters.academicYear}
                onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })}
                placeholder="Academic Year"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
              />
            </div>

            {/* Action Buttons */}
            {canEditSchedules && (
              <div className="flex gap-2">
                <button
                  onClick={handleCheckConflicts}
                  disabled={!hasFilters}
                  className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AlertTriangle size={18} className="mr-2" />
                  Check Conflicts
                </button>
                <button
                  onClick={handlePublish}
                  disabled={!hasFilters}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} className="mr-2" />
                  Publish Schedule
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Schedules</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Published</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.published}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Conflicts</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.conflicts}</p>
        </div>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 dark:bg-red-900 dark:border-red-700">
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
            </div>
            <button
              onClick={() => setConflicts([])}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto dark:border-blue-400"></div>
            <p className="text-gray-600 mt-4 dark:text-gray-400">Loading schedules...</p>
          </div>
        ) : viewMode === 'builder' ? (
          <ScheduleBuilder 
            filters={filters}
            onAssignmentChange={loadSchedules}
          />
        ) : viewMode === 'dragdrop' ? (
          <FacultyDragDrop 
            filters={filters}
            onAssignmentChange={loadSchedules}
          />
        ) : (
          <>
            {/* View Mode Selector - Only show shift filter for non-students */}
            <div className="flex justify-between items-center mb-4">
              {/* Shift Filter - Hidden for students (they only see their shift) */}
              {!isStudent && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Shift:</span>
                  <button
                    onClick={() => setShiftFilter('all')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      shiftFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    All Day
                  </button>
                  <button
                    onClick={() => setShiftFilter('Day')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      shiftFilter === 'Day'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Day (7 AM - 4 PM)
                  </button>
                  <button
                    onClick={() => setShiftFilter('Night')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      shiftFilter === 'Night'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    Night (4 PM - 10 PM)
                  </button>
                </div>
              )}
              
              {/* Student sees their shift (read-only) */}
              {isStudent && user?.shift && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Shift:</span>
                  <div className={`px-4 py-2 rounded-lg font-medium ${
                    user.shift === 'Day' 
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-400'
                      : 'bg-indigo-100 text-indigo-800 border-2 border-indigo-500 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-400'
                  }`}>
                    {user.shift} {user.shift === 'Day' ? '(7 AM - 4 PM)' : '(4 PM - 10 PM)'}
                  </div>
                </div>
              )}

              {/* Day/Week Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTimetableView('week')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timetableView === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Week View
                </button>
                <button
                  onClick={() => setTimetableView('day')}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timetableView === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Day View
                </button>
              </div>
            </div>

            {/* Timetable Grid */}
            <TimetableGrid
              schedules={schedules}
              onScheduleClick={handleEventClick}
              canEdit={canEditSchedules}
              viewMode={timetableView}
              shift={shiftFilter}
            />
          </>
        )}
      </div>

      {/* Legend */}
      {viewMode === 'calendar' && (
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Published</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-500 rounded mr-2"></div>
            <span className="text-gray-700 dark:text-gray-300">Draft</span>
          </div>
        </div>
      )}
      
      {/* View Mode Info */}
      {viewMode !== 'calendar' && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-900 dark:border-blue-700">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {viewMode === 'builder' && '📚 Schedule Builder: Drag subjects to time slots, select duration (1-3 hours), then assign faculty and rooms'}
            {viewMode === 'dragdrop' && '👨‍🏫 Faculty Assignment: Drag faculty members to existing schedule slots to reassign them'}
          </p>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          mode={modalMode}
          schedule={selectedSchedule}
          onClose={handleModalClose}
          onDelete={handleDelete}
        />
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateScheduleModal
          onClose={handleModalClose}
        />
      )}

      {/* Conflict Warning */}
      {showConflictWarning && conflicts.length > 0 && (
        <ConflictWarning
          conflicts={conflicts}
          onDismiss={() => setShowConflictWarning(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80"
              onClick={cancelDelete}
            ></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-50 dark:bg-gray-800">
              <div className="flex items-center mb-4">
                <AlertTriangle className="text-red-600 mr-3 dark:text-red-400" size={32} />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Delete</h3>
              </div>
              
              <p className="text-gray-600 mb-6 dark:text-gray-300">
                Are you sure you want to delete this schedule entry? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SchedulePage;
