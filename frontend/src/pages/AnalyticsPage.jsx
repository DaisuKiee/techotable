import React, { useState, useEffect } from 'react';
import { activityLogAPI, facultyAPI, studentAPI, subjectAPI, scheduleAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import StatCard from '../components/StatCard';
import {
  TrendingUp, Users, BookOpen, Calendar, Activity,
  BarChart3, PieChart, Clock, AlertCircle
} from 'lucide-react';

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: { total: 0, byRole: [] },
    faculty: { total: 0, bySpecialization: [] },
    students: { total: 0, byProgram: [], byStatus: [] },
    subjects: { total: 0, byProgram: [] },
    schedules: { total: 0 },
    activityLogs: {}
  });
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const startDate = getStartDate(timeRange);
      const params = startDate ? { startDate: startDate.toISOString() } : {};

      // Fetch all statistics in parallel
      const [
        activityStats,
        studentStats,
        facultyResponse,
        subjectResponse,
        scheduleResponse
      ] = await Promise.all([
        activityLogAPI.getStats(params).catch(() => ({ data: { data: {} } })),
        studentAPI.getStats().catch(() => ({ data: { data: {} } })),
        facultyAPI.getAll().catch(() => ({ data: { data: [] } })),
        subjectAPI.getAll().catch(() => ({ data: { data: [] } })),
        scheduleAPI.getAll().catch(() => ({ data: { data: [] } }))
      ]);

      // Process data
      const facultyData = facultyResponse.data?.data || [];
      const subjectData = subjectResponse.data?.data || [];
      const scheduleData = scheduleAPI.getAll().catch(() => ({ data: { data: [] } }));

      setStats({
        faculty: {
          total: facultyData.length,
          bySpecialization: aggregateBy(facultyData, 'specializations')
        },
        students: studentStats.data?.data || {},
        subjects: {
          total: subjectData.length,
          byProgram: aggregateBy(subjectData, 'program')
        },
        schedules: {
          total: scheduleData.data?.data?.length || 0
        },
        activityLogs: activityStats.data?.data || {}
      });
    } catch (error) {
      console.error('Fetch analytics error:', error);
      toast.error(getErrorMessage(error, 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (range) => {
    if (range === 'all') return null;
    const date = new Date();
    switch (range) {
      case '7d': date.setDate(date.getDate() - 7); break;
      case '30d': date.setDate(date.getDate() - 30); break;
      case '90d': date.setDate(date.getDate() - 90); break;
      default: return null;
    }
    return date;
  };

  const aggregateBy = (data, field) => {
    const counts = {};
    data.forEach(item => {
      const value = Array.isArray(item[field]) ? item[field][0] : item[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">System statistics and insights</p>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatCard icon={Users} label="Students" value={(stats.students.total || 0).toLocaleString()} hint="student records" tone="blue" />
        <StatCard icon={Users} label="Faculty" value={(stats.faculty.total || 0).toLocaleString()} hint="faculty members" tone="emerald" />
        <StatCard icon={BookOpen} label="Subjects" value={(stats.subjects.total || 0).toLocaleString()} hint="in the catalog" tone="purple" />
        <StatCard icon={Calendar} label="Schedules" value={(stats.schedules.total || 0).toLocaleString()} hint="active classes" tone="orange" />
      </div>

      {/* Activity Statistics */}
      {stats.activityLogs.totalActivities > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Activities Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-indigo-600" />
              Activity Overview
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Activities</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.activityLogs.totalActivities?.toLocaleString() || 0}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                {stats.activityLogs.activitiesByStatus?.map((status, idx) => (
                  <div key={idx}>
                    <p className="text-xs text-gray-500 capitalize">{status._id}</p>
                    <p className="text-xl font-semibold text-gray-900">{status.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activities by Action */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
              Top Actions
            </h3>
            <div className="space-y-3">
              {stats.activityLogs.activitiesByAction?.slice(0, 8).map((action, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 capitalize">
                    {action._id.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${(action.count / stats.activityLogs.totalActivities) * 100}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                      {action.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resource Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Students by Program */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Students by Program</h3>
          <div className="space-y-3">
            {stats.students.byProgram?.map((prog, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{prog._id}</span>
                <span className="text-sm font-semibold text-indigo-600">{prog.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Students by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Status</h3>
          <div className="space-y-3">
            {stats.students.byStatus?.map((status, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {status._id.replace('_', ' ')}
                </span>
                <span className="text-sm font-semibold text-green-600">{status.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Faculty by Specialization */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Faculty Specializations</h3>
          <div className="space-y-3">
            {stats.faculty.bySpecialization?.slice(0, 5).map((spec, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{spec.name}</span>
                <span className="text-sm font-semibold text-purple-600">{spec.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {stats.activityLogs.activitiesPerDay?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
            Activity Timeline (Last 7 Days)
          </h3>
          <div className="flex items-end justify-between h-48 gap-2">
            {stats.activityLogs.activitiesPerDay.map((day, idx) => {
              const maxCount = Math.max(...stats.activityLogs.activitiesPerDay.map(d => d.count));
              const height = (day.count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer"
                    style={{ height: `${height}%` }}
                    title={`${day.count} activities`}
                  ></div>
                  <span className="text-xs text-gray-500 mt-2">
                    {new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">{day.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      {stats.activityLogs.recentActivities?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-indigo-600" />
            Recent Activities
          </h3>
          <div className="space-y-3">
            {stats.activityLogs.recentActivities.slice(0, 10).map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500' :
                    activity.status === 'failure' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.user?.firstName} {activity.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {activity.action.replace('_', ' ')} {activity.resource}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
