/**
 * Schedule Conflict Detection Service
 * Detects various types of scheduling conflicts
 */

const Schedule = require('../models/Schedule.model');

/**
 * Convert time string to minutes for comparison
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if two time ranges overlap
 */
const timesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  return s1 < e2 && s2 < e1;
};

/**
 * Detect all schedule conflicts
 */
const detectAllConflicts = async () => {
  try {
    // Get all active schedules
    const schedules = await Schedule.find({ isActive: true })
      .populate('subject', 'subjectCode subjectName')
      .populate('faculty', 'employeeId')
      .populate({
        path: 'faculty',
        populate: {
          path: 'user',
          select: 'firstName lastName'
        }
      })
      .lean();

    const conflicts = [];
    const conflictMap = new Map(); // Track unique conflicts

    // Check each schedule against others
    for (let i = 0; i < schedules.length; i++) {
      const schedule1 = schedules[i];
      
      if (!schedule1.timeSlots || schedule1.timeSlots.length === 0) continue;

      for (let j = i + 1; j < schedules.length; j++) {
        const schedule2 = schedules[j];
        
        if (!schedule2.timeSlots || schedule2.timeSlots.length === 0) continue;

        // Check each time slot combination
        for (const slot1 of schedule1.timeSlots) {
          for (const slot2 of schedule2.timeSlots) {
            // Same day check
            if (slot1.day !== slot2.day) continue;

            // Time overlap check
            if (timesOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime)) {
              // Faculty conflict
              if (schedule1.faculty?._id?.toString() === schedule2.faculty?._id?.toString()) {
                const conflictKey = `faculty-${schedule1.faculty._id}-${slot1.day}-${slot1.startTime}`;
                
                if (!conflictMap.has(conflictKey)) {
                  conflicts.push({
                    type: 'FACULTY_DOUBLE_BOOKING',
                    severity: 'high',
                    day: slot1.day,
                    timeRange: `${slot1.startTime} - ${slot1.endTime}`,
                    faculty: {
                      id: schedule1.faculty._id,
                      name: `${schedule1.faculty.user?.firstName || ''} ${schedule1.faculty.user?.lastName || ''}`.trim(),
                      employeeId: schedule1.faculty.employeeId
                    },
                    schedules: [
                      {
                        id: schedule1._id,
                        subject: schedule1.subject?.subjectCode || 'N/A',
                        subjectName: schedule1.subject?.subjectName || '',
                        section: schedule1.sectionCode,
                        room: schedule1.roomLabel
                      },
                      {
                        id: schedule2._id,
                        subject: schedule2.subject?.subjectCode || 'N/A',
                        subjectName: schedule2.subject?.subjectName || '',
                        section: schedule2.sectionCode,
                        room: schedule2.roomLabel
                      }
                    ]
                  });
                  conflictMap.set(conflictKey, true);
                }
              }

              // Room conflict
              if (schedule1.roomLabel && schedule2.roomLabel && 
                  schedule1.roomLabel === schedule2.roomLabel) {
                const conflictKey = `room-${schedule1.roomLabel}-${slot1.day}-${slot1.startTime}`;
                
                if (!conflictMap.has(conflictKey)) {
                  conflicts.push({
                    type: 'ROOM_DOUBLE_BOOKING',
                    severity: 'high',
                    day: slot1.day,
                    timeRange: `${slot1.startTime} - ${slot1.endTime}`,
                    room: schedule1.roomLabel,
                    schedules: [
                      {
                        id: schedule1._id,
                        subject: schedule1.subject?.subjectCode || 'N/A',
                        subjectName: schedule1.subject?.subjectName || '',
                        section: schedule1.sectionCode,
                        faculty: schedule1.faculty ? `${schedule1.faculty.user?.firstName || ''} ${schedule1.faculty.user?.lastName || ''}`.trim() : 'N/A'
                      },
                      {
                        id: schedule2._id,
                        subject: schedule2.subject?.subjectCode || 'N/A',
                        subjectName: schedule2.subject?.subjectName || '',
                        section: schedule2.sectionCode,
                        faculty: schedule2.faculty ? `${schedule2.faculty.user?.firstName || ''} ${schedule2.faculty.user?.lastName || ''}`.trim() : 'N/A'
                      }
                    ]
                  });
                  conflictMap.set(conflictKey, true);
                }
              }

              // Section conflict (same section, overlapping times)
              if (schedule1.sectionCode && schedule2.sectionCode &&
                  schedule1.sectionCode === schedule2.sectionCode) {
                const conflictKey = `section-${schedule1.sectionCode}-${slot1.day}-${slot1.startTime}`;
                
                if (!conflictMap.has(conflictKey)) {
                  conflicts.push({
                    type: 'SECTION_DOUBLE_BOOKING',
                    severity: 'medium',
                    day: slot1.day,
                    timeRange: `${slot1.startTime} - ${slot1.endTime}`,
                    section: schedule1.sectionCode,
                    schedules: [
                      {
                        id: schedule1._id,
                        subject: schedule1.subject?.subjectCode || 'N/A',
                        subjectName: schedule1.subject?.subjectName || '',
                        room: schedule1.roomLabel,
                        faculty: schedule1.faculty ? `${schedule1.faculty.user?.firstName || ''} ${schedule1.faculty.user?.lastName || ''}`.trim() : 'N/A'
                      },
                      {
                        id: schedule2._id,
                        subject: schedule2.subject?.subjectCode || 'N/A',
                        subjectName: schedule2.subject?.subjectName || '',
                        room: schedule2.roomLabel,
                        faculty: schedule2.faculty ? `${schedule2.faculty.user?.firstName || ''} ${schedule2.faculty.user?.lastName || ''}`.trim() : 'N/A'
                      }
                    ]
                  });
                  conflictMap.set(conflictKey, true);
                }
              }
            }
          }
        }
      }
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    conflicts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      totalConflicts: conflicts.length,
      highSeverity: conflicts.filter(c => c.severity === 'high').length,
      mediumSeverity: conflicts.filter(c => c.severity === 'medium').length,
      lowSeverity: conflicts.filter(c => c.severity === 'low').length,
      conflicts
    };
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    throw error;
  }
};

/**
 * Get conflict summary for dashboard
 */
const getConflictSummary = async () => {
  try {
    const result = await detectAllConflicts();
    
    return {
      hasConflicts: result.totalConflicts > 0,
      totalConflicts: result.totalConflicts,
      highSeverity: result.highSeverity,
      mediumSeverity: result.mediumSeverity,
      criticalConflicts: result.conflicts.filter(c => c.severity === 'high').slice(0, 5) // Top 5 critical
    };
  } catch (error) {
    console.error('Error getting conflict summary:', error);
    throw error;
  }
};

module.exports = {
  detectAllConflicts,
  getConflictSummary,
  timesOverlap,
  timeToMinutes
};
