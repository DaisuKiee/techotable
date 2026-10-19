import React, { useState, useEffect } from 'react';
import { Copy, Clock, Users, MapPin, Calendar, Loader, Sparkles, CheckCircle2, BookOpen, Ticket } from 'lucide-react';
import { scheduleAPI, classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import BaseModal from './BaseModal';

const SubjectEnrollmentModal = ({ subject, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [classSpaces, setClassSpaces] = useState([]);
  const [generatingCode, setGeneratingCode] = useState(null);

  useEffect(() => {
    if (subject) {
      fetchSubjectSchedules();
    }
  }, [subject]);

  const fetchSubjectSchedules = async () => {
    try {
      setLoading(true);
      
      // Fetch all schedules
      const response = await scheduleAPI.getAll();
      const allSchedules = response.data.data || [];
      
      // Filter schedules for this subject
      const subjectSchedules = allSchedules.filter(
        schedule => (schedule.subject?._id === subject._id || schedule.subject === subject._id)
      );
      
      console.log('Subject schedules found:', subjectSchedules.length);
      
      if (subjectSchedules.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }
      
      // Group schedules by section
      const sectionMap = {};
      
      subjectSchedules.forEach(schedule => {
        const section = schedule.section;
        const sectionId = section?._id || section;
        
        if (!sectionMap[sectionId]) {
          sectionMap[sectionId] = {
            section: section,
            schedules: []
          };
        }
        
        sectionMap[sectionId].schedules.push(schedule);
      });
      
      console.log('Sections mapped:', Object.keys(sectionMap).length);
      setSchedules(Object.values(sectionMap));
      
      // Fetch class spaces to get enrollment codes (if they exist)
      const classSpaceResponse = await classSpaceAPI.getAll();
      const allClassSpaces = classSpaceResponse.data.data || [];
      console.log('ClassSpaces fetched:', allClassSpaces.length);
      console.log('ClassSpaces data:', allClassSpaces);
      setClassSpaces(allClassSpaces);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Failed to load schedule information');
      setLoading(false);
    }
  };

  const getDayName = (dayNumber) => {
    if (dayNumber === undefined || dayNumber === null) return 'Unknown';
    
    // If day is already a string (like "Monday", "Tuesday"), return it
    if (typeof dayNumber === 'string') {
      return dayNumber;
    }
    
    // If day is a number (0-6), convert to day name
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getEnrollmentCode = (sectionCode, subjectId) => {
    // Find class space by sectionCode and subject
    // sectionCode might be an ID string or actual code like "BSIT-4A-D"
    const classSpace = classSpaces.find(
      cs => {
        const csSubjectId = cs.subject?._id || cs.subject;
        const csSectionCode = cs.sectionCode || cs.section?.sectionCode;
        
        // Try to match by sectionCode OR by section ID
        const matchByCode = csSectionCode === sectionCode;
        const matchById = (cs.section?._id || cs.section) === sectionCode;
        
        return (matchByCode || matchById) && csSubjectId === subjectId;
      }
    );
    return classSpace?.classCode || null;
  };

  const generateEnrollmentCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerateCode = async (sectionCode) => {
    try {
      setGeneratingCode(sectionCode);
      
      // Find the class space by sectionCode and subject
      const classSpace = classSpaces.find(
        cs => {
          const csSubjectId = cs.subject?._id || cs.subject;
          const csSectionCode = cs.sectionCode || cs.section?.sectionCode;
          
          const matchByCode = csSectionCode === sectionCode;
          const matchById = (cs.section?._id || cs.section) === sectionCode;
          
          return (matchByCode || matchById) && csSubjectId === subject._id;
        }
      );

      if (!classSpace) {
        toast.error('No class space found. Please activate schedules first.');
        setGeneratingCode(null);
        return;
      }

      // Generate new 8-character code
      const newCode = generateEnrollmentCode();

      // Update the class space with the new code
      await classSpaceAPI.update(classSpace._id, {
        classCode: newCode
      });

      // Refresh data to get the updated code
      await fetchSubjectSchedules();

      // Auto copy to clipboard
      await navigator.clipboard.writeText(newCode);

      toast.success(
        <div>
          <div className="font-bold">Subject Code Generated & Copied!</div>
          <div className="text-sm mt-1 font-mono">{newCode}</div>
        </div>,
        {
          duration: 3000,
          icon: '✨',
          style: {
            background: '#10b981',
            color: '#fff',
          },
        }
      );
      
      setGeneratingCode(null);
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Failed to generate subject code');
      setGeneratingCode(null);
    }
  };

  const handleCopyCode = async (code, sectionName) => {
    if (!code) {
      toast.error('No subject code available for this section');
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      toast.success(
        <div>
          <div className="font-bold">Subject Code Copied!</div>
          <div className="text-sm mt-1 font-mono">{code}</div>
          <div className="text-xs mt-2 text-green-100">
            📋 For {subject.subjectCode} in {sectionName}
          </div>
        </div>,
        {
          duration: 3000,
          icon: '✅',
          style: {
            background: '#10b981',
            color: '#fff',
          },
        }
      );
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  return (
    <BaseModal
      isOpen={true}
      title={`Subject Codes - ${subject.subjectCode}`}
      subtitle={subject.subjectName}
      icon={BookOpen}
      size="xl"
      onClose={onClose}
      showFooter={true}
      footerContent={
        <button
          onClick={onClose}
          className="w-full px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-colors font-medium"
        >
          Close
        </button>
      }
      headerColor="navy"
    >
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="w-12 h-12 text-blue-900 animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading schedule information...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Sections Available
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This subject hasn't been scheduled in any sections yet.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Create schedules on the Schedule page to make subject codes available.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-900 rounded-lg text-white flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                    For Irregular Students
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Share the subject code for the specific section and time that works for them.
                  </p>
                </div>
              </div>
            </div>

              {schedules.map(({ section, schedules: sectionSchedules }, index) => {
                const sectionCode = section?.sectionCode || 
                                   sectionSchedules[0]?.sectionCode || 
                                   'Unknown Section';
                const enrollmentCode = getEnrollmentCode(sectionCode, subject._id);

                return (
                  <div
                    key={section?._id || sectionCode || `section-${index}`}
                    className="bg-white dark:bg-gray-800 rounded-xl p-5 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-900 dark:hover:border-blue-700 transition-all shadow-md"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">
                          {sectionCode.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {sectionCode}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <Users className="w-4 h-4" />
                            <span>Section • {sectionSchedules.length} {sectionSchedules.length === 1 ? 'schedule' : 'schedules'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGenerateCode(sectionCode)}
                          disabled={generatingCode === sectionCode}
                          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                          {generatingCode === sectionCode ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Generate</span>
                            </>
                          )}
                        </button>
                        {enrollmentCode && (
                          <button
                            onClick={() => handleCopyCode(enrollmentCode, sectionCode)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all font-semibold shadow-lg hover:shadow-xl"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Subject Code Display */}
                    {enrollmentCode ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-5 border-2 border-dashed border-blue-900 dark:border-blue-700">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Active Subject Code
                              </p>
                            </div>
                            <p className="text-3xl font-mono font-bold text-blue-900 dark:text-blue-300 tracking-widest">
                              {enrollmentCode}
                            </p>
                          </div>
                          <div className="p-3 bg-yellow-400 rounded-xl ml-4">
                            <Ticket className="w-12 h-12 text-blue-900" strokeWidth={2} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-700 rounded-xl p-4 mb-5">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                              No Code Yet
                            </p>
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                              Click "Generate" to create a subject code for this section
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Schedule Details */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Schedule Times
                        </p>
                        <div className="flex-1 h-px bg-gray-300 dark:from-gray-600"></div>
                      </div>
                      {sectionSchedules.map((schedule, scheduleIndex) => {
                        const timeSlots = schedule.timeSlots || [];
                        
                        if (timeSlots.length > 0) {
                          return timeSlots.map((slot, slotIndex) => (
                            <div
                              key={`${schedule._id}-${slotIndex}`}
                              className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Calendar className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-bold text-gray-900 dark:text-white truncate">
                                  {getDayName(slot.day)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Clock className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <MapPin className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {schedule.roomLabel || schedule.room?.roomName || 'No Room'}
                                </span>
                              </div>
                            </div>
                          ));
                        } else {
                          return (
                            <div
                              key={schedule._id || `schedule-${index}-${scheduleIndex}`}
                              className="flex items-center gap-3 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Calendar className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-bold text-gray-900 dark:text-white truncate">
                                  {getDayName(schedule.day)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Clock className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <MapPin className="w-4 h-4 text-blue-900 dark:text-blue-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {schedule.room?.roomName || 'No Room'}
                                </span>
                              </div>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BaseModal>
  );
};

export default SubjectEnrollmentModal;
