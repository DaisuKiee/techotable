import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import MyClassesEnrollment from '../components/MyClassesEnrollment';
import { 
  Users, BookOpen, DoorOpen, Calendar, 
  TrendingUp, Clock, CheckCircle, AlertTriangle,
  RefreshCw, Info, UserCheck, UserX, FileClock,
  Banknote, Wallet, TrendingDown, Bell, GraduationCap
} from 'lucide-react';
import { facultyAPI, subjectAPI, roomAPI, scheduleAPI, classSpaceAPI, userAPI, studentAPI } from '../services/api';
import toast from 'react-hot-toast';
import ctuBg from '../assets/images/backgrounds/ctu-bg.png';

const DashboardPage = () => {
  const { user, setAuth, token } = useAuth();
  const [stats, setStats] = useState({
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
    // Program manager specific
    programStudents: 0,
    programSubjects: 0,
    programSchedules: 0,
    programByYear: [],
    programBySemester: []
  });
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (canSeeStats) {
      loadDashboardStats();
    } else {
      setLoading(false);
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, [canSeeStats]);

  const loadDashboardStats = async () => {
    try {
      const [facultyRes, subjectRes, roomRes, scheduleRes, usersRes, classSpaceRes, studentRes] = await Promise.all([
        facultyAPI.getAll().catch(() => ({ data: { data: [] } })),
        subjectAPI.getAll().catch(() => ({ data: { data: [] } })),
        roomAPI.getAll().catch(() => ({ data: { data: [] } })),
        scheduleAPI.getAll().catch(() => ({ data: { data: [] } })),
        userAPI.getAll().catch(() => ({ data: { data: [] } })),
        classSpaceAPI.getAll().catch(() => ({ data: { data: [] } })),
        studentAPI.getAll().catch(() => ({ data: { data: [] } }))
      ]);

      const facultyData = facultyRes.data.data || [];
      const scheduleData = scheduleRes.data.data || [];
      const usersData = usersRes.data.data || [];
      const studentData = studentRes.data.data || [];
      const subjectData = subjectRes.data.data || [];

      // Calculate year level distribution
      const yearDistribution = studentData.reduce((acc, student) => {
        const year = student.yearLevel || 'Unknown';
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {});

      // Calculate semester distribution
      const semesterDistribution = studentData.reduce((acc, student) => {
        const sem = student.semester || 1;
        acc[sem] = (acc[sem] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalUsers: usersData.length,
        activeUsers: usersData.filter(u => u.isActive).length,
        inactiveUsers: usersData.filter(u => !u.isActive).length,
        totalFaculty: facultyData.length,
        activeFaculty: facultyData.filter(f => f.isActive).length,
        totalSubjects: subjectRes.data.count || subjectData.length,
        totalRooms: roomRes.data.count || (roomRes.data.data || []).length,
        totalSchedules: scheduleData.length,
        publishedSchedules: scheduleData.filter(s => s.isPublished || s.status === 'published').length,
        totalClasses: classSpaceRes.data.count || (classSpaceRes.data.data || []).length,
        // Program manager specific
        programStudents: studentData.length,
        programSubjects: subjectData.length,
        programSchedules: scheduleData.length,
        programByYear: Object.entries(yearDistribution).map(([year, count]) => ({ year, count })),
        programBySemester: Object.entries(semesterDistribution).map(([semester, count]) => ({ semester, count }))
      });
    } catch (error) {
      console.error('Load stats error:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

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

  const ModernStatCard = ({ icon: Icon, label, value, sublabel, iconColor, iconBg }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1 dark:text-gray-400">{label}</p>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {loading ? (
              <div className="animate-pulse h-9 w-20 bg-gray-200 rounded dark:bg-gray-700"></div>
            ) : (
              value
            )}
          </div>
          {sublabel && (
            <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">{sublabel}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
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
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-100">
              Good day, {user?.role === 'admin' ? 'System Administrator' : user?.firstName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time overview • CTU Daanbantayan Campus • {formatDate()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh and the period toggle only drive the staff stats */}
            {canSeeStats && (
              <>
                <button
                  onClick={loadDashboardStats}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={() => setSelectedPeriod(selectedPeriod === 'month' ? 'quarter' : 'month')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPeriod === 'month'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setSelectedPeriod(selectedPeriod === 'quarter' ? 'month' : 'quarter')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedPeriod === 'quarter'
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  This Quarter
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Admin/Scheduler Dashboard */}
      {(user?.role === 'admin' || user?.role === 'scheduling_officer') && (
        <>
          {/* Row 1: User & Faculty Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <ModernStatCard
              icon={Users}
              label="Total Users"
              value={stats.totalUsers}
              sublabel="Real data"
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <ModernStatCard
              icon={UserCheck}
              label="Active Users"
              value={stats.activeUsers}
              sublabel="Currently active"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={UserX}
              label="Inactive Users"
              value={stats.inactiveUsers}
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
              value={stats.activeFaculty}
              sublabel={`${stats.totalFaculty} total registered`}
              iconColor="text-indigo-600"
              iconBg="bg-indigo-50"
            />
            <ModernStatCard
              icon={BookOpen}
              label="Total Subjects"
              value={stats.totalSubjects}
              sublabel="Across all programs"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={DoorOpen}
              label="Total Rooms"
              value={stats.totalRooms}
              sublabel="Available facilities"
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
            <ModernStatCard
              icon={Calendar}
              label="Active Schedules"
              value={stats.totalSchedules}
              sublabel={`${stats.publishedSchedules} published`}
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Row 3: Placeholder Stats (Financial/Class Management) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <ModernStatCard
              icon={Wallet}
              label="Class Spaces"
              value={stats.totalClasses}
              sublabel="Active class spaces"
              iconColor="text-teal-600"
              iconBg="bg-teal-50"
            />
            <ModernStatCard
              icon={Banknote}
              label="Enrolled Students"
              value={stats.activeUsers}
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

          {/* Quick Actions & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => window.location.href = '/faculty'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all group dark:from-blue-900 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-700"
                >
                  <div className="p-2 bg-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Manage Faculty</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">View all faculty</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/schedules'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-all group dark:from-green-900 dark:to-green-800 dark:hover:from-green-800 dark:hover:to-green-700"
                >
                  <div className="p-2 bg-green-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Schedules</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Generate & assign</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/subjects'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all group dark:from-purple-900 dark:to-purple-800 dark:hover:from-purple-800 dark:hover:to-purple-700"
                >
                  <div className="p-2 bg-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Subjects</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Manage curriculum</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/rooms'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-all group dark:from-orange-900 dark:to-orange-800 dark:hover:from-orange-800 dark:hover:to-orange-700"
                >
                  <div className="p-2 bg-orange-500 rounded-lg group-hover:scale-110 transition-transform">
                    <DoorOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Rooms</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Manage facilities</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">System Status</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">All Systems Online</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Last checked: {formatTime()}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ready for Operations</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">AI scheduling available</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                    <Info className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Data Entry Needed</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Complete faculty profiles</p>
                  </div>
                </div>
              </div>
            </div>
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
              value={stats.programStudents}
              sublabel={`Enrolled in ${user?.program}`}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
            />
            <ModernStatCard
              icon={BookOpen}
              label="Program Subjects"
              value={stats.programSubjects}
              sublabel="Active curriculum"
              iconColor="text-green-600"
              iconBg="bg-green-50"
            />
            <ModernStatCard
              icon={Calendar}
              label="Program Schedules"
              value={stats.programSchedules}
              sublabel={`${stats.publishedSchedules} published`}
              iconColor="text-purple-600"
              iconBg="bg-purple-50"
            />
            <ModernStatCard
              icon={CheckCircle}
              label="Active Classes"
              value={stats.totalClasses}
              sublabel="Running this semester"
              iconColor="text-orange-600"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Row 2: Distribution Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Students by Year Level */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 dark:text-gray-100">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Students by Year Level
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse h-12 bg-gray-200 rounded dark:bg-gray-700"></div>
                  ))}
                </div>
              ) : stats.programByYear.length > 0 ? (
                <div className="space-y-3">
                  {stats.programByYear
                    .sort((a, b) => parseInt(a.year) - parseInt(b.year))
                    .map((item) => {
                      const percentage = stats.programStudents > 0 
                        ? (item.count / stats.programStudents * 100).toFixed(1)
                        : 0;
                      return (
                        <div key={item.year} className="flex items-center gap-3">
                          <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Year {item.year}
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden dark:bg-gray-700">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-end px-3 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 15 && (
                                <span className="text-xs font-semibold text-white">
                                  {item.count}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                            <span className="text-xs text-gray-500 ml-1 dark:text-gray-400">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p>No student data available</p>
                </div>
              )}
            </div>

            {/* Students by Semester */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 dark:text-gray-100">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Students by Semester
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="animate-pulse h-12 bg-gray-200 rounded dark:bg-gray-700"></div>
                  ))}
                </div>
              ) : stats.programBySemester.length > 0 ? (
                <div className="space-y-3">
                  {stats.programBySemester
                    .sort((a, b) => parseInt(a.semester) - parseInt(b.semester))
                    .map((item) => {
                      const percentage = stats.programStudents > 0
                        ? (item.count / stats.programStudents * 100).toFixed(1)
                        : 0;
                      const semesterName = item.semester === '1' ? '1st Semester' : '2nd Semester';
                      return (
                        <div key={item.semester} className="flex items-center gap-3">
                          <div className="w-28 text-sm font-medium text-gray-700 dark:text-gray-300">
                            {semesterName}
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden dark:bg-gray-700">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-end px-3 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage > 15 && (
                                <span className="text-xs font-semibold text-white">
                                  {item.count}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                            <span className="text-xs text-gray-500 ml-1 dark:text-gray-400">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p>No semester data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions for Program Manager */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => window.location.href = '/students'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-all group dark:from-blue-900 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-700"
                >
                  <div className="p-2 bg-blue-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Manage Students</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{stats.programStudents} students</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/subjects'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:from-green-100 hover:to-green-200 transition-all group dark:from-green-900 dark:to-green-800 dark:hover:from-green-800 dark:hover:to-green-700"
                >
                  <div className="p-2 bg-green-500 rounded-lg group-hover:scale-110 transition-transform">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Program Subjects</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{stats.programSubjects} subjects</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/schedules'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:from-purple-100 hover:to-purple-200 transition-all group dark:from-purple-900 dark:to-purple-800 dark:hover:from-purple-800 dark:hover:to-purple-700"
                >
                  <div className="p-2 bg-purple-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Schedules</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{stats.programSchedules} schedules</p>
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/rooms'}
                  className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-all group dark:from-orange-900 dark:to-orange-800 dark:hover:from-orange-800 dark:hover:to-orange-700"
                >
                  <div className="p-2 bg-orange-500 rounded-lg group-hover:scale-110 transition-transform">
                    <DoorOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm dark:text-gray-100">Rooms</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Available facilities</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Program Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Program Status</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Program Active</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.program} operations normal</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stats.programStudents} Enrolled</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Active this semester</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Schedule Ready</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stats.programSchedules} schedules created</p>
                  </div>
                </div>

                {stats.programStudents === 0 && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                      <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Add Students</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">No students enrolled yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Enrollment Trend</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stats.programStudents}</p>
              <p className="text-sm text-gray-600">Total students enrolled</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Active</span>
                <span className="text-gray-500">Current semester</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Curriculum Load</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stats.programSubjects}</p>
              <p className="text-sm text-gray-600">Subjects in curriculum</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Updated</span>
                <span className="text-gray-500">Latest curriculum</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Schedule Status</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stats.publishedSchedules}</p>
              <p className="text-sm text-gray-600">Published schedules</p>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Live</span>
                <span className="text-gray-500">of {stats.programSchedules} total</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Faculty Dashboard */}
      {user?.role === 'faculty' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">My Teaching Schedule</h2>
            <p className="text-gray-600">Your schedule will appear here once classes are assigned.</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">My Classes</h2>
            <p className="text-gray-600">View and manage your class spaces.</p>
            <button
              onClick={() => window.location.href = '/classes'}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View My Classes
            </button>
          </div>
        </div>
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

export default DashboardPage;


// Student Dashboard Component
const StudentDashboard = ({ user, loading: parentLoading }) => {
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    loadStudentData();
  }, []);

  const loadStudentData = async () => {
    try {
      // One call. /my-classes returns the student's own profile plus the class
      // spaces they're enrolled in, each with its populated schedule.
      //
      // The previous version fetched EVERY student record and picked itself out
      // client-side, then matched `schedule.section` ("A") against
      // `sectionCode` ("BSIT-4A-D") - which never matched, so the schedule was
      // always empty.
      const response = await classSpaceAPI.getMyClasses();
      const payload = response.data;

      setStudentData(payload.profile || null);
      setClasses(payload.data || []);
    } catch (error) {
      console.error('Failed to load student data:', error);
      toast.error(
        error.response?.data?.message || 'Failed to load your enrollment information'
      );
    } finally {
      setLoading(false);
    }
  };

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
      {/* Enrollment Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">Welcome back, {user?.firstName}!</h2>
            <p className="text-blue-100 text-sm">Student ID: {user?.studentId}</p>
          </div>
          <div className="p-3 bg-white/20 backdrop-blur-sm rounded-lg">
            <GraduationCap className="w-8 h-8" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-blue-100 text-sm mb-1">Program</p>
            <p className="text-xl font-semibold">{user?.program || studentData?.program || 'Not assigned'}</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-blue-100 text-sm mb-1">Student Type</p>
            <p className="text-xl font-semibold capitalize">{studentData?.studentType || 'Not assigned'}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <p className="text-blue-100 text-sm mb-1">
              {studentData?.studentType === 'regular' ? 'Section' : 'Subjects Enrolled'}
            </p>
            <p className="text-xl font-semibold">
              {studentData?.studentType === 'regular' 
                ? (studentData?.sectionCode || 'Not assigned')
                : (studentData?.subjectCodes?.length || 0) + ' subjects'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Enrollment Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
          Enrollment Information
        </h3>
        
        {!studentData ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No enrollment record found</p>
            <p className="text-sm mt-1">Please contact your program manager</p>
          </div>
        ) : studentData.studentType === 'regular' && !studentData.sectionCode ? (
          <div className="text-center py-8 text-orange-600 bg-orange-50 rounded-lg">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">Section Not Assigned</p>
            <p className="text-sm mt-1">Your program manager will assign you to a section soon</p>
          </div>
        ) : studentData.studentType === 'irregular' && (!studentData.subjectCodes || studentData.subjectCodes.length === 0) ? (
          <div className="text-center py-8 text-orange-600 bg-orange-50 rounded-lg">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
            <p className="font-medium">No Subjects Enrolled</p>
            <p className="text-sm mt-1">Your program manager will assign your subjects soon</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Academic Year</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{studentData.academicYear}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Semester</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {studentData.semester === 1 ? '1st Semester' : '2nd Semester'}
                </p>
              </div>
            </div>

            {studentData.studentType === 'irregular' && studentData.subjectCodes?.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">Enrolled Subjects:</p>
                <div className="flex flex-wrap gap-2">
                  {studentData.subjectCodes.map((code, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium dark:bg-blue-900 dark:text-blue-300"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Enrollment Status</p>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                studentData.enrollmentStatus === 'enrolled' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                <CheckCircle className="w-4 h-4" />
                {studentData.enrollmentStatus}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* My Classes Enrollment */}
      <MyClassesEnrollment />

      {/* My Classes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            My Classes
          </h3>
          <button
            onClick={() => window.location.href = '/classes'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Open Classes
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>You have no classes yet</p>
            <p className="text-sm mt-1">
              {studentData?.studentType === 'irregular'
                ? 'Join a subject with a class code from your instructor.'
                : 'Join your section with the enrollment code from your program manager.'}
            </p>
            <button
              onClick={() => window.location.href = '/classes'}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {studentData?.studentType === 'irregular' ? 'Join a Subject' : 'Join My Section'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You are enrolled in {classes.length} {classes.length === 1 ? 'class' : 'classes'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {classes.slice(0, 4).map((cs) => {
                const teacher = cs.faculty?.user
                  ? `${cs.faculty.user.firstName || ''} ${cs.faculty.user.lastName || ''}`.trim()
                  : null;
                return (
                  <div
                    key={cs._id}
                    onClick={() => window.location.href = '/classes'}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors dark:bg-gray-700 dark:border-gray-600"
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {cs.subject?.subjectCode || cs.sectionCode}
                    </p>
                    {cs.subject?.subjectName && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {cs.subject.subjectName}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {describeSlots(cs)}
                    </p>
                    {teacher && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{teacher}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{cs.announcements?.length || 0} announcements</span>
                      <span>{cs.materials?.length || 0} materials</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {classes.length > 4 && (
              <p className="text-sm text-gray-500 text-center mt-3 dark:text-gray-400">
                +{classes.length - 4} more {classes.length - 4 === 1 ? 'class' : 'classes'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
