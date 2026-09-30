import React from 'react';
import { X, User, Mail, TrendingUp, Award, BookOpen, Calendar, Edit2, MapPin, GraduationCap } from 'lucide-react';
import {
  summarizeAllSubjects,
  describeRecency,
  currentAcademicYearStart,
  formatAcademicYear,
  STALE_AFTER_YEARS,
} from '../utils/teachingExperience';

const FacultyDetailsModal = ({ faculty, onClose, onEdit }) => {
  if (!faculty) return null;

  // Grouped by subject, most experienced first (recent teaching weighted higher)
  const subjectExperience = summarizeAllSubjects(faculty);
  
  // Calculate workload percentage
  const currentLoad = faculty.currentTeachingHours || 0;
  const maxLoad = faculty.maxTeachingHours || 36;
  const loadPercent = Math.min((currentLoad / maxLoad) * 100, 100);
  
  // Determine status color
  const getStatusColor = () => {
    if (currentLoad > maxLoad) return { bg: 'bg-red-100', text: 'text-red-600', bar: 'bg-red-500' };
    if (loadPercent > 80) return { bg: 'bg-yellow-100', text: 'text-yellow-600', bar: 'bg-yellow-500' };
    return { bg: 'bg-green-100', text: 'text-green-600', bar: 'bg-green-500' };
  };
  
  const statusColor = getStatusColor();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      {/* Modal Container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slideUp">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-8 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-5">
            {/* Profile Picture */}
            <div className="relative flex-shrink-0">
              {faculty.user?.profilePicture ? (
                <>
                  <img
                    src={`${process.env.REACT_APP_API_URL?.replace('/api', '')}${faculty.user.profilePicture}`}
                    alt={`${faculty.user.firstName} ${faculty.user.lastName}`}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-white/30 shadow-xl"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm ring-4 ring-white/30 shadow-xl"
                    style={{ display: 'none' }}
                  >
                    <User className="w-10 h-10 text-white" />
                  </div>
                </>
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm ring-4 ring-white/30 shadow-xl">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
            </div>

            {/* Header Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white truncate">
                {faculty.user?.firstName} {faculty.user?.lastName}
              </h2>
              <p className="text-blue-100 text-sm font-medium mt-1">{faculty.employeeId}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  faculty.isActive 
                    ? 'bg-green-500 text-white' 
                    : 'bg-red-500 text-white'
                }`}>
                  {faculty.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  faculty.employmentType === 'Regular'
                    ? 'bg-white/20 text-white backdrop-blur-sm'
                    : 'bg-purple-500 text-white'
                }`}>
                  {faculty.employmentType || 'Regular'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Current Load Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 text-center border-2 border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md transition-shadow">
              <TrendingUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {currentLoad}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mt-1">hrs</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-semibold">Current Load</p>
            </div>
            
            {/* Qualifications Card */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-5 text-center border-2 border-green-200 dark:border-green-700 shadow-sm hover:shadow-md transition-shadow">
              <Award className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                {faculty.qualifications?.length || 0}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 font-medium mt-1">degrees</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-semibold">Qualifications</p>
            </div>
            
            {/* Subjects Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 text-center border-2 border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-shadow">
              <BookOpen className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {subjectExperience.length}
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mt-1">subjects</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-semibold">
                Distinct Subjects • {faculty.teachingHistory?.length || 0} sem
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
              <User className="w-4 h-4 text-blue-600" />
              Basic Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{faculty.user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Max Load</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{maxLoad} hours/week</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Position</p>
                  <p className="text-sm text-gray-900 dark:text-white font-medium">{faculty.position || 'Instructor'}</p>
                </div>
              </div>

              {faculty.administrativeDesignation && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-0.5">Administrative Role</p>
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{faculty.administrativeDesignation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Workload Status */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border-2 border-blue-200 dark:border-blue-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Workload Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {currentLoad} / {maxLoad} hours
                </span>
                <span className={`text-lg font-bold ${statusColor.text}`}>
                  {Math.round(loadPercent)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className={`h-full ${statusColor.bar} transition-all duration-500 ease-out rounded-full shadow-sm`}
                  style={{ width: `${loadPercent}%` }}
                />
              </div>
              {currentLoad > maxLoad && (
                <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm text-red-700 dark:text-red-400 font-semibold">
                    Overloaded by {currentLoad - maxLoad} hours
                  </p>
                </div>
              )}
              {loadPercent > 80 && currentLoad <= maxLoad && (
                <div className="flex items-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <span className="text-xl">⚡</span>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 font-semibold">
                    Nearing capacity ({Math.round(loadPercent)}%)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Areas of Specialization */}
          {faculty.specialization && faculty.specialization.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Areas of Specialization
              </h3>
              <div className="flex flex-wrap gap-2">
                {faculty.specialization.map((spec, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-2 border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Educational Background */}
          {(faculty.bachelorsDegree?.degree || faculty.mastersDegree?.degree || faculty.doctoralDegree?.degree) && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-5 border-2 border-indigo-200 dark:border-indigo-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                Educational Background
              </h3>
              <div className="space-y-3">
                {/* Bachelor's Degree */}
                {faculty.bachelorsDegree?.degree && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">BS</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{faculty.bachelorsDegree.degree}</p>
                        {faculty.bachelorsDegree.major && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Major: {faculty.bachelorsDegree.major}</p>
                        )}
                        {faculty.bachelorsDegree.minor && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">Minor: {faculty.bachelorsDegree.minor}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Master's Degree */}
                {faculty.mastersDegree?.degree && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">MS</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{faculty.mastersDegree.degree}</p>
                        {faculty.mastersDegree.major && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Major: {faculty.mastersDegree.major}</p>
                        )}
                        {faculty.mastersDegree.minor && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">Minor: {faculty.mastersDegree.minor}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Doctoral Degree */}
                {faculty.doctoralDegree?.degree && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">PhD</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{faculty.doctoralDegree.degree}</p>
                        {faculty.doctoralDegree.major && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Major: {faculty.doctoralDegree.major}</p>
                        )}
                        {faculty.doctoralDegree.minor && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">Minor: {faculty.doctoralDegree.minor}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Training */}
              {faculty.specialTraining && (
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Special Training & Certifications</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{faculty.specialTraining}</p>
                </div>
              )}
            </div>
          )}

          {/* Educational Qualifications */}
          {faculty.qualifications && faculty.qualifications.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                Educational Qualifications
              </h3>
              <div className="space-y-2">
                {faculty.qualifications.map((qual, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{qual.degree}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{qual.field}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">{qual.institution}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded-lg flex-shrink-0">
                        {qual.yearObtained}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject Experience */}
          {subjectExperience.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Subject Experience
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  AY {formatAcademicYear(currentAcademicYearStart())}
                </span>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Ordered by experience, with recent teaching weighted more heavily.
              </p>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {subjectExperience.slice(0, 5).map((s) => (
                  <div
                    key={s.key}
                    className={`rounded-xl p-3 border-2 ${
                      s.isStale
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700'
                        : s.lastTaughtYearsAgo <= 1
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                        : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {s.subjectCode || s.subjectName}
                          </p>
                          {s.subjectCode && s.subjectName && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{s.subjectName}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {s.timesTaught}x
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            s.isStale
                              ? 'text-amber-700 dark:text-amber-400'
                              : s.lastTaughtYearsAgo <= 1
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {describeRecency(s.lastTaughtYearsAgo)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Timeline badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.occurrences.slice(0, 4).map((o, i) => (
                        <span
                          key={i}
                          title={`${o.semester || ''} ${o.academicYear} · ${describeRecency(o.yearsAgo)}`}
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${
                            o.yearsAgo === 0
                              ? 'bg-green-600 text-white'
                              : o.yearsAgo === 1
                              ? 'bg-green-200 text-green-900'
                              : o.yearsAgo >= STALE_AFTER_YEARS
                              ? 'bg-gray-300 text-gray-700'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {o.academicYear}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {subjectExperience.length > 5 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  Showing top 5 of {subjectExperience.length} subjects
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-semibold shadow-sm hover:shadow-md"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl"
          >
            <Edit2 className="w-5 h-5" />
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyDetailsModal;
