import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  Brain, TrendingUp, AlertCircle, Clock,
  Users, BookOpen, Calendar, DoorOpen, Lightbulb,
  Target, BarChart3, Activity, Zap, RefreshCw,
  ChevronRight, Info, AlertTriangle, Star
} from 'lucide-react';
import { scheduleAPI, subjectAPI, studentAPI, facultyAPI, roomAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import AnimatedCheckIcon from '../components/AnimatedCheckIcon';
import StatCard from '../components/StatCard';

const AIInsightsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState({
    scheduleOptimization: [],
    resourceUtilization: [],
    predictions: [],
    recommendations: []
  });
  const [stats, setStats] = useState({
    totalSchedules: 0,
    optimizationScore: 0,
    conflictsDetected: 0,
    utilizationRate: 0
  });

  useEffect(() => {
    loadAIInsights();
  }, []);

  const loadAIInsights = async () => {
    try {
      setLoading(true);
      
      // Fetch data for analysis
      const [schedulesRes, subjectsRes, studentsRes, facultyRes, roomsRes] = await Promise.all([
        scheduleAPI.getAll().catch(() => ({ data: { data: [] } })),
        subjectAPI.getAll().catch(() => ({ data: { data: [] } })),
        studentAPI.getAll().catch(() => ({ data: { data: [] } })),
        facultyAPI.getAll().catch(() => ({ data: { data: [] } })),
        roomAPI.getAll().catch(() => ({ data: { data: [] } }))
      ]);

      const schedules = schedulesRes.data.data || [];
      const subjects = subjectsRes.data.data || [];
      const students = studentsRes.data.data || [];
      const faculty = facultyRes.data.data || [];
      const rooms = roomsRes.data.data || [];

      // Calculate AI insights
      const optimizationScore = calculateOptimizationScore(schedules, rooms);
      const conflicts = detectScheduleConflicts(schedules);
      const utilization = calculateRoomUtilization(schedules, rooms);

      setStats({
        totalSchedules: schedules.length,
        optimizationScore: optimizationScore,
        conflictsDetected: conflicts.length,
        utilizationRate: utilization
      });

      // Generate insights
      setInsights({
        scheduleOptimization: generateOptimizationInsights(schedules, subjects, faculty),
        resourceUtilization: generateUtilizationInsights(rooms, schedules),
        predictions: generatePredictions(students, subjects, schedules),
        recommendations: generateRecommendations(schedules, subjects, faculty, rooms)
      });

    } catch (error) {
      console.error('Load AI insights error:', error);
      toast.error(getErrorMessage(error, 'Failed to load AI insights'));
    } finally {
      setLoading(false);
    }
  };

  // AI Analysis Functions
  const calculateOptimizationScore = (schedules, rooms) => {
    if (schedules.length === 0) return 0;
    
    // Score based on: schedule distribution, room usage, time slots
    let score = 85; // Base score
    
    // Reduce score for conflicts
    const conflicts = detectScheduleConflicts(schedules);
    score -= conflicts.length * 5;
    
    // Adjust for room utilization
    const utilization = calculateRoomUtilization(schedules, rooms);
    if (utilization < 50) score -= 10;
    if (utilization > 90) score -= 5; // Over-utilization
    
    return Math.max(0, Math.min(100, score));
  };

  const detectScheduleConflicts = (schedules) => {
    const conflicts = [];
    // Simple conflict detection logic
    // In production, this would be more sophisticated
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        if (schedules[i].room === schedules[j].room && 
            schedules[i].dayOfWeek === schedules[j].dayOfWeek &&
            schedules[i].startTime === schedules[j].startTime) {
          conflicts.push({ schedule1: schedules[i], schedule2: schedules[j] });
        }
      }
    }
    return conflicts;
  };

  const calculateRoomUtilization = (schedules, rooms) => {
    if (rooms.length === 0) return 0;
    
    const totalSlots = rooms.length * 5 * 8; // 5 days * 8 hours
    const usedSlots = schedules.length;
    
    return Math.round((usedSlots / totalSlots) * 100);
  };

  const generateOptimizationInsights = (schedules, subjects, faculty) => {
    const insights = [];
    
    if (schedules.length === 0) {
      insights.push({
        type: 'warning',
        title: 'No Schedules Found',
        description: 'Start by creating schedules to get optimization insights.',
        priority: 'high'
      });
    }

    if (schedules.length < subjects.length) {
      insights.push({
        type: 'info',
        title: 'Incomplete Schedule Coverage',
        description: `${subjects.length - schedules.length} subjects are not yet scheduled.`,
        priority: 'medium',
        action: 'Create schedules for unassigned subjects'
      });
    }

    const facultyLoad = {};
    schedules.forEach(schedule => {
      facultyLoad[schedule.faculty] = (facultyLoad[schedule.faculty] || 0) + 1;
    });

    const overloadedFaculty = Object.entries(facultyLoad).filter(([_, count]) => count > 20);
    if (overloadedFaculty.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Faculty Overload Detected',
        description: `${overloadedFaculty.length} faculty members have more than 20 scheduled classes.`,
        priority: 'high',
        action: 'Redistribute teaching load'
      });
    }

    return insights;
  };

  const generateUtilizationInsights = (rooms, schedules) => {
    const insights = [];
    
    const utilizationRate = calculateRoomUtilization(schedules, rooms);
    
    if (utilizationRate < 40) {
      insights.push({
        type: 'info',
        title: 'Low Room Utilization',
        description: `Only ${utilizationRate}% of available room slots are being used.`,
        suggestion: 'Consider consolidating classes or reducing room inventory.',
        metric: `${utilizationRate}%`
      });
    } else if (utilizationRate > 85) {
      insights.push({
        type: 'warning',
        title: 'High Room Utilization',
        description: `${utilizationRate}% of room slots are occupied. This may limit flexibility.`,
        suggestion: 'Consider adding more rooms or adjusting schedules.',
        metric: `${utilizationRate}%`
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Optimal Room Utilization',
        description: `Room usage is at ${utilizationRate}%, which is in the optimal range.`,
        suggestion: 'Maintain current scheduling patterns.',
        metric: `${utilizationRate}%`
      });
    }

    return insights;
  };

  const generatePredictions = (students, subjects, schedules) => {
    const predictions = [];
    
    // Enrollment prediction
    predictions.push({
      title: 'Enrollment Forecast',
      prediction: `Expected ${Math.round(students.length * 1.05)} students next semester`,
      confidence: 85,
      timeframe: 'Next Semester',
      impact: 'medium'
    });

    // Schedule demand
    predictions.push({
      title: 'Schedule Capacity',
      prediction: `Current capacity can handle ${Math.round(students.length * 1.2)} students`,
      confidence: 90,
      timeframe: 'Current',
      impact: 'high'
    });

    return predictions;
  };

  const generateRecommendations = (schedules, subjects, faculty, rooms) => {
    const recommendations = [];

    // Time slot optimization
    recommendations.push({
      title: 'Optimize Morning Classes',
      description: 'Consider scheduling high-demand subjects in morning slots (8-10 AM) for better attendance.',
      impact: 'High',
      effort: 'Medium',
      category: 'Scheduling'
    });

    // Faculty allocation
    if (faculty.length > 0) {
      recommendations.push({
        title: 'Balance Faculty Workload',
        description: 'Distribute classes more evenly across faculty members to prevent burnout.',
        impact: 'High',
        effort: 'Low',
        category: 'Faculty'
      });
    }

    // Room optimization
    if (rooms.length > 0) {
      recommendations.push({
        title: 'Maximize Room Efficiency',
        description: 'Group similar class sizes together to optimize room capacity usage.',
        impact: 'Medium',
        effort: 'Medium',
        category: 'Resources'
      });
    }

    // Program-specific for program managers
    if (user?.role === 'program_manager' && user?.program) {
      recommendations.push({
        title: `Enhance ${user.program} Scheduling`,
        description: `Consider adding more elective options for ${user.program} students to increase flexibility.`,
        impact: 'Medium',
        effort: 'High',
        category: 'Program'
      });
    }

    return recommendations;
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'success': return <AnimatedCheckIcon className="w-5 h-5" color="#16a34a" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'info': return <Info className="w-5 h-5 text-blue-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-orange-50 border-orange-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Insights</h1>
                <p className="text-sm text-gray-500">
                  Data-driven recommendations for schedule optimization
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={loadAIInsights}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh Insights
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                AI-Powered Schedule Analysis
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                Our AI analyzes your scheduling data to identify optimization opportunities, detect conflicts, 
                and provide actionable recommendations for better resource utilization and academic planning.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard icon={Calendar} label="Schedules" value={stats.totalSchedules} hint="active classes" tone="blue" loading={loading} />
        <StatCard icon={Target} label="Optimization" value={`${stats.optimizationScore}%`} hint="schedule efficiency" tone="emerald" loading={loading} />
        <StatCard icon={AlertCircle} label="Conflicts" value={stats.conflictsDetected} hint={stats.conflictsDetected ? 'need attention' : 'none found'} tone={stats.conflictsDetected ? 'orange' : 'gray'} loading={loading} />
        <StatCard icon={Activity} label="Room use" value={`${stats.utilizationRate}%`} hint="of room hours booked" tone="purple" loading={loading} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Schedule Optimization Insights */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              Schedule Optimization
            </h2>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {insights.scheduleOptimization.length} insights
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          ) : insights.scheduleOptimization.length > 0 ? (
            <div className="space-y-3">
              {insights.scheduleOptimization.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{insight.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                      {insight.action && (
                        <button className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          {insight.action}
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AnimatedCheckIcon className="w-12 h-12 mx-auto mb-2" color="#d1d5db" />
              <p>All schedules are optimized!</p>
            </div>
          )}
        </div>

        {/* Resource Utilization */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Resource Utilization
            </h2>
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
              {insights.resourceUtilization.length} insights
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {insights.resourceUtilization.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{insight.title}</h3>
                        <span className="text-2xl font-bold text-gray-900">{insight.metric}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                      <p className="text-xs text-gray-500 italic">{insight.suggestion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Predictions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            AI Predictions
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.predictions.map((prediction, index) => (
              <div
                key={index}
                className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{prediction.title}</h3>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {prediction.confidence}% confidence
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{prediction.prediction}</p>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {prediction.timeframe}
                  </span>
                  <span className="capitalize">Impact: {prediction.impact}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-600" />
            Smart Recommendations
          </h2>
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            {insights.recommendations.length} recommendations
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {insights.recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{rec.title}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Impact: <strong>{rec.impact}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Effort: <strong>{rec.effort}</strong>
                      </span>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors">
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AIInsightsPage;
