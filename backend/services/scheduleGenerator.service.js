/**
 * Schedule Generator Service
 * 
 * AI-Enhanced Smart Scheduler - Intelligent schedule generation with:
 * - AI planning phase for constraint analysis
 * - Smart faculty matching using RAG
 * - Real-time thinking process logging
 * - Hard constraint enforcement (e.g., NSTP Saturday 8-11AM)
 * 
 * Key Features:
 * - AI-powered planning and optimization phase
 * - Progressive status updates showing thinking process
 * - NSTP courses: strict Saturday 8:00AM-11:00AM enforcement
 * - Smart faculty assignment using RAG-based recommendations
 */

const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Schedule = require('../models/Schedule.model');
const { recommendFacultyForSubject } = require('./gemini.service');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load all 5 API keys from environment (same as gemini.service.js)
const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean); // Remove any undefined/null keys

let currentKeyIndex = 0;

/**
 * Get the next available API key with automatic rotation
 */
const getNextApiKey = () => {
  if (API_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured');
  }
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
};

/**
 * Generate schedule for a program and year level with AI optimization
 * @param {Object} params - Generation parameters
 * @param {Function} statusCallback - Optional callback for progress updates
 * @returns {Object} Generated schedules and statistics
 */
async function generateScheduleForProgram(params, statusCallback = null) {
  const {
    academicYear,
    semester,
    program,
    yearLevel,
    section,  // Single section identifier (e.g., 'A', 'B', 'C')
    shift = 'Day',  // Default to Day shift if not specified
    useAIRecommendations = false  // Whether to use AI-powered faculty recommendations
  } = params;

  const results = {
    success: [],
    failed: [],
    conflicts: [],
    statistics: {
      totalSubjects: 0,
      scheduledSubjects: 0,
      failedSubjects: 0,
      conflictsDetected: 0
    },
    thinkingProcess: []  // Track AI thinking steps
  };

  // Helper to report progress
  const reportStatus = (message, data = {}) => {
    results.thinkingProcess.push({ message, timestamp: new Date(), ...data });
    if (statusCallback) {
      statusCallback({ message, data });
    }
    console.log(`[Schedule Generator] ${message}`, data);
  };

  try {
    reportStatus('🤖 Initializing AI-enhanced schedule generation...');

    // Step 1: Get all subjects for this program/year/semester
    reportStatus('📚 Fetching subjects for schedule generation...');
    const subjects = await Subject.find({
      program,
      yearLevel,
      semester,
      isActive: true
    }).populate('prerequisites');

    results.statistics.totalSubjects = subjects.length;

    if (subjects.length === 0) {
      return {
        success: false,
        message: 'No subjects found for this program/year/semester',
        results
      };
    }

    reportStatus(`✅ Found ${subjects.length} subjects to schedule`, { count: subjects.length });

    // Step 2: Get available faculty and rooms
    reportStatus('👥 Loading available faculty and rooms...');
    const availableFaculty = await Faculty.find({ isActive: true })
      .populate('user', 'firstName lastName');
    
    const availableRooms = await Room.find({ isActive: true });

    reportStatus(`✅ Loaded ${availableFaculty.length} faculty and ${availableRooms.length} rooms`, {
      faculty: availableFaculty.length,
      rooms: availableRooms.length
    });

    // Step 3: AI Planning Phase - Analyze constraints and optimize strategy
    if (useAIRecommendations) {
      reportStatus('🧠 Activating AI planning phase...');
      try {
        const planningResult = await aiPlanningPhase(subjects, availableFaculty, availableRooms, {
          program,
          yearLevel,
          semester,
          shift
        });
        reportStatus('✅ AI planning complete', planningResult);
        results.aiPlan = planningResult;
      } catch (error) {
        reportStatus('⚠️ AI planning failed, proceeding with standard algorithm', { error: error.message });
      }
    }

    // Step 4: Define time slots (typical university schedule)
    const timeSlots = generateTimeSlots();
    reportStatus(`🕐 Generated ${timeSlots.length} time slots per day`);

    // Step 5: Separate NSTP subjects (must be scheduled Saturday 8-11AM)
    const nstpSubjects = subjects.filter(s => 
      /NSTP/i.test(s.subjectCode) || /NSTP/i.test(s.subjectName)
    );
    const regularSubjects = subjects.filter(s => 
      !/NSTP/i.test(s.subjectCode) && !/NSTP/i.test(s.subjectName)
    );

    if (nstpSubjects.length > 0) {
      reportStatus(`📋 Detected ${nstpSubjects.length} NSTP subject(s) - will enforce Saturday 8:00-11:00AM`, {
        nstpSubjects: nstpSubjects.map(s => s.subjectCode)
      });
    }

    // Step 6: Generate schedule for the specified section
    const sectionCode = `${program}-${yearLevel}${section}-${semester}-${academicYear}`;
    reportStatus(`📝 Generating schedule for section: ${sectionCode}`);

    // Track used time slots to prevent conflicts
    const usedTimeSlots = new Map(); // key: "day-time", value: { faculty, room }

    // Step 7: Schedule NSTP subjects first (Saturday 8-11AM constraint)
    for (const subject of nstpSubjects) {
      // Check if subject already scheduled for this section (prevents duplicates)
      const alreadyScheduled = await isSubjectAlreadyScheduled(
        subject._id, 
        sectionCode, 
        academicYear, 
        semester
      );
      
      if (alreadyScheduled) {
        reportStatus(`⏭️ Skipping ${subject.subjectCode} - already scheduled for ${sectionCode}`);
        results.statistics.scheduledSubjects++; // Count as success (already exists)
        continue;
      }

      reportStatus(`🎯 Scheduling NSTP: ${subject.subjectCode} (Saturday 8:00-11:00AM)`, {
        subject: subject.subjectCode
      });

      try {
        const result = await scheduleSubject(
          subject,
          availableFaculty,
          availableRooms,
          [{ day: 'Saturday', startTime: '08:00', endTime: '11:00' }], // Fixed NSTP slot
          {
            academicYear,
            semester,
            program,
            yearLevel,
            section,
            sectionCode,
            shift,
            useAIRecommendations
          },
          usedTimeSlots,
          reportStatus
        );

        if (result.success) {
          results.success.push(result.data);
          results.statistics.scheduledSubjects++;
        } else {
          results.failed.push(result.error);
          results.statistics.failedSubjects++;
        }
      } catch (error) {
        results.failed.push({
          subject: subject.subjectCode,
          reason: error.message
        });
        results.statistics.failedSubjects++;
      }
    }

    // Step 8: Schedule regular subjects
    let dayIndex = 0;
    let slotIndex = 0;

    for (const subject of regularSubjects) {
      // Check if subject already scheduled for this section (prevents duplicates)
      const alreadyScheduled = await isSubjectAlreadyScheduled(
        subject._id,
        sectionCode,
        academicYear,
        semester
      );
      
      if (alreadyScheduled) {
        reportStatus(`⏭️ Skipping ${subject.subjectCode} - already scheduled for ${sectionCode}`);
        results.statistics.scheduledSubjects++; // Count as success (already exists)
        continue;
      }

      reportStatus(`📖 Scheduling: ${subject.subjectCode} (${subject.subjectName})`, {
        subject: subject.subjectCode,
        lectureHours: subject.lectureHours,
        labHours: subject.labHours
      });

      try {
        // Calculate required time slots based on lecture + lab hours
        const totalHours = subject.lectureHours + subject.labHours;
        const slotsNeeded = Math.ceil(totalHours / 1.5); // 1.5 hours per slot
        const assignedSlots = [];

        reportStatus(`⏱️ Subject requires ${totalHours} hours (${slotsNeeded} slots)`, {
          totalHours,
          slotsNeeded
        });

        // Find available time slots
        let attemptsLeft = 100; // Prevent infinite loop
        while (assignedSlots.length < slotsNeeded && attemptsLeft > 0) {
          attemptsLeft--;

          if (slotIndex >= timeSlots.length) {
            dayIndex++;
            slotIndex = 0;
          }

          if (dayIndex >= 6) { // Max 6 days (Mon-Sat)
            break;
          }

          const dayName = getDayName(dayIndex);
          const slot = timeSlots[slotIndex];
          const slotKey = `${dayName}-${slot.startTime}-${slot.endTime}`;

          // Check if slot is available
          if (!usedTimeSlots.has(slotKey)) {
            assignedSlots.push({
              day: dayName,
              startTime: slot.startTime,
              endTime: slot.endTime
            });
          }

          slotIndex++;
        }

        if (assignedSlots.length < slotsNeeded) {
          reportStatus(`❌ Not enough time slots available for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            reason: 'Not enough time slots available'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        const result = await scheduleSubject(
          subject,
          availableFaculty,
          availableRooms,
          assignedSlots,
          {
            academicYear,
            semester,
            program,
            yearLevel,
            section,
            sectionCode,
            shift,
            useAIRecommendations
          },
          usedTimeSlots,
          reportStatus
        );

        if (result.success) {
          results.success.push(result.data);
          results.statistics.scheduledSubjects++;
        } else {
          results.failed.push(result.error);
          results.statistics.failedSubjects++;
        }

      } catch (error) {
        reportStatus(`❌ Error scheduling ${subject.subjectCode}: ${error.message}`);
        results.failed.push({
          subject: subject.subjectCode,
          reason: error.message
        });
        results.statistics.failedSubjects++;
      }
    }

    reportStatus('✨ Schedule generation complete!', {
      scheduled: results.statistics.scheduledSubjects,
      failed: results.statistics.failedSubjects,
      conflicts: results.statistics.conflictsDetected
    });

    return {
      success: true,
      message: 'Schedule generation completed',
      aiUsed: useAIRecommendations,
      results
    };

  } catch (error) {
    reportStatus(`💥 Fatal error: ${error.message}`);
    console.error('Schedule generation error:', error);
    throw error;
  }
}

/**
 * AI Planning Phase - Analyze constraints and generate optimization strategy
 */
async function aiPlanningPhase(subjects, faculty, rooms, context) {
  // Get next API key with rotation
  const apiKey = getNextApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `You are an AI scheduling optimizer. Analyze these constraints and provide optimization recommendations.

CONTEXT:
- Program: ${context.program}
- Year Level: ${context.yearLevel}
- Semester: ${context.semester}
- Shift: ${context.shift}

SUBJECTS (${subjects.length}):
${subjects.map(s => `- ${s.subjectCode}: ${s.subjectName} (Lec: ${s.lectureHours}h, Lab: ${s.labHours}h, Units: ${s.units})`).join('\n')}

FACULTY (${faculty.length}):
${faculty.map(f => `- ${f.user?.firstName} ${f.user?.lastName}: Load ${f.currentLoad || 0}/${f.maxTeachingHours || 36}, Specializations: ${(f.specializations || []).join(', ')}`).join('\n')}

ROOMS (${rooms.length}):
${rooms.map(r => `- ${r.roomCode} (${r.roomType}, Cap: ${r.capacity})`).join('\n')}

CONSTRAINTS:
1. NSTP courses MUST be scheduled Saturday 8:00-11:00AM (non-negotiable)
2. No faculty can teach overlapping time slots
3. No room can have overlapping classes
4. Faculty teaching load must not exceed maximum
5. Lab subjects need appropriate lab rooms

Provide a brief optimization strategy (max 200 words) focusing on:
1. How to prioritize subjects for optimal fit
2. Faculty assignment recommendations
3. Room allocation strategy
4. Potential bottlenecks or conflicts

Be concise and actionable.`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  return {
    strategy: response,
    timestamp: new Date()
  };
}

/**
 * Schedule a single subject with all constraints
 */
async function scheduleSubject(
  subject,
  availableFaculty,
  availableRooms,
  assignedSlots,
  scheduleContext,
  usedTimeSlots,
  reportStatus
) {
  const {
    academicYear,
    semester,
    program,
    yearLevel,
    section,
    sectionCode,
    shift,
    useAIRecommendations
  } = scheduleContext;

  // Find suitable faculty
  reportStatus(`👨‍🏫 Finding suitable faculty for ${subject.subjectCode}...`);
  const suitableFaculty = await findSuitableFaculty(
    subject,
    availableFaculty,
    useAIRecommendations,
    reportStatus,
    scheduleContext.program  // Pass program filter
  );

  if (!suitableFaculty) {
    reportStatus(`❌ No suitable faculty found for ${subject.subjectCode}`);
    return {
      success: false,
      error: {
        subject: subject.subjectCode,
        reason: 'No suitable faculty found'
      }
    };
  }

  reportStatus(`✅ Assigned faculty: ${getFacultyName(suitableFaculty)}`);

  // Check faculty availability for assigned time slots
  for (const slot of assignedSlots) {
    if (!isFacultyAvailable(suitableFaculty, slot.day, slot.startTime, slot.endTime)) {
      reportStatus(`⚠️ Faculty ${getFacultyName(suitableFaculty)} unavailable at ${slot.day} ${slot.startTime}-${slot.endTime}`);
      return {
        success: false,
        error: {
          subject: subject.subjectCode,
          reason: `Faculty unavailable at ${slot.day} ${slot.startTime}-${slot.endTime}`
        }
      };
    }
  }

  // Find suitable room
  reportStatus(`🏫 Finding suitable room for ${subject.subjectCode}...`);
  const suitableRoom = findSuitableRoom(subject, availableRooms);

  if (!suitableRoom) {
    reportStatus(`❌ No suitable room found for ${subject.subjectCode}`);
    return {
      success: false,
      error: {
        subject: subject.subjectCode,
        reason: 'No suitable room found'
      }
    };
  }

  reportStatus(`✅ Assigned room: ${suitableRoom.roomCode} (${suitableRoom.roomType})`);

  // Create schedule entry
  const scheduleData = {
    academicYear,
    semester,
    program,
    yearLevel,
    section,
    sectionCode,
    shift,
    subject: subject._id,
    faculty: suitableFaculty._id,
    room: suitableRoom.roomCode,
    timeSlots: assignedSlots,
    maxStudents: suitableRoom.capacity,
    status: 'draft',
    isActive: true,
    generatedBy: 'ai_enhanced_solver'
  };

  // Check for conflicts
  reportStatus(`🔍 Checking for conflicts...`);
  const conflictResult = await checkConflictsBeforeCreation(scheduleData);
  
  if (conflictResult.hasConflict) {
    reportStatus(`⚠️ ${conflictResult.type} conflict detected for ${subject.subjectCode}`);
    return {
      success: false,
      error: {
        subject: subject.subjectCode,
        reason: `${conflictResult.type} conflict detected`,
        conflictType: conflictResult.type
      }
    };
  }

  // Mark time slots as used
  for (const slot of assignedSlots) {
    const slotKey = `${slot.day}-${slot.startTime}-${slot.endTime}`;
    usedTimeSlots.set(slotKey, {
      faculty: suitableFaculty._id,
      room: suitableRoom.roomCode,
      subject: subject.subjectCode
    });
  }

  // Create schedule
  const schedule = await Schedule.create(scheduleData);

  // Update faculty load
  await Faculty.findByIdAndUpdate(suitableFaculty._id, {
    $inc: { currentLoad: subject.units }
  });

  reportStatus(`✅ Successfully scheduled ${subject.subjectCode}`, {
    scheduleId: schedule._id
  });

  return {
    success: true,
    data: {
      scheduleId: schedule._id,
      subject: subject.subjectCode,
      faculty: getFacultyName(suitableFaculty),
      room: suitableRoom.roomCode,
      timeSlots: assignedSlots
    }
  };
}

// Helper: Find suitable faculty for a subject (with optional AI recommendations)
async function findSuitableFaculty(subject, facultyList, useAI = false, reportStatus = null, programFilter = null) {
  // Filter faculty who:
  // 1. Are assigned to the correct program (if programFilter specified)
  // 2. Have required qualifications (if specified)
  // 3. Have available teaching load
  // 4. Are not overloaded
  
  if (reportStatus) {
    reportStatus(`🔍 Filtering ${facultyList.length} faculty members...`);
  }

  const suitable = facultyList.filter(f => {
    // Enhanced program filtering (OR-TOOLS approach):
    // 1. Faculty explicitly assigned to this program
    // 2. Faculty has teaching history in this program
    // 3. Faculty has no program restrictions (flexible)
    if (programFilter) {
      const explicitlyAssigned = f.programs && f.programs.includes(programFilter);
      const hasTeachingHistory = f.teachingHistory && 
        f.teachingHistory.some(h => h.program === programFilter);
      const isFlexible = !f.programs || f.programs.length === 0;
      
      const programMatch = explicitlyAssigned || hasTeachingHistory || isFlexible;
      if (!programMatch) return false;
    }

    // Check if has available load (using correct field names from Faculty model)
    const maxHours = f.maxTeachingHours || 36; // Default to 36 if not set
    const currentHours = f.currentLoad || 0;
    const hasAvailableLoad = currentHours < maxHours;
    
    // If no required qualifications specified, any faculty with available load is suitable
    if (!subject.requiredQualifications || subject.requiredQualifications.length === 0) {
      return hasAvailableLoad;
    }

    // Check if has required qualifications
    const hasQualification = subject.requiredQualifications.some(req =>
      (f.specializations && f.specializations.includes(req)) ||
      (f.qualifications && f.qualifications.some(q => q.field && q.field.includes(req)))
    );

    return hasQualification && hasAvailableLoad;
  });

  if (reportStatus) {
    reportStatus(`✅ Found ${suitable.length} qualified faculty members${programFilter ? ` for ${programFilter}` : ''}`);
  }

  if (suitable.length === 0) {
    return null;
  }

  // If AI recommendations are enabled, use AI scoring
  if (useAI) {
    if (reportStatus) {
      reportStatus(`🤖 Using AI to find best faculty match...`);
    }

    try {
      const aiResponse = await recommendFacultyForSubject(subject._id.toString());
      
      // Extract recommendations array from response
      const aiRecommendations = aiResponse?.recommendations || [];

      if (aiRecommendations && aiRecommendations.length > 0) {
        // Map AI scores to suitable faculty
        const scoredFaculty = suitable.map(faculty => {
          const aiRec = aiRecommendations.find(
            rec => rec.faculty && rec.faculty._id && rec.faculty._id.toString() === faculty._id.toString()
          );
          return {
            faculty,
            aiScore: aiRec ? aiRec.score : 0,
            percentage: aiRec ? Math.round((aiRec.score / 50) * 100) : 0 // Convert score to percentage
          };
        });

        // Sort by AI score (highest first)
        scoredFaculty.sort((a, b) => b.aiScore - a.aiScore);
        
        const bestMatch = scoredFaculty[0];
        
        // Check if bestMatch has valid faculty and user data
        if (bestMatch && bestMatch.faculty && bestMatch.faculty.user) {
          if (reportStatus) {
            const facultyName = getFacultyName(bestMatch.faculty);
            reportStatus(`🎯 AI recommendation: ${facultyName} (${bestMatch.percentage}% match)`, {
              faculty: facultyName,
              matchPercentage: bestMatch.percentage,
              aiScore: bestMatch.aiScore
            });
          }
          
          console.log(`AI Recommendation for ${subject.subjectCode}: ${getFacultyName(bestMatch.faculty)} (${bestMatch.percentage}%)`);
          
          return bestMatch.faculty;
        } else {
          if (reportStatus) {
            reportStatus(`⚠️ AI recommendation data incomplete, using standard selection`);
          }
          console.warn('AI recommendation returned incomplete faculty data, falling back to standard selection');
        }
      }
    } catch (error) {
      if (reportStatus) {
        reportStatus(`⚠️ AI recommendation failed, using standard selection`);
      }
      console.error('AI recommendation failed, falling back to standard selection:', error);
      // Fall through to standard selection
    }
  }

  // Standard selection: Sort by current load (assign to faculty with lowest load first)
  suitable.sort((a, b) => (a.currentLoad || 0) - (b.currentLoad || 0));

  if (reportStatus && suitable[0] && suitable[0].user) {
    reportStatus(`✅ Selected: ${getFacultyName(suitable[0])} (Load: ${suitable[0].currentLoad || 0}/${suitable[0].maxTeachingHours || 36})`);
  }

  return suitable[0];
}

// Helper: Find suitable room for a subject (ENHANCED - validates capacity)
function findSuitableRoom(subject, roomList, sectionEnrollment = 40) {
  // Determine room type needed
  let preferredType = 'Lecture Room';
  if (subject.labHours > 0) {
    if (subject.subjectName.toLowerCase().includes('computer')) {
      preferredType = 'Computer Lab';
    } else {
      preferredType = 'Laboratory';
    }
  }

  // Filter rooms by type AND capacity (prevents overcrowding)
  const suitable = roomList.filter(r => 
    r.roomType === preferredType && 
    (r.capacity || 0) >= sectionEnrollment
  );

  // Sort by capacity (smallest suitable room - saves big halls for big sections)
  suitable.sort((a, b) => a.capacity - b.capacity);

  // If no suitable room found, try relaxing type constraint but keep capacity
  if (suitable.length === 0) {
    const anyTypeWithCapacity = roomList.filter(r => 
      (r.capacity || 0) >= sectionEnrollment
    );
    if (anyTypeWithCapacity.length > 0) {
      console.warn(`No ${preferredType} available for ${subject.subjectCode}, using ${anyTypeWithCapacity[0].roomType}`);
      return anyTypeWithCapacity[0];
    }
  }

  // Last resort: return largest available room
  return suitable[0] || roomList.sort((a, b) => (b.capacity || 0) - (a.capacity || 0))[0];
}

// Helper: Generate standard time slots
function generateTimeSlots() {
  return [
    { startTime: '07:00', endTime: '08:30' },
    { startTime: '08:30', endTime: '10:00' },
    { startTime: '10:00', endTime: '11:30' },
    { startTime: '11:30', endTime: '13:00' },
    { startTime: '13:00', endTime: '14:30' },
    { startTime: '14:30', endTime: '16:00' },
    { startTime: '16:00', endTime: '17:30' },
    { startTime: '17:30', endTime: '19:00' }
  ];
}

// Helper: Get day name from index
function getDayName(index) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[index] || 'Monday';
}

// Helper: Check conflicts before creating schedule (ENHANCED - includes section conflicts)
async function checkConflictsBeforeCreation(scheduleData) {
  const { faculty, room, sectionCode, timeSlots, academicYear, semester } = scheduleData;

  // Check faculty, room, AND section conflicts (prevents student double-booking!)
  const existingSchedules = await Schedule.find({
    academicYear,
    semester,
    isActive: true,
    $or: [
      { faculty },
      { room },
      { sectionCode }  // CRITICAL: Check if section already has a class at this time
    ]
  });

  for (const existing of existingSchedules) {
    for (const newSlot of timeSlots) {
      for (const existingSlot of existing.timeSlots) {
        if (newSlot.day === existingSlot.day) {
          const overlap = checkTimeOverlap(
            newSlot.startTime,
            newSlot.endTime,
            existingSlot.startTime,
            existingSlot.endTime
          );
          if (overlap) {
            // Provide detailed conflict information
            const conflictType = 
              existing.sectionCode === sectionCode ? 'section (student)' :
              existing.faculty?.toString() === faculty?.toString() ? 'faculty' :
              'room';
            return { 
              hasConflict: true, 
              type: conflictType,
              existingSchedule: existing 
            };
          }
        }
      }
    }
  }

  return { hasConflict: false };
}

// Helper: Check if subject is already scheduled for this section (prevents duplicates)
async function isSubjectAlreadyScheduled(subjectId, sectionCode, academicYear, semester) {
  const existing = await Schedule.findOne({
    subject: subjectId,
    sectionCode,
    academicYear,
    semester,
    isActive: true
  });
  return existing !== null;
}

// Helper: Check if faculty is available at given time (respects unavailability)
function isFacultyAvailable(faculty, day, startTime, endTime) {
  if (!faculty.unavailableTimeSlots || faculty.unavailableTimeSlots.length === 0) {
    return true;
  }
  
  return !faculty.unavailableTimeSlots.some(unavail => {
    if (unavail.day !== day) return false;
    return checkTimeOverlap(startTime, endTime, unavail.startTime, unavail.endTime);
  });
}

// Helper: Get faculty name safely (handles missing user)
function getFacultyName(faculty) {
  if (!faculty) return 'Unknown Faculty';
  if (faculty.user && faculty.user.firstName) {
    return `${faculty.user.firstName} ${faculty.user.lastName || ''}`.trim();
  }
  return faculty.employeeId || faculty._id?.toString() || 'Unknown Faculty';
}

// Helper: Check time overlap
function checkTimeOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return (s1 < e2 && e1 > s2);
}

// Helper: Convert time to minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Preview schedule generation (doesn't save to database)
 * Uses AI-enhanced logic but doesn't persist to database
 * @param {Object} params - Generation parameters
 * @param {Function} statusCallback - Optional callback for progress updates  
 * @returns {Object} Preview of schedules to be created
 */
async function previewScheduleForProgram(params, statusCallback = null) {
  const {
    academicYear,
    semester,
    program,
    yearLevel,
    section,
    shift = 'Day',
    useAIRecommendations = false
  } = params;

  const results = {
    schedules: [],
    failed: [],
    conflicts: [],
    statistics: {
      totalSubjects: 0,
      scheduledSubjects: 0,
      failedSubjects: 0,
      conflictsDetected: 0
    },
    thinkingProcess: []
  };

  // Helper to report progress
  const reportStatus = (message, data = {}) => {
    results.thinkingProcess.push({ message, timestamp: new Date(), ...data });
    if (statusCallback) {
      statusCallback({ message, data });
    }
    console.log(`[Preview Generator] ${message}`, data);
  };

  try {
    reportStatus('🤖 Initializing AI-enhanced schedule preview...');

    // Step 1: Get all subjects for this program/year/semester
    reportStatus('📚 Fetching subjects...');
    const subjects = await Subject.find({
      program,
      yearLevel,
      semester,
      isActive: true
    }).populate('prerequisites');

    results.statistics.totalSubjects = subjects.length;

    if (subjects.length === 0) {
      return {
        success: false,
        message: 'No subjects found for this program/year/semester',
        aiUsed: useAIRecommendations,
        results,
        preview: results
      };
    }

    reportStatus(`✅ Found ${subjects.length} subjects`, { count: subjects.length });

    // Step 2: Get available faculty and rooms
    reportStatus('👥 Loading faculty and rooms...');
    const availableFaculty = await Faculty.find({ isActive: true })
      .populate('user', 'firstName lastName');
    
    const availableRooms = await Room.find({ isActive: true });

    reportStatus(`✅ Loaded ${availableFaculty.length} faculty, ${availableRooms.length} rooms`, {
      faculty: availableFaculty.length,
      rooms: availableRooms.length
    });

    // Step 3: AI Planning Phase (if enabled)
    let aiPlan = null;
    if (useAIRecommendations) {
      reportStatus('🧠 Running AI planning phase...');
      try {
        aiPlan = await aiPlanningPhase(subjects, availableFaculty, availableRooms, {
          program,
          yearLevel,
          semester,
          shift
        });
        reportStatus('✅ AI planning complete');
      } catch (error) {
        reportStatus(`⚠️ AI planning failed: ${error.message}`);
      }
    }

    // Step 4: Separate NSTP from regular subjects
    const nstpSubjects = subjects.filter(s => 
      /NSTP/i.test(s.subjectCode) || /NSTP/i.test(s.subjectName)
    );
    const regularSubjects = subjects.filter(s => 
      !/NSTP/i.test(s.subjectCode) && !/NSTP/i.test(s.subjectName)
    );

    if (nstpSubjects.length > 0) {
      reportStatus(`📋 Detected ${nstpSubjects.length} NSTP subject(s) - Saturday 8-11AM`, {
        nstpSubjects: nstpSubjects.map(s => s.subjectCode)
      });
    }

    // Step 5: Define time slots and section code
    const timeSlots = generateTimeSlots();
    const sectionCode = `${program}-${yearLevel}${section}-${semester}-${academicYear}`;
    const usedTimeSlots = new Map();

    // Step 6: Schedule NSTP subjects first (Saturday 8-11AM)
    for (const subject of nstpSubjects) {
      reportStatus(`🎯 Scheduling NSTP: ${subject.subjectCode}`);
      
      try {
        const suitableFaculty = await findSuitableFaculty(
          subject,
          availableFaculty,
          useAIRecommendations,
          reportStatus,
          program  // Pass program filter
        );

        if (!suitableFaculty) {
          reportStatus(`❌ No faculty for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            subjectName: subject.subjectName,
            reason: 'No suitable faculty found'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        const suitableRoom = findSuitableRoom(subject, availableRooms);

        if (!suitableRoom) {
          reportStatus(`❌ No room for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            subjectName: subject.subjectName,
            reason: 'No suitable room found'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        const assignedSlots = [{ day: 'Saturday', startTime: '08:00', endTime: '11:00' }];

        // Mark as used
        usedTimeSlots.set('Saturday-08:00-11:00', {
          faculty: suitableFaculty._id,
          room: suitableRoom.roomCode,
          subject: subject.subjectCode
        });

        results.schedules.push({
          academicYear,
          semester,
          program,
          yearLevel,
          section,
          sectionCode,
          shift,
          subject: subject._id,
          faculty: suitableFaculty._id,
          room: suitableRoom.roomCode,
          timeSlots: assignedSlots,
          maxStudents: suitableRoom.capacity,
          status: 'draft',
          isActive: true,
          generatedBy: 'ai_enhanced_preview',
          metadata: {
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            units: subject.units,
            facultyName: getFacultyName(suitableFaculty),
            facultyId: suitableFaculty.employeeId,
            roomName: suitableRoom.roomName,
            roomCapacity: suitableRoom.capacity
          }
        });

        results.statistics.scheduledSubjects++;
        reportStatus(`✅ ${subject.subjectCode} scheduled`);

      } catch (error) {
        reportStatus(`❌ Error: ${error.message}`);
        results.failed.push({
          subject: subject.subjectCode,
          subjectName: subject.subjectName,
          reason: error.message
        });
        results.statistics.failedSubjects++;
      }
    }

    // Step 7: Schedule regular subjects
    let dayIndex = 0;
    let slotIndex = 0;

    for (const subject of regularSubjects) {
      reportStatus(`📖 Scheduling: ${subject.subjectCode}`);

      try {
        const suitableFaculty = await findSuitableFaculty(
          subject,
          availableFaculty,
          useAIRecommendations,
          reportStatus,
          program  // Pass program filter
        );

        if (!suitableFaculty) {
          reportStatus(`❌ No faculty for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            subjectName: subject.subjectName,
            reason: 'No suitable faculty found'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        const suitableRoom = findSuitableRoom(subject, availableRooms);

        if (!suitableRoom) {
          reportStatus(`❌ No room for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            subjectName: subject.subjectName,
            reason: 'No suitable room found'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        // Calculate time slots
        const totalHours = subject.lectureHours + subject.labHours;
        const slotsNeeded = Math.ceil(totalHours / 1.5);
        const assignedSlots = [];

        let attemptsLeft = 100;
        while (assignedSlots.length < slotsNeeded && attemptsLeft > 0) {
          attemptsLeft--;

          if (slotIndex >= timeSlots.length) {
            dayIndex++;
            slotIndex = 0;
          }

          if (dayIndex >= 6) break;

          const dayName = getDayName(dayIndex);
          const slot = timeSlots[slotIndex];
          const slotKey = `${dayName}-${slot.startTime}-${slot.endTime}`;

          if (!usedTimeSlots.has(slotKey)) {
            assignedSlots.push({
              day: dayName,
              startTime: slot.startTime,
              endTime: slot.endTime
            });
            usedTimeSlots.set(slotKey, {
              faculty: suitableFaculty._id,
              room: suitableRoom.roomCode,
              subject: subject.subjectCode
            });
          }

          slotIndex++;
        }

        if (assignedSlots.length < slotsNeeded) {
          reportStatus(`❌ Not enough slots for ${subject.subjectCode}`);
          results.failed.push({
            subject: subject.subjectCode,
            subjectName: subject.subjectName,
            reason: 'Not enough time slots available'
          });
          results.statistics.failedSubjects++;
          continue;
        }

        results.schedules.push({
          academicYear,
          semester,
          program,
          yearLevel,
          section,
          sectionCode,
          shift,
          subject: subject._id,
          faculty: suitableFaculty._id,
          room: suitableRoom.roomCode,
          timeSlots: assignedSlots,
          maxStudents: suitableRoom.capacity,
          status: 'draft',
          isActive: true,
          generatedBy: 'ai_enhanced_preview',
          metadata: {
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            units: subject.units,
            facultyName: getFacultyName(suitableFaculty),
            facultyId: suitableFaculty.employeeId,
            roomName: suitableRoom.roomName,
            roomCapacity: suitableRoom.capacity
          }
        });

        results.statistics.scheduledSubjects++;
        reportStatus(`✅ ${subject.subjectCode} scheduled`);

      } catch (error) {
        reportStatus(`❌ Error: ${error.message}`);
        results.failed.push({
          subject: subject.subjectCode,
          subjectName: subject.subjectName,
          reason: error.message
        });
        results.statistics.failedSubjects++;
      }
    }

    reportStatus('✨ Preview complete!', {
      scheduled: results.statistics.scheduledSubjects,
      failed: results.statistics.failedSubjects
    });

    return {
      success: true,
      message: 'Schedule preview generated successfully',
      aiUsed: useAIRecommendations,
      results,
      aiPlan,
      preview: results
    };

  } catch (error) {
    reportStatus(`💥 Fatal error: ${error.message}`);
    console.error('Preview generation error:', error);
    throw error;
  }
}

module.exports = {
  generateScheduleForProgram,
  previewScheduleForProgram
};
