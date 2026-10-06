import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCache } from '../context/CacheContext';
import useCachedData from '../hooks/useCachedData';
import Layout from '../components/Layout';
import MyClassesEnrollment from '../components/MyClassesEnrollment';
import { 
  Users, BookOpen, DoorOpen, Calendar, 
  TrendingUp, Clock, CheckCircle, AlertTriangle,
  RefreshCw, Info, UserCheck, UserX, FileClock,
  Banknote, Wallet, TrendingDown, Bell, GraduationCap
} from 'lucide-react';
import { facultyAPI, subjectAPI, roomAPI, scheduleAPI, classSpaceAPI, userAPI, studentAPI, dashboardAPI } from '../services/api';
import toast from 'react-hot-toast';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';

const DashboardPage = () => {
  const { user, setAuth, token } = useAuth();
  const { invalidateCache } = useCache();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // 'month' or 'quarter'
  const [pageReady, setPageReady] = useState(false);

  // Page entrance zoom animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // These aggregate stats are only rendered for staff. Students and faculty have
  // their own dashboard sections, so firing the staff endpoints for them just
  // produced a row of 403s on every dashboard load.
  const STAFF_ROLES = ['admin', 'scheduling_officer', 'program_manager'];
  const canSeeStats = STAFF_ROLES.includes(user?.role);

  // ✅ CACHE: Dashboard stats with stale-while-revalidate
  const {
    data: stats,
    loading,
    error: statsError,
    refetch: refetchStats,
    isFromCache: statsFromCache
  } = useCachedData(
    () => dashboardAPI.getStats(),
    'dashboard-stats',
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: canSeeStats, // Only fetch if user can see stats
      onSuccess: (data) => {
        console.log('✅ Dashboard stats loaded:', statsFromCache ? '📦 from cache' : '🌐 fresh fetch');
      },
      onError: (err) => {
        console.error('❌ Failed to load dashboard stats:', err);
        toast.error('Failed to load dashboard statistics');
      }
    }
  );

  // Normalize stats data (handle undefined)
  const statsData = stats || {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalFaculty: 0,
    activeFaculty: 0,
    totalSubjects: 0,
    totalRooms: 0,
    totalSchedules: 0,
    publishedSchedules: 0,
    totalClasses: 0,
    programStudents: 0,
    programSubjects: 0,
    programSchedules: 0,
    programByYear: [],
    programBySemester: []
  };

  // ✅ CACHE: Schedule conflicts with shorter cache (conflicts change frequently)
  const {
    data: conflicts,
    loading: loadingConflicts,
    refetch: refetchConflicts,
    isFromCache: conflictsFromCache
  } = useCachedData(
    () => scheduleAPI.getConflicts(true),
    'schedule-conflicts',
    {
      cacheDuration: 3 * 60 * 1000, // 3 minutes (conflicts are urgent)
      enabled: user?.role === 'admin' || user?.role === 'scheduling_officer',
      onSuccess: (data) => {
        console.log('✅ Conflicts loaded:', conflictsFromCache ? '📦 from cache' : '🌐 fresh fetch');
      }
    }
  );

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

