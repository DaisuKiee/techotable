import React, { useState, useEffect } from 'react';
import { Plus, X, BookOpen, Users, Clock, MapPin, Calendar, Loader, AlertCircle, CheckCircle2 } from 'lucide-react';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';

const MyClassesEnrollment = () => {
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    loadMyClasses();
  }, []);

  const loadMyClasses = async () => {
    try {
      setLoadingClasses(true);
      const response = await classSpaceAPI.getMyClasses();
      setEnrolledClasses(response.data.data || []);
    } catch (error) {
      console.error('Load my classes error:', error);
      // Don't show error toast on load, just log it
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    
    if (!classCode.trim()) {
      toast.error('Please enter a class code');
      return;
    }

    setLoading(true);

    try {
      const response = await classSpaceAPI.enrollByCode(classCode.toUpperCase());
      
      if (response.data.success) {
        toast.success(response.data.message);
        setClassCode('');
        // Reload classes
        await loadMyClasses();
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      const message = error.response?.data?.message || 'Failed to enroll in class';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (classId, className) => {
    if (!window.confirm(`Are you sure you want to drop ${className}?`)) {
      return;
    }

    try {
      const response = await classSpaceAPI.unenroll(classId);
      
      if (response.data.success) {
        toast.success(response.data.message);
        await loadMyClasses();
      }
    } catch (error) {
      console.error('Unenroll error:', error);
      const message = error.response?.data?.message || 'Failed to drop class';
      toast.error(message);
    }
  };

  const formatTimeSlots = (schedule) => {
    if (!schedule || !schedule.timeSlots || schedule.timeSlots.length === 0) {
      return 'Schedule TBA';
    }

    return schedule.timeSlots
      .map(slot => `${slot.day} ${slot.startTime}-${slot.endTime}`)
      .join(', ');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Classes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enroll in subjects using class codes
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium dark:bg-blue-900/20 dark:text-blue-400">
          <BookOpen size={16} />
          <span>{enrolledClasses.length} {enrolledClasses.length === 1 ? 'Class' : 'Classes'}</span>
        </div>
      </div>

      {/* Enrollment Form */}
      <form onSubmit={handleEnroll} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="Enter class code (e.g., ABC12345)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all uppercase dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={loading}
              maxLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !classCode.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                <Plus size={18} />
                Enroll
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">
          💡 Get class codes from your instructors or the class schedule
        </p>
      </form>

      {/* Enrolled Classes List */}
      <div className="space-y-3">
        {loadingClasses ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="animate-spin text-blue-600" size={32} />
          </div>
        ) : enrolledClasses.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg dark:border-gray-700">
            <BookOpen className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 font-medium mb-2 dark:text-gray-300">No Classes Yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter a class code above to enroll in your first subject
            </p>
          </div>
        ) : (
          enrolledClasses.map((classSpace) => {
            const enrollment = classSpace.enrolledStudents?.find(e => e.student?._id);
            const isIrregular = enrollment?.enrollmentType === 'subject';
            
            return (
              <div
                key={classSpace._id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors dark:border-gray-700 dark:hover:border-blue-600"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {classSpace.subject?.subjectName || 'Unknown Subject'}
                      </h3>
                      {isIrregular && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded dark:bg-orange-900/20 dark:text-orange-400">
                          Irregular
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <BookOpen size={14} />
                        <span className="font-mono">{classSpace.subject?.subjectCode}</span>
                        <span className="text-gray-400">•</span>
                        <span>{classSpace.subject?.units || 3} units</span>
                      </div>

                      {classSpace.faculty?.user && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Users size={14} />
                          <span>
                            {classSpace.faculty.user.firstName} {classSpace.faculty.user.lastName}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Clock size={14} />
                        <span>{formatTimeSlots(classSpace.schedule)}</span>
                      </div>

                      {classSpace.schedule?.room && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <MapPin size={14} />
                          <span>{classSpace.schedule.room}</span>
                        </div>
                      )}

                      {classSpace.classCode && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-xs rounded dark:bg-gray-700 dark:text-gray-300">
                            {classSpace.classCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isIrregular && (
                    <button
                      onClick={() => handleUnenroll(classSpace._id, classSpace.subject?.subjectName)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                      title="Drop this class"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Box */}
      {enrolledClasses.some(c => c.enrolledStudents?.some(e => e.enrollmentType === 'section')) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5 dark:text-blue-400" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> Classes assigned by your program manager (section enrollment) cannot be dropped here. 
              Contact your program manager to make changes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyClassesEnrollment;
