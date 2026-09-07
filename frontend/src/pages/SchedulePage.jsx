import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { scheduleAPI, subjectAPI, sectionAPI, facultyAPI, roomAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  Calendar as CalendarIcon, Plus, Download, Search, X,
  Wand2, AlertTriangle, CheckCircle, FileText, Grid,
  Clock, BookOpen, School, List, MapPin,
  Edit2, Trash2
} from 'lucide-react';
import ScheduleModal from '../components/ScheduleModal';
import GenerateScheduleModal from '../components/GenerateScheduleModal';
import ConflictWarning from '../components/ConflictWarning';
import ScheduleBuilder from '../components/ScheduleBuilder';
import TimetableGrid from '../components/TimetableGrid';
import { exportToCSV, exportToOfficialPDF, exportToPrintableHTML, exportWeeklyTimetable } from '../utils/scheduleExport';
import { useAuth } from '../context/AuthContext';
import StudentSchedule from '../components/StudentSchedule';
import { usePrograms } from '../hooks/usePrograms';

const YEAR_LEVELS = [1, 2, 3, 4];
const SEMESTERS = [1, 2];
const SHIFTS = ['Day', 'Night'];

const SchedulePage = () => {
  const { user } = useAuth();
  const { programCodes: PROGRAMS } = usePrograms();
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
    draft: 0,
    conflicts: 0
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'builder'
  const [timetableView, setTimetableView] = useState('week'); // 'week', 'day'
  const [selectedSection, setSelectedSection] = useState(null); // for program manager section picker
  const [selectedSchedules, setSelectedSchedules] = useState([]); // checkbox selection

  // Permission checks
  const canEditSchedules = user?.role === 'admin' || user?.role === 'scheduling_officer' || user?.role === 'program_manager';
  const isStudent = user?.role === 'student';
  const isProgramManager = user?.role === 'program_manager';

  // Auto-set filters based on user role
  useEffect(() => {
    if (isStudent && user) {
      setFilters({
        program: user.program || '',
        yearLevel: user.yearLevel || '',
        semester: user.semester || 1,
        shift: user.shift || '',
        academicYear: user.academicYear || '2024-2025'
      });
    } else if (isProgramManager && user?.program) {
      setFilters(prev => ({ ...prev, program: user.program }));
    }
  }, [isStudent, isProgramManager, user]);

  useEffect(() => {
    // Students render <StudentSchedule />, which loads its own data from
    // /classSpaces/my-classes. Skip the management fetches so a student doesn't
    // fire five staff endpoints (and collect 403s) on every visit.
    if (isStudent) {
      setLoading(false);
      return;
    }
    loadAllData();
  }, [filters, isStudent, selectedSection?.sectionCode]);

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
      const params = { isActive: true };
      if (filters.program) params.program = filters.program;
      if (filters.yearLevel) params.yearLevel = filters.yearLevel;
      if (filters.semester) params.semester = filters.semester;
      if (filters.shift) params.shift = filters.shift;
      if (filters.academicYear) params.academicYear = filters.academicYear;

      // Scope to the chosen section. Without this the calendar and list showed
      // every section of the program at once, so different sections' classes
      // piled into the same grid cells and looked like one section's timetable.
      if (selectedSection?.sectionCode) params.sectionCode = selectedSection.sectionCode;

      const response = await scheduleAPI.getAll(params);
      const scheduleData = response.data.data || [];
      setSchedules(scheduleData);
      calculateStats(scheduleData);
    } catch (error) {
      console.error('Load schedules error:', error);
      toast.error('Failed to load schedules');
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

  // When a program manager picks a section, auto-fill yearLevel, semester, shift
  // Picking a section is the single action that configures everything the
  // builder and Publish need: program, year level, semester and shift. There is
  // deliberately no separate control for each of those.
  const handleSectionSelect = (sectionId) => {
    if (!sectionId) {
      setSelectedSection(null);
      setFilters(prev => ({ ...prev, yearLevel: '', shift: '' }));
      return;
    }
    const section = sections.find(s => s._id === sectionId);
    if (section) {
      setSelectedSection(section);
      setFilters(prev => ({
        ...prev,
        // Also set the program, so an admin can jump straight to a section
        program: section.program || prev.program,
        yearLevel: section.yearLevel,
        shift: section.shift,
        semester: section.semester,
        academicYear: section.academicYear || prev.academicYear
      }));
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
    // The schema stores status as 'draft' | 'published' | 'archived'. This used
    // to test `status === 'active'`, which is not a valid value, so the Published
    // count sat at 0 forever even after publishing. There is no `isPublished`
    // field on the model either.
    const published = scheduleData.filter(s => s.status === 'published').length;
    const draft = scheduleData.filter(s => s.status !== 'published').length;

    setStats(prev => ({
      total: scheduleData.length,
      published,
      draft,
      // Keep the last known conflict count: reading the `conflicts` state here
      // captured a stale value from the render this function was defined in.
      conflicts: prev.conflicts
    }));
  };

  const handleCreate = () => {
    setSelectedSchedule(null);
    setModalMode('create');
    setShowScheduleModal(true);
  };

  const handleGenerate = () => {
    setShowGenerateModal(true);
  };

  const handleEdit = (schedule) => {
    if (!canEditSchedules) {
      // react-hot-toast has no `toast.info`, so this threw a TypeError
      toast('View-only mode. Only administrators can edit schedules.');
      return;
    }
    setSelectedSchedule(schedule);
    setModalMode('edit');
    setShowScheduleModal(true);
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this schedule?');
    if (!confirmed) return;

    try {
      await scheduleAPI.delete(id);
      toast.success('Schedule deleted successfully');
      loadAllData();
    } catch (error) {
      console.error('Delete error:', error);
      
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
    }
  };

  const handleSelectAll = () => {
    if (selectedSchedules.length === filteredSchedules.length && filteredSchedules.length > 0) {
      setSelectedSchedules([]);
    } else {
      setSelectedSchedules(filteredSchedules.map(s => s._id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedSchedules(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedSchedules.length === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedSchedules.length} selected schedule(s)?`);
    if (!confirmed) return;

    try {
      const res = await scheduleAPI.batchDelete(selectedSchedules);
      toast.success(res.data.message || `Deleted ${selectedSchedules.length} schedule(s)`);
      setSelectedSchedules([]);
      loadAllData();
    } catch (error) {
      console.error('Batch delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete selected schedules');
    }
  };

  const handleBatchPublishSelected = async () => {
    if (selectedSchedules.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedSchedules) {
        await scheduleAPI.update(id, { status: 'published' });
        count++;
      }
      toast.success(`Published ${count} selected schedule(s)`);
      setSelectedSchedules([]);
      loadAllData();
    } catch (error) {
      console.error('Batch publish error:', error);
      toast.error(error.response?.data?.message || 'Failed to publish selected schedules');
    }
  };

  const handlePublish = async () => {
    // The endpoint requires all four, and the button was enabled with only a
    // program selected, so publishing always came back 400.
    if (!filters.program || !filters.yearLevel || !filters.semester || !filters.academicYear) {
      toast.error('Select a program and year level (or a section) before publishing');
      return;
    }

    const count = schedules.filter(s => s.status !== 'published').length;
    if (count === 0) {
      toast('Everything in this view is already published');
      return;
    }
    if (!window.confirm(`Publish ${count} schedule(s) for ${filters.program} year ${filters.yearLevel}? Students will be able to see them.`)) {
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
      toast.error('Failed to check conflicts');
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
      toast.error('Failed to export schedule');
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

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedSection(null);
    setFilters(prev => ({
      program: isProgramManager ? user.program : '',
      yearLevel: '',
      semester: prev.semester,
      shift: '',
      academicYear: prev.academicYear
    }));
  };

  // Academic years offered in the picker: a couple back and one ahead of now,
  // so a manager isn't stuck with a hardcoded value.
  const academicYearOptions = useMemo(() => {
    const now = new Date();
    const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    const years = [];
    for (let offset = -2; offset <= 1; offset++) {
      years.push(`${start + offset}-${start + offset + 1}`);
    }
    // Keep whatever is currently selected selectable even if it's outside the range
    if (filters.academicYear && !years.includes(filters.academicYear)) {
      years.unshift(filters.academicYear);
    }
    return years;
  }, [filters.academicYear]);

  /** Sections available for the current program/academic-year context. */
  const sectionOptions = useMemo(() => {
    return sections.filter(s => {
      if (filters.program && s.program !== filters.program) return false;
      if (filters.academicYear && s.academicYear && s.academicYear !== filters.academicYear) return false;
      return true;
    });
  }, [sections, filters.program, filters.academicYear]);

  // The builder can only place classes once the target section is known, since
  // program/year/semester/shift all come from it.
  const builderReady = !!(filters.program && filters.yearLevel && filters.semester);

  // Filter schedules based on search
  const filteredSchedules = schedules.filter((schedule) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      schedule.subject?.subjectCode?.toLowerCase().includes(searchLower) ||
      schedule.subject?.subjectName?.toLowerCase().includes(searchLower) ||
      schedule.section?.toLowerCase().includes(searchLower) ||
      schedule.faculty?.user?.firstName?.toLowerCase().includes(searchLower) ||
      schedule.faculty?.user?.lastName?.toLowerCase().includes(searchLower) ||
      // `room` is an id string, so search the resolved label instead
      schedule.roomLabel?.toLowerCase().includes(searchLower)
    );
  });

  const hasActiveFilters = searchTerm || filters.program || filters.yearLevel || filters.shift;

  /** Distinct section codes present in the rows currently displayed. */
  const sectionsInView = useMemo(
    () => [...new Set(filteredSchedules.map(s => s.sectionCode).filter(Boolean))].sort(),
    [filteredSchedules]
  );

  // Students get their own timetable rather than the management view.
  // The management view filters by program, which for a student means "every
  // schedule in BSIT" instead of "my classes".
  if (isStudent) {
    return (
      <Layout>
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              My Schedule
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
              Your weekly timetable, built from the classes you are enrolled in
            </p>
          </div>
          <StudentSchedule />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Schedule Management
            </h1>
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
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg text-sm"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                
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
          <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base">
            {canEditSchedules ? 'Manage class schedules and timetables' : 'View class schedules'}
          </p>
        </div>

        {/* Compact stats strip. Four full-height coloured cards used to push the
            actual timetable below the fold. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <span className="inline-flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-gray-900 dark:text-white">{stats.total}</span>
            <span className="text-gray-500 dark:text-gray-400">in view</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-bold text-gray-900 dark:text-white">{stats.published}</span>
            <span className="text-gray-500 dark:text-gray-400">published</span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-orange-500" />
            <span className="font-bold text-gray-900 dark:text-white">{stats.draft}</span>
            <span className="text-gray-500 dark:text-gray-400">draft</span>
          </span>
          {stats.conflicts > 0 && (
            <button
              onClick={() => setShowConflictWarning(true)}
              className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="font-bold">{stats.conflicts}</span>
              <span>conflict{stats.conflicts === 1 ? '' : 's'}</span>
            </button>
          )}
        </div>

        {/* Search and Filters */}
        {!isStudent && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by subject, faculty, room, or section..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {/* Academic year. There was previously no control for this at
                    all, so it was stuck on the hardcoded default. */}
                <select
                  value={filters.academicYear}
                  onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })}
                  title="Academic year"
                  className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
                >
                  {academicYearOptions.map(ay => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>

                {/* Semester, likewise previously unsettable */}
                <select
                  value={filters.semester}
                  onChange={(e) => setFilters({ ...filters, semester: parseInt(e.target.value, 10) })}
                  title="Semester"
                  className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all"
                >
                  <option value={1}>1st Sem</option>
                  <option value={2}>2nd Sem</option>
                </select>

                {/* Program — locked for program managers */}
                <select
                  value={filters.program}
                  onChange={(e) => {
                    // Changing program invalidates the chosen section
                    setSelectedSection(null);
                    setFilters({ ...filters, program: e.target.value, yearLevel: '', shift: '' });
                  }}
                  disabled={isProgramManager}
                  title="Program"
                  className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {isProgramManager ? (
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

                {/* Section — the primary control. Choosing one sets program,
                    year level, semester and shift together, which is everything
                    the builder and Publish require. This used to render for
                    program managers only, leaving admins with no way to set
                    year/semester/shift at all. */}
                {canEditSchedules && (
                  <select
                    value={selectedSection?._id || ''}
                    onChange={(e) => handleSectionSelect(e.target.value)}
                    title="Section to work on"
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-all focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      selectedSection
                        ? 'border-2 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-2 border-dashed border-blue-400 text-blue-600 dark:text-blue-400 ring-2 ring-blue-200 dark:ring-blue-900'
                    }`}
                  >
                    <option value="">
                      {sectionOptions.length === 0 ? 'No sections available' : 'Choose a section…'}
                    </option>
                    {sectionOptions.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.sectionCode} — Year {s.yearLevel} · Sem {s.semester} · {s.shift}
                      </option>
                    ))}
                  </select>
                )}

                {/* View Toggle */}
                <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title="List View"
                  >
                    <List className="w-5 h-5" />
                  </button>
                  {canEditSchedules && (
                    <button
                      onClick={() => setViewMode('builder')}
                      className={`px-3 py-2 border-l border-gray-300 dark:border-gray-600 rounded-r-lg transition-colors ${
                        viewMode === 'builder' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                      title="Schedule Builder"
                    >
                      <Grid className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                      Search: {searchTerm}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100" 
                        onClick={() => setSearchTerm('')}
                      />
                    </span>
                  )}
                  {filters.program && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                      Program: {filters.program}
                      {!isProgramManager && (
                        <X 
                          className="w-3 h-3 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100" 
                          onClick={() => setFilters({...filters, program: ''})}
                        />
                      )}
                    </span>
                  )}
                  {filters.yearLevel && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                      Year {filters.yearLevel}
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100" 
                        onClick={() => setFilters({...filters, yearLevel: ''})}
                      />
                    </span>
                  )}
                  {filters.shift && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                      {filters.shift} Shift
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-blue-900 dark:hover:text-blue-100" 
                        onClick={() => setFilters({...filters, shift: ''})}
                      />
                    </span>
                  )}
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons. Always rendered, disabled with an explanation
                rather than disappearing when prerequisites are unmet. */}
            {canEditSchedules && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCheckConflicts}
                  disabled={!builderReady}
                  title={builderReady ? 'Check this section for clashes' : 'Choose a section first'}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AlertTriangle size={18} />
                  Check Conflicts
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
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} />
                  Publish {stats.draft > 0 ? `(${stats.draft})` : ''}
                </button>
                {!builderReady && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Choose a section to enable these
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Selected Section Info Banner — program manager */}
        {isProgramManager && selectedSection && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <School className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                    {selectedSection.sectionCode}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {selectedSection.program} &nbsp;·&nbsp; Year {selectedSection.yearLevel} &nbsp;·&nbsp; Semester {selectedSection.semester} &nbsp;·&nbsp; {selectedSection.shift} Shift
                    {selectedSection.adviser?.user && (
                      <> &nbsp;·&nbsp; Adviser: {selectedSection.adviser.user.firstName} {selectedSection.adviser.user.lastName}</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSectionSelect('')}
                className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Student View Notice */}
        {isStudent && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4 dark:bg-blue-900 dark:border-blue-700">
            <div className="flex items-start">
              <CalendarIcon className="text-blue-600 mt-0.5 mr-3 dark:text-blue-400" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1 dark:text-blue-100">
                  Your Class Schedule
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Showing schedules for {user?.program || 'your program'} - Year {user?.yearLevel || 'N/A'} - Section {user?.section || 'N/A'}
                  {user?.shift && ` - ${user.shift} Shift`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 dark:bg-red-900 dark:border-red-700">
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

        {/* Main Content Area */}
        {/* The builder is checked BEFORE the loading branch on purpose.
            `onAssignmentChange` triggers loadAllData, which set loading = true and
            swapped the builder for a spinner - unmounting it and discarding any
            remaining pending cards, undo history, subject search and scroll
            position on every single save. It now stays mounted and shows its own
            inline refresh state. */}
        {viewMode === 'builder' && !builderReady ? (
          /* Tell the manager what to do up front. Previously the builder
             rendered regardless and only complained after a failed drag with
             "Select Program, Year Level and Semester first" - which no control
             on this page could satisfy. */
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
                className="px-4 py-2.5 border-2 border-blue-500 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-300 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a section…</option>
                {sectionOptions.map(s => (
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
        ) : viewMode === 'builder' ? (
          <ScheduleBuilder 
            filters={filters}
            subjects={subjects}
            sections={sections}
            faculty={faculty}
            rooms={rooms}
            selectedSection={selectedSection}
            onAssignmentChange={loadAllData}
          />
        ) : loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading schedules...</p>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            {filteredSchedules.length === 0 ? (
              <div className="p-16 text-center">
                <CalendarIcon className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No schedules found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {searchTerm || hasActiveFilters
                    ? 'Try adjusting your search or filter criteria'
                    : 'Get started by creating your first schedule'
                  }
                </p>
                {canEditSchedules && !searchTerm && !hasActiveFilters && (
                  <button
                    onClick={handleCreate}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add First Schedule
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Bulk Action Bar */}
                {selectedSchedules.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={filteredSchedules.length > 0 && selectedSchedules.length === filteredSchedules.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        title="Select All"
                      />
                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {selectedSchedules.length} of {filteredSchedules.length} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditSchedules && (
                        <>
                          <button
                            onClick={handleBatchPublishSelected}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Publish Selected ({selectedSchedules.length})
                          </button>
                          <button
                            onClick={handleBatchDeleteSelected}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm"
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
                          type="checkbox"
                          checked={filteredSchedules.length > 0 && selectedSchedules.length === filteredSchedules.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          title={selectedSchedules.length === filteredSchedules.length ? "Deselect All" : "Select All"}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Faculty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Room
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      {canEditSchedules && (
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSchedules.map((schedule) => {
                      const isSelected = selectedSchedules.includes(schedule._id);
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
                              {schedule.section || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {schedule.faculty ? 
                              `${schedule.faculty.user?.firstName || ''} ${schedule.faculty.user?.lastName || ''}`.trim() || 'N/A'
                              : 'N/A'
                            }
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
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 dark:text-white space-y-1">
                            {schedule.timeSlots && schedule.timeSlots.length > 0 ? (
                              schedule.timeSlots.slice(0, 2).map((ts, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span>{ts.day}: {ts.startTime} - {ts.endTime}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-400">No time slots</span>
                            )}
                            {schedule.timeSlots && schedule.timeSlots.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{schedule.timeSlots.length - 2} more
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            schedule.status === 'published'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                          }`}>
                            {schedule.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        {canEditSchedules && (
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEdit(schedule)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(schedule._id)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                                title="Delete"
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
              </div>
            )}
          </div>
        )}

        {/* View Mode Info */}
        {viewMode === 'builder' && (
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
          sections={sections}
          faculty={faculty}
          rooms={rooms}
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
    </Layout>
  );
};

export default SchedulePage;