const ModernStatCard = ({ icon: Icon, label, value, sublabel }) => (
  <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-blue-700 dark:bg-gray-800">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-white dark:bg-gray-700">
      <Icon className="h-6 w-6 text-black dark:text-white" />
    </div>
 
    <div className="text-4xl font-extrabold text-black dark:text-white">
      {loading ? (
        <div className="h-10 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      ) : (
        value
      )}
    </div>
 
    <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-black dark:text-gray-300">
      {label}
    </p>
 
    {sublabel && (
      <span className="mt-4 inline-block rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300">
        {sublabel}
      </span>
    )}
  </div>
);

  return (
    <Layout>
      {/* Background Image Overlay */}
      <div 
        className="fixed inset-0 z-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url(${ctuBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      ></div>

      {/* Content with relative positioning */}
      <div className={`relative z-10 transition-all duration-700 ease-out ${
        pageReady ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
      {/* Header Section - Only for staff roles (admin, scheduling_officer, program_manager) */}
      {canSeeStats && (
     <div className="mb-6 rounded-3xl bg-blue-900 px-4 sm:px-8 py-5 sm:py-7 text-white shadow-xl ring-1 ring-white/5">
  <div className="flex flex-col gap-4">
    {/* Top Section - Title and Badge */}
    <div className="min-w-0">
      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-100">
        <GraduationCap size={14} />
        CTU Daanbantayan Campus
      </span>
      <h1 className="mt-3 text-2xl sm:text-3xl font-bold">
        Good day, {user?.role === 'admin' ? 'System Administrator' : user?.firstName}
      </h1>
      <p className="mt-2 text-xs sm:text-sm text-blue-200">
        Real-time overview • {formatDate()}
      </p>
    </div>
 
    {/* Bottom Section - Controls */}
    {canSeeStats && (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {/* Period Toggle Buttons */}
        <div className="flex gap-2 flex-1 sm:flex-initial">
          <button
            onClick={() => setSelectedPeriod(selectedPeriod === 'month' ? 'quarter' : 'month')}
            className={`flex-1 sm:flex-initial rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-yellow-400 text-blue-900 shadow-lg shadow-yellow-400/30'
                : 'border border-white/10 bg-white/5 text-blue-100 hover:bg-white/10'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setSelectedPeriod(selectedPeriod === 'quarter' ? 'month' : 'quarter')}
            className={`flex-1 sm:flex-initial rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
              selectedPeriod === 'quarter'
                ? 'bg-yellow-400 text-blue-900 shadow-lg shadow-yellow-400/30'
                : 'border border-white/10 bg-white/5 text-blue-100 hover:bg-white/10'
            }`}
          >
            This Quarter
          </button>
        </div>

        {/* Live Clock + Refresh Button */}
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-white/5 py-2 px-3">
          <span className="flex items-center gap-2 text-xs flex-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400 flex-shrink-0" />
            <span className="font-bold text-yellow-400">LIVE</span>
            <span className="text-blue-200">{formatTime()}</span>
          </span>
          <button
            onClick={refetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-yellow-400/30 px-3 py-2 text-xs sm:text-sm font-semibold transition-colors hover:bg-yellow-400/50 disabled:opacity-50 flex-shrink-0"
            title={statsFromCache ? '📦 Showing cached data - Click to refresh' : '🌐 Fresh data loaded'}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : 'transition-transform hover:rotate-180 duration-300'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    )}
  </div>
