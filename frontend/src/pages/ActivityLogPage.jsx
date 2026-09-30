import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { activityLogAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  Activity, User, Calendar, Filter, Download, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Clock, Search,
  TrendingUp, Users, FileText, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';

const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    status: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  useEffect(() => {
    loadActivityLogs();
    loadStats();
  }, [filters, page]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        limit,
        skip: (page - 1) * limit
      };

      const response = await activityLogAPI.getAll(params);
      const newLogs = response.data.data.logs || response.data.data;
      
      setLogs(newLogs);
      setHasMore(newLogs.length === limit);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      const response = await activityLogAPI.getStats(params);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleRefresh = () => {
    loadActivityLogs();
    loadStats();
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      resource: '',
      status: '',
      startDate: '',
      endDate: '',
      search: ''
    });
    setPage(1);
  };

  const getActionIcon = (action) => {
    const iconMap = {
      login: User,
      logout: User,
      create: FileText,
      update: Settings,
      delete: XCircle,
      schedule_generate: Calendar,
      faculty_assign: Users
    };
    const Icon = iconMap[action] || Activity;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'failure':
        return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'failure':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAction = (action) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Single, Modern */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Activity Log
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Track all system activities and user actions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${
                  showFilters
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/50 font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards - More Modern */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-md hover:shadow-xl transition-all p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Total Activities
                  </p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {stats.totalActivities || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-900/20 rounded-2xl shadow-md hover:shadow-xl transition-all p-6 border border-green-200 dark:border-green-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
                    Successful
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                    {stats.successCount || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-red-50 dark:from-gray-800 dark:to-red-900/20 rounded-2xl shadow-md hover:shadow-xl transition-all p-6 border border-red-200 dark:border-red-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
                    Failed
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                    {stats.failureCount || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-2xl shadow-md hover:shadow-xl transition-all p-6 border border-blue-200 dark:border-blue-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Active Users
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {stats.uniqueUsers || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters - Collapsible and Modern */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-5">
              <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filter Activities</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action Type
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="schedule_generate">Schedule Generate</option>
                  <option value="faculty_assign">Faculty Assign</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resource
                </label>
                <select
                  value={filters.resource}
                  onChange={(e) => handleFilterChange('resource', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">All Resources</option>
                  <option value="user">User</option>
                  <option value="faculty">Faculty</option>
                  <option value="student">Student</option>
                  <option value="subject">Subject</option>
                  <option value="room">Room</option>
                  <option value="schedule">Schedule</option>
                  <option value="section">Section</option>
                  <option value="classSpace">Class Space</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-gray-700 dark:text-gray-300 font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activity Log Table - Modern Design */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activities...</p>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <Activity className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-gray-900 dark:text-white">No activities found</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr 
                      key={log._id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        index % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-900/30'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </div>
                          <span className="font-medium">{formatDate(log.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {log.user?.profilePicture ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${log.user.profilePicture}`}
                              alt={`${log.user?.firstName} ${log.user?.lastName}`}
                              className="w-9 h-9 rounded-lg object-cover shadow-md border-2 border-white dark:border-gray-700"
                              onError={(e) => {
                                // If image fails to load, show initials instead
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-md"
                            style={{ display: log.user?.profilePicture ? 'none' : 'flex' }}
                          >
                            {log.user?.firstName?.[0]}{log.user?.lastName?.[0]}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.user?.firstName} {log.user?.lastName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {log.user?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                            {getActionIcon(log.action)}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatAction(log.action)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                          {log.resource}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                          <span className="capitalize">{log.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {log.details?.description || log.errorMessage || '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Modern */}
          {!loading && logs.length > 0 && (
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Page <span className="text-indigo-600 dark:text-indigo-400">{page}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-700 dark:text-gray-300 font-medium shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-700 dark:text-gray-300 font-medium shadow-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ActivityLogPage;