</div>
      )}

      {/* Schedule Conflict Warning Banner */}
      {(user?.role === 'admin' || user?.role === 'scheduling_officer') && conflicts?.hasConflicts && (
        <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-500 dark:border-red-600 rounded-xl p-6 shadow-lg animate-pulse">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                Schedule Conflicts Detected - Immediate Action Required!
              </h3>
              <p className="text-red-800 dark:text-red-200 mb-4">
                There {conflicts.totalConflicts === 1 ? 'is' : 'are'} <span className="font-bold text-2xl">{conflicts.totalConflicts}</span> scheduling conflict{conflicts.totalConflicts !== 1 ? 's' : ''} that need to be resolved immediately.
                {conflicts.highSeverity > 0 && (
                  <span className="ml-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
                    {conflicts.highSeverity} HIGH PRIORITY
                  </span>
                )}
              </p>
              
              {/* Critical Conflicts Preview */}
              {conflicts.criticalConflicts && conflicts.criticalConflicts.length > 0 && (
                <div className="space-y-2 mb-4">
                  {conflicts.criticalConflicts.slice(0, 3).map((conflict, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                          {conflict.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {conflict.day} • {conflict.timeRange}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {conflict.type === 'FACULTY_DOUBLE_BOOKING' && (
                          <>Faculty <span className="font-semibold">{conflict.faculty?.name}</span> is assigned to multiple classes</>
                        )}
                        {conflict.type === 'ROOM_DOUBLE_BOOKING' && (
                          <>Room <span className="font-semibold">{conflict.room}</span> is double-booked</>
                        )}
                        {conflict.type === 'SECTION_DOUBLE_BOOKING' && (
                          <>Section <span className="font-semibold">{conflict.section}</span> has overlapping classes</>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.location.href = '/schedules'}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <AlertTriangle className="w-5 h-5" />
                  View & Fix Conflicts Now
                </button>
                <button
                  onClick={refetchConflicts}
                  disabled={loadingConflicts}
                  className="px-4 py-3 bg-white dark:bg-gray-700 border-2 border-red-500 dark:border-red-600 text-red-700 dark:text-red-300 font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  {loadingConflicts ? 'Checking...' : 'Refresh Check'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin/Scheduler Dashboard */}
      {(user?.role === 'admin' || user?.role === 'scheduling_officer') && (
        <>
          {/* Row 1: User & Faculty Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <ModernStatCard
              icon={Users}
              label="Total Users"
              value={statsData.totalUsers}
              sublabel="Real data"
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <ModernStatCard
              icon={UserCheck}
              label="Active Users"
              value={statsData.activeUsers}
              sublabel="Currently active"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={UserX}
              label="Inactive Users"
              value={statsData.inactiveUsers}
              sublabel="Suspended or archived"
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
            <ModernStatCard
              icon={FileClock}
              label="Pending Actions"
              value={0}
              sublabel="Awaiting review"
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
          </div>

          {/* Row 2: Academic Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <ModernStatCard
              icon={Users}
              label="Total Faculty"
              value={statsData.activeFaculty}
              sublabel={`${statsData.totalFaculty} total registered`}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
            <ModernStatCard
              icon={BookOpen}
              label="Total Subjects"
              value={statsData.totalSubjects}
              sublabel="Across all programs"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={DoorOpen}
              label="Total Rooms"
              value={statsData.totalRooms}
              sublabel="Available facilities"
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
            <ModernStatCard
              icon={Calendar}
              label="Active Schedules"
              value={statsData.totalSchedules}
              sublabel={`${statsData.publishedSchedules} published`}
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Row 3: Placeholder Stats (Financial/Class Management) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <ModernStatCard
              icon={Wallet}
              label="Class Spaces"
              value={statsData.totalClasses}
              sublabel="Active class spaces"
              iconColor="text-teal-600"
              iconBg="bg-teal-50"
            />
            <ModernStatCard
              icon={Banknote}
              label="Enrolled Students"
              value={statsData.activeUsers}
              sublabel="Current semester"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={Clock}
              label="Time Slots"
              value={0}
              sublabel="Coming soon"
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
            <ModernStatCard
              icon={Bell}
              label="Announcements"
              value={0}
              sublabel="System-wide alerts"
              iconColor="text-red-600"
              iconBg="bg-red-50"
            />
          </div>
        </>
      )}

      {/* Program Manager Dashboard */}
      {user?.role === 'program_manager' && (
        <>
          {/* Row 1: Program Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <ModernStatCard
              icon={Users}
              label="Program Students"
              value={statsData.programStudents}
              sublabel={`Enrolled in ${user?.program}`}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <ModernStatCard
              icon={BookOpen}
              label="Program Subjects"
              value={statsData.programSubjects}
              sublabel="Active curriculum"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={Calendar}
              label="Program Schedules"
              value={statsData.programSchedules}
              sublabel={`${statsData.publishedSchedules} published`}
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
            <ModernStatCard
              icon={CheckCircle}
              label="Active Classes"
              value={statsData.totalClasses}
              sublabel="Running this semester"
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 dark:bg-gray-800 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg dark:bg-gray-700">
                  <TrendingUp className="w-5 h-5 text-black dark:text-white" />
                </div>
                <h3 className="font-semibold text-black dark:text-white">Enrollment Trend</h3>
              </div>
              <p className="text-3xl font-bold text-black mb-1 dark:text-white">{statsData.programStudents}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total students enrolled</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-yellow-100 text-blue-700 rounded dark:bg-yellow-500/20 dark:text-yellow-300">Active</span>
                <span className="text-gray-500 dark:text-gray-400">Current semester</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 dark:bg-gray-800 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg dark:bg-gray-700">
                  <BookOpen className="w-5 h-5 text-black dark:text-white" />
                </div>
                <h3 className="font-semibold text-black dark:text-white">Curriculum Load</h3>
              </div>
              <p className="text-3xl font-bold text-black mb-1 dark:text-white">{statsData.programSubjects}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Subjects in curriculum</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded dark:bg-blue-500/20 dark:text-blue-300">Updated</span>
                <span className="text-gray-500 dark:text-gray-400">Latest curriculum</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 dark:bg-gray-800 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg dark:bg-gray-700">
                  <Calendar className="w-5 h-5 text-black dark:text-white" />
                </div>
                <h3 className="font-semibold text-black dark:text-white">Schedule Status</h3>
              </div>
              <p className="text-3xl font-bold text-black mb-1 dark:text-white">{statsData.publishedSchedules}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Published schedules</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-yellow-100 text-blue-700 rounded dark:bg-yellow-500/20 dark:text-yellow-300">Live</span>
                <span className="text-gray-500 dark:text-gray-400">of {statsData.programSchedules} total</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Faculty Dashboard */}
      {user?.role === 'faculty' && (
        <FacultyDashboard user={user} loading={loading} />
      )}

      {/* Student Dashboard.
          This used to be two hardcoded placeholder cards ("Your enrolled classes
          will appear here"), while the real StudentDashboard component below was
          defined but never rendered. */}
      {user?.role === 'student' && (
        <StudentDashboard user={user} loading={loading} />
      )}
      </div> {/* Close relative div */}
    </Layout>
  );
};

// Faculty Dashboard Component
const FacultyDashboard = ({ user, loading: parentLoading }) => {
  const { invalidateCache } = useCache();

  // ✅ CACHE: Faculty schedule with 3-minute cache (schedules change frequently)
  const facultyId = user?.facultyProfile?._id || user?.facultyProfile;
  
  const {
    data: facultyData,
    loading: loadingFaculty,
    error: facultyError
  } = useCachedData(
    () => facultyAPI.getById(facultyId),
    `faculty-profile-${facultyId}`,
    {
      cacheDuration: 10 * 60 * 1000, // 10 minutes (profile changes rarely)
      enabled: !!facultyId,
      onError: (err) => {
        console.error('Failed to load faculty profile:', err);
        toast.error('Failed to load your profile');
      }
    }
  );

  const {
    data: schedules,
    loading: loadingSchedules,
    refetch: refetchSchedules
  } = useCachedData(
    () => scheduleAPI.getFacultySchedule(facultyId),
    `faculty-schedule-${facultyId}`,
    {
      cacheDuration: 3 * 60 * 1000, // 3 minutes
      enabled: !!facultyId
    }
  );

  const {
    data: classes,
    loading: loadingClasses
  } = useCachedData(
    () => classSpaceAPI.getMyClasses(),
    `faculty-classes-${user?._id}`,
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: !!user?._id
    }
  );

  const loading = loadingFaculty || loadingSchedules || loadingClasses;
  const allSchedules = schedules || [];
  const classList = classes || [];

  // Filter today's schedule
  const todaySchedule = React.useMemo(() => {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];

    return allSchedules
      .filter(schedule => {
        return schedule.timeSlots?.some(slot => slot.day === todayName);
      })
      .map(schedule => ({
        ...schedule,
        todaySlots: schedule.timeSlots.filter(slot => slot.day === todayName)
      }))
      .sort((a, b) => {
        const timeA = a.todaySlots[0]?.startTime || '00:00';
        const timeB = b.todaySlots[0]?.startTime || '00:00';
        return timeA.localeCompare(timeB);
      });
  }, [allSchedules]);

  const formatTime = (time) => {
    if (!time) return '';
    // Convert 24h to 12h format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  if (loading || parentLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-gray-200 rounded-lg h-48"></div>
        <div className="bg-gray-200 rounded-lg h-64"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-xl shadow-xl p-6 text-white">
        <div className="flex items-start gap-5 mb-4">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            {user?.profilePicture ? (
              <>
                <img
                  src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${user.profilePicture}`}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-yellow-400/50 shadow-xl"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
                <div 
                  className="w-20 h-20 bg-yellow-400/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-yellow-400/50 shadow-xl"
                  style={{ display: 'none' }}
                >
                  <Users className="w-10 h-10 text-yellow-400" />
                </div>
              </>
            ) : (
              <div className="w-20 h-20 bg-yellow-400/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-yellow-400/50 shadow-xl">
                <Users className="w-10 h-10 text-yellow-400" />
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold mb-1">Welcome back, {user?.firstName}!</h2>
            <p className="text-blue-100 text-sm font-medium mb-2">
              Faculty ID: {facultyData?.employeeId || 'Loading...'}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-yellow-400/20 backdrop-blur-sm rounded-full text-xs font-semibold text-yellow-100">
                {facultyData?.position || 'Faculty'}
              </span>
              {facultyData?.employmentType && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  facultyData.employmentType === 'Regular'
                    ? 'bg-yellow-400 text-blue-900'
                    : 'bg-white/20 text-white'
                }`}>
                  {facultyData.employmentType}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:bg-white/15 transition-all shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-indigo-100 text-sm font-semibold">Department</p>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{facultyData?.department || 'Loading...'}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:bg-white/15 transition-all shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-indigo-100 text-sm font-semibold">Total Classes</p>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{classes.length}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20 hover:bg-white/15 transition-all shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-indigo-100 text-sm font-semibold">Today's Classes</p>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold">{todaySchedule.length}</p>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg dark:bg-indigo-900">
              <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Your Schedule for Today
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getCurrentDay()}, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/my-schedule'}
            className="px-4 py-2 text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium dark:text-indigo-400 dark:border-indigo-400 dark:hover:bg-indigo-900/20"
          >
            View Full Schedule
          </button>
        </div>

        {todaySchedule.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-16 h-16 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">No classes scheduled for today</p>
            <p className="text-sm mt-1">Enjoy your free day!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaySchedule.map((schedule, index) => (
              <div
                key={schedule._id || index}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-md transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-indigo-400"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Subject Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-indigo-50 rounded-lg dark:bg-indigo-900/30">
                        <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                          {schedule.subject?.subjectCode || 'N/A'}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400">
                          {schedule.subject?.subjectName || 'Subject name not available'}
                        </p>
                      </div>
                    </div>

                    {/* Schedule Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                      {/* Time */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {schedule.todaySlots.map(slot => 
                              `${formatTime(slot.startTime)}-${formatTime(slot.endTime)}`
                            ).join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* Room */}
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Room</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {schedule.roomData?.roomName || schedule.roomData?.roomCode || schedule.room || 'TBA'}
                          </p>
                        </div>
                      </div>

                      {/* Section */}
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Section</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {schedule.sectionCode || schedule.section || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Year & Program */}
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Year & Program</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {schedule.yearLevel || 'N/A'} - {schedule.program || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                        {schedule.subject?.units || 0} units
                      </span>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">
                        Semester {schedule.semester || 1}
                      </span>
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
                        AY {schedule.academicYear || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Total Schedules</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{allSchedules.length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Active teaching schedules</p>
        </div>

        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Class Spaces</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{classes.length}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Active class spaces</p>
          <button
            onClick={() => window.location.href = '/classes'}
            className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium dark:text-green-400"
          >
            Manage Classes →
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/30">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">This Week</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {allSchedules.reduce((total, schedule) => {
              return total + (schedule.timeSlots?.length || 0);
            }, 0)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total class sessions</p>
        </div>
      </div>

      {/* My Classes Section */}
      <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            My Class Spaces
          </h3>
          <button
            onClick={() => window.location.href = '/classes'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            View All Classes
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No class spaces assigned yet</p>
            <p className="text-sm mt-1">Class spaces will appear here once schedules are created</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.slice(0, 6).map((classSpace) => (
              <div
                key={classSpace._id}
                onClick={() => window.location.href = '/classes'}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-400 cursor-pointer transition-all hover:shadow-md dark:bg-gray-700 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {classSpace.subject?.subjectCode || classSpace.sectionCode}
                    </p>
                    {classSpace.subject?.subjectName && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 mt-1">
                        {classSpace.subject.subjectName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded dark:bg-indigo-900/30 dark:text-indigo-400">
                    {classSpace.sectionCode || 'N/A'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {classSpace.students?.length || 0} students
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


// Student Dashboard Component
const StudentDashboard = ({ user, loading: parentLoading }) => {
  // ✅ CACHE: Student classes with 5-minute cache
  const {
    data: studentResponse,
    loading,
    error,
    refetch: refetchStudentData
  } = useCachedData(
    () => classSpaceAPI.getMyClasses(),
    `student-classes-${user?._id}`,
    {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      enabled: !!user?._id,
      onError: (err) => {
        console.error('Failed to load student data:', err);
        toast.error(
          err.response?.data?.message || 'Failed to load your enrollment information'
        );
      }
    }
  );

  const studentData = studentResponse?.profile || null;
  const classes = studentResponse?.data || [];

  /** "Monday 08:00-09:00" for the first meeting of a class. */
  const describeSlots = (cs) => {
    const slots = cs.schedule?.timeSlots || [];
    if (slots.length === 0) return 'Schedule to be announced';
    const first = `${slots[0].day} ${slots[0].startTime}-${slots[0].endTime}`;
    return slots.length > 1 ? `${first} +${slots.length - 1} more` : first;
  };

  if (loading || parentLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="bg-gray-200 rounded-lg h-48"></div>
        <div className="bg-gray-200 rounded-lg h-64"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Header - Simplified */}
      <div className="mb-6 rounded-3xl bg-blue-900 px-4 sm:px-8 py-5 sm:py-7 text-white shadow-xl ring-1 ring-white/5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-yellow-100">
              <GraduationCap size={14} />
              CTU Daanbantayan Campus
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold">
              Good day, {user?.firstName}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-blue-200">
              Real-time overview • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex-shrink-0">
            <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Enrollment Information - Below Header */}
      {!studentData ? (
        <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
          <p className="text-gray-900 dark:text-white font-medium">No enrollment record found</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Please contact your program manager</p>
        </div>
      ) : studentData.studentType === 'regular' && !studentData.sectionCode ? (
        <div className="text-center py-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-orange-500" />
          <p className="font-medium text-gray-900 dark:text-white">Section Not Assigned</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Your program manager will assign you to a section soon</p>
        </div>
      ) : studentData.studentType === 'irregular' && (!studentData.subjectCodes || studentData.subjectCodes.length === 0) ? (
        <div className="text-center py-6 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-orange-500" />
          <p className="font-medium text-gray-900 dark:text-white">No Subjects Enrolled</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Your program manager will assign your subjects soon</p>
        </div>
      ) : (
        <>
          {/* Stat Cards Grid - Matching Program Manager Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Program Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
              <div className="mb-3 sm:mb-5 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white dark:bg-gray-700">
                <BookOpen className="h-6 w-6 sm:h-7 sm:w-7 text-black dark:text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2 truncate">
                {user?.program || studentData?.program || 'N/A'}
              </div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                Program
              </p>
              <span className="inline-block rounded-full bg-yellow-100 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                {studentData?.studentType || 'Regular'}
              </span>
            </div>

            {/* Section/Subjects Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
              <div className="mb-3 sm:mb-5 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white dark:bg-gray-700">
                <Users className="h-6 w-6 sm:h-7 sm:w-7 text-black dark:text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2 truncate">
                {studentData?.studentType === 'regular' 
                  ? (studentData?.sectionCode || 'N/A')
                  : (studentData?.subjectCodes?.length || 0)
                }
              </div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                {studentData?.studentType === 'regular' ? 'Section' : 'Enrolled Subjects'}
              </p>
              <span className="inline-block rounded-full bg-yellow-100 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300 truncate max-w-full">
                {studentData?.studentType === 'regular' ? 'Regular Student' : `${studentData?.subjectCodes?.length || 0} Subjects`}
              </span>
            </div>

            {/* Academic Year Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
              <div className="mb-3 sm:mb-5 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white dark:bg-gray-700">
                <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-black dark:text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">
                {studentData.academicYear}
              </div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                Academic Year
              </p>
              <span className="inline-block rounded-full bg-yellow-100 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                {studentData.semester === 1 ? '1st Semester' : '2nd Semester'}
              </span>
            </div>

            {/* Enrollment Status Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
              <div className="mb-3 sm:mb-5 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white dark:bg-gray-700">
                <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-black dark:text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2 capitalize truncate">
                {studentData.enrollmentStatus || 'N/A'}
              </div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                Enrollment Status
              </p>
              <span className={`inline-block rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide ${
                studentData.enrollmentStatus === 'enrolled'
                  ? 'bg-yellow-100 text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {studentData.enrollmentStatus === 'enrolled' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Enrolled Subjects - For Irregular Students */}
          {studentData.studentType === 'irregular' && studentData.subjectCodes?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-blue-200 dark:border-blue-700 shadow-sm">
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                Enrolled Subjects
              </h3>
              <div className="flex flex-wrap gap-2">
                {studentData.subjectCodes.map((code, index) => (
                  <span
                    key={index}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-100 text-blue-700 dark:bg-yellow-500/20 dark:text-yellow-300 rounded-full text-xs sm:text-sm font-medium border border-yellow-200 dark:border-yellow-800"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 dark:bg-gray-800 dark:border-blue-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg dark:bg-gray-700 flex-shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-black dark:text-white">
                Today's Schedule
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/classes'}
            className="px-4 py-2 text-sm sm:text-base text-blue-700 border-2 border-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-900/20 w-full sm:w-auto"
          >
            View All Classes
          </button>
        </div>

        {(() => {
          if (classes.length === 0) {
            return (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Calendar className="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-lg font-medium text-gray-900 dark:text-white">No classes yet</p>
                <p className="text-sm mt-1">
                  {studentData?.studentType === 'irregular'
                    ? 'Join a subject with a class code from your instructor.'
                    : 'Join your section with the enrollment code from your program manager.'}
                </p>
                <button
                  onClick={() => window.location.href = '/classes'}
                  className="mt-4 px-6 py-3 bg-yellow-400 text-blue-900 rounded-lg hover:bg-yellow-500 transition-colors text-sm font-bold shadow-md"
                >
                  {studentData?.studentType === 'irregular' ? 'Join a Subject' : 'Join My Section'}
                </button>
              </div>
            );
          }

          // Filter today's classes
          const today = new Date();
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const todayName = dayNames[today.getDay()];
          const currentTime = today.getHours() * 60 + today.getMinutes(); // Current time in minutes since midnight

          // Helper to convert "HH:MM" to minutes since midnight
          const timeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
          };

          const todayClasses = classes
            .filter(cs => {
              const slots = cs.schedule?.timeSlots || [];
              return slots.some(slot => {
                if (slot.day !== todayName) return false;
                // Include if class is currently happening or hasn't started yet
                const startTime = timeToMinutes(slot.startTime);
                const endTime = timeToMinutes(slot.endTime);
                return endTime > currentTime; // Show current and upcoming classes
              });
            })
            .map(cs => ({
              ...cs,
              todaySlots: (cs.schedule?.timeSlots || [])
                .filter(slot => {
                  if (slot.day !== todayName) return false;
                  const endTime = timeToMinutes(slot.endTime);
                  return endTime > currentTime; // Only upcoming/current slots
                })
            }))
            .sort((a, b) => {
              const timeA = a.todaySlots[0]?.startTime || '00:00';
              const timeB = b.todaySlots[0]?.startTime || '00:00';
              return timeA.localeCompare(timeB);
            });

          if (todayClasses.length === 0) {
            // Check if there were classes today but they've all ended
            const hadClassesToday = classes.some(cs => {
              const slots = cs.schedule?.timeSlots || [];
              return slots.some(slot => slot.day === todayName);
            });

            return (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Calendar className="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {hadClassesToday ? 'All classes for today have ended' : 'No classes scheduled for today'}
                </p>
                <p className="text-sm mt-1">
                  {hadClassesToday ? 'Great job! See you tomorrow.' : 'Enjoy your free day!'}
                </p>
                <button
                  onClick={() => window.location.href = '/classes'}
                  className="mt-4 px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-bold shadow-md"
                >
                  View All Classes ({classes.length})
                </button>
              </div>
            );
          }

          const formatTime = (time) => {
            if (!time) return '';
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
          };

          const isClassHappeningNow = (startTime, endTime) => {
            const start = timeToMinutes(startTime);
            const end = timeToMinutes(endTime);
            return currentTime >= start && currentTime < end;
          };

          return (
            <div className="space-y-4">
              {todayClasses.map((cs) => {
                const teacher = cs.faculty?.user
                  ? `${cs.faculty.user.firstName || ''} ${cs.faculty.user.lastName || ''}`.trim()
                  : null;
                
                const isNow = cs.todaySlots.some(slot => 
                  isClassHappeningNow(slot.startTime, slot.endTime)
                );
                
                return (
                  <div
                    key={cs._id}
                    className={`bg-white border-2 rounded-xl p-5 transition-all dark:bg-gray-700 ${
                      isNow 
                        ? 'border-green-500 shadow-lg shadow-green-500/20 dark:border-green-400' 
                        : 'border-blue-200 hover:border-yellow-400 hover:shadow-lg dark:border-blue-700 dark:hover:border-yellow-500'
                    }`}
                  >
                    {/* Status Badge */}
                    {isNow && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400 uppercase">
                          Happening Now
                        </span>
                      </div>
                    )}
                    {/* Subject Header */}
                    <div className="flex items-start gap-3 sm:gap-4 mb-4">
                      <div className="p-2 sm:p-3 bg-white rounded-xl dark:bg-gray-700 flex-shrink-0">
                        <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg sm:text-xl text-blue-900 dark:text-white">
                          {cs.subject?.subjectCode || cs.sectionCode}
                        </h4>
                        {cs.subject?.subjectName && (
                          <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mt-1">
                            {cs.subject.subjectName}
                          </p>
                        )}
                        {teacher && (
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="font-medium truncate">{teacher}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Schedule Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                      {/* Time */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-white rounded-lg dark:bg-gray-700 flex-shrink-0">
                          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Time</p>
                          <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {cs.todaySlots.map(slot => 
                              `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
                            ).join(', ')}
                          </p>
                        </div>
                      </div>

                      {/* Room */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-white rounded-lg dark:bg-gray-700 flex-shrink-0">
                          <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Room</p>
                          <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {cs.schedule?.roomLabel || cs.schedule?.room || 'TBA'}
                          </p>
                        </div>
                      </div>

                      {/* Section */}
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-white rounded-lg dark:bg-gray-700 flex-shrink-0">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-black dark:text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">Section</p>
                          <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {cs.sectionCode || cs.schedule?.sectionCode || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="flex items-center flex-wrap gap-2 sm:gap-3 mt-4">
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-100 text-blue-900 rounded-full text-[10px] sm:text-xs font-bold dark:bg-yellow-900/30 dark:text-yellow-300">
                        {cs.subject?.units || 0} Units
                      </span>
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-100 text-blue-900 rounded-full text-[10px] sm:text-xs font-bold dark:bg-blue-900/30 dark:text-blue-300">
                        {cs.announcements?.length || 0} Announcements
                      </span>
                      <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-100 text-green-900 rounded-full text-[10px] sm:text-xs font-bold dark:bg-green-900/30 dark:text-green-300">
                        {cs.materials?.length || 0} Materials
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};


export default DashboardPage;
