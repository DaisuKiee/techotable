const geminiService = require('../services/gemini.service');
const Schedule = require('../models/Schedule.model');
const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const Room = require('../models/Room.model');
const Section = require('../models/Section.model');
const Student = require('../models/Student.model');
const ClassSpace = require('../models/ClassSpace.model');
const ActivityLog = require('../models/ActivityLog.model');
const User = require('../models/User.model');
const Program = require('../models/Program.model');
const {
  rankFacultyForSubject,
  currentAcademicYearStart,
  formatAcademicYear,
} = require('../utils/teachingExperience');
const { getFacultyLoads, EMPTY_LOAD } = require('../utils/facultyLoad');
const { sendError } = require('../middleware/error.middleware');

/**
 * Give faculty records their real load, computed from saved classes.
 *
 * The assistant used to read currentLoad / maxTeachingLoad straight off the
 * documents. currentLoad isn't in the Faculty schema, so it was never updated
 * and stayed 0 - B-LO told people every teacher had nothing assigned.
 */
const withRealLoads = async (faculty) => {
  const loads = await getFacultyLoads({ facultyIds: faculty.map((f) => f._id) });
  return faculty.map((f) => {
    const load = loads.get(String(f._id)) || EMPTY_LOAD;
    return {
      ...f,
      currentLoad: load.units,
      assignedUnits: load.units,
      teachingHours: load.hours,
      assignedClasses: load.classes,
      maxTeachingHours: f.maxTeachingHours || 36,
    };
  });
};

/**
 * Helper function to load comprehensive RAG context from database
 */
const loadRAGContext = async () => {
  console.log('Loading comprehensive RAG context...');
  
  // Fetch ALL relevant data for deep knowledge
  const [subjects, faculty, rooms, schedules, sections, students, classSpaces, users, programs] = await Promise.all([
    // Subjects with full details
    Subject.find()
      .select('subjectCode subjectName description units lectureHours labHours program yearLevel semester prerequisite')
      .lean(),
    
    // Faculty with complete profile and teaching history
    Faculty.find({ isActive: true })
      .populate('user', 'firstName lastName email')
      .select('employeeId specializations maxTeachingLoad maxTeachingHours position teachingHistory averageRating qualifications')
      .lean(),
    
    // Rooms with full specifications
    Room.find()
      .select('roomNumber building capacity roomType features availability')
      .lean(),
    
    // Schedules with relationships
    Schedule.find({ isActive: true })
      .populate('subject', 'subjectCode subjectName units')
      .populate('faculty', 'employeeId')
      .populate('room', 'roomNumber building')
      .populate('section', 'sectionCode')
      .select('program yearLevel semester shift day startTime endTime timeSlots isPublished status createdAt')
      .lean(),
    
    // Sections with enrollment data
    Section.find()
      .select('sectionCode program yearLevel semester shift maxStudents currentStudents')
      .lean(),
    
    // Students with enrollment info
    Student.find()
      .populate('user', 'firstName lastName email')
      .populate('enrolledClasses', 'subject section day startTime endTime')
      .select('studentId program studentType sectionCode subjectCodes enrollmentStatus academicYear semester gpa')
      .limit(500) // Limit for performance
      .lean(),
    
    // ClassSpace schedules (published/active schedules)
    ClassSpace.find()
      .populate('schedule', 'subject faculty room section day startTime endTime program yearLevel semester shift')
      .select('sectionCode enrollmentCode isActive enrolledStudents')
      .lean(),
    
    // Users (for authentication and role management)
    User.find()
      .select('firstName lastName email role program department isActive createdAt')
      .lean(),

    // Programs (the authoritative list of program codes/names)
    Program.find({ isActive: true })
      .select('code name description department duration')
      .sort({ code: 1 })
      .lean()
  ]);

  // Build rich context with statistics
  const facultyWithLoads = await withRealLoads(faculty);
  const facultyStats = facultyWithLoads.map(f => {
    const fullName = `${f.user?.firstName || ''} ${f.user?.lastName || ''}`.trim();
    const schedulesCount = schedules.filter(s => 
      s.faculty && f._id && s.faculty._id && s.faculty._id.toString() === f._id.toString()
    ).length;
    
    // Analyze teaching history for experience
    const subjectExperience = {};
    if (f.teachingHistory && f.teachingHistory.length > 0) {
      f.teachingHistory.forEach(h => {
        const key = h.subjectCode || h.subjectName;
        if (key) {
          subjectExperience[key] = (subjectExperience[key] || 0) + 1;
        }
      });
    }

    return {
      ...f,
      fullName,
      currentSchedules: schedulesCount,
      availableLoad: Math.max(0, (f.maxTeachingLoad || 24) - f.assignedUnits),
      availableHours: Math.max(0, f.maxTeachingHours - f.teachingHours),
      subjectExperience,
      experienceYears: f.teachingHistory?.length || 0
    };
  });

  const scheduleStats = {
    total: schedules.length,
    published: schedules.filter(s => s.isPublished).length,
    pending: schedules.filter(s => !s.isPublished).length,
    byProgram: {},
    byYearLevel: {},
    byShift: {}
  };

  schedules.forEach(s => {
    scheduleStats.byProgram[s.program] = (scheduleStats.byProgram[s.program] || 0) + 1;
    scheduleStats.byYearLevel[s.yearLevel] = (scheduleStats.byYearLevel[s.yearLevel] || 0) + 1;
    scheduleStats.byShift[s.shift] = (scheduleStats.byShift[s.shift] || 0) + 1;
  });

  const roomStats = rooms.map(r => {
    const schedulesInRoom = schedules.filter(s => 
      s.room && r._id && s.room._id && s.room._id.toString() === r._id.toString()
    ).length;
    return {
      ...r,
      utilizationCount: schedulesInRoom,
      isHighlyUtilized: schedulesInRoom > 10
    };
  });

  const studentStats = {
    total: students.length,
    byProgram: {},
    byType: {},
    byStatus: {}
  };

  students.forEach(s => {
    studentStats.byProgram[s.program] = (studentStats.byProgram[s.program] || 0) + 1;
    studentStats.byType[s.studentType] = (studentStats.byType[s.studentType] || 0) + 1;
    studentStats.byStatus[s.enrollmentStatus] = (studentStats.byStatus[s.enrollmentStatus] || 0) + 1;
  });

  const context = {
    subjects: subjects || [],
    faculty: facultyStats || [],
    rooms: roomStats || [],
    schedules: schedules || [],
    sections: sections || [],
    students: students || [],
    classSpaces: classSpaces || [],
    users: users || [],
    programs: programs || [],
    stats: {
      totalSubjects: subjects.length,
      totalFaculty: faculty.length,
      totalRooms: rooms.length,
      totalSchedules: schedules.length,
      totalSections: sections.length,
      totalStudents: students.length,
      totalClassSpaces: classSpaces.length,
      totalUsers: users.length,
      totalPrograms: programs.length,
      scheduleStats,
      studentStats
    }
  };

  console.log(`RAG Context loaded: ${programs.length} programs, ${subjects.length} subjects, ${faculty.length} faculty, ${rooms.length} rooms, ${schedules.length} schedules, ${sections.length} sections, ${students.length} students, ${classSpaces.length} classSpaces, ${users.length} users`);
  
  return context;
};

/**
 * @desc    Recommend faculty for a specific subject based on teaching experience
 * @route   POST /api/ai/recommend-faculty
 * @access  Private
 */
exports.recommendFacultyForSubject = async (req, res) => {
  try {
    const { subjectId, subjectCode, subjectName } = req.body;

    if (!subjectId && !subjectCode && !subjectName) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID, code, or name is required',
      });
    }

    // Find subject if we have code or name
    let subject;
    if (subjectId) {
      subject = await Subject.findById(subjectId);
    } else if (subjectCode) {
      subject = await Subject.findOne({ subjectCode });
    } else {
      subject = await Subject.findOne({ subjectName: new RegExp(subjectName, 'i') });
    }

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      });
    }

    // Only consider faculty qualified for this subject's program.
    // 'General' subjects are open to everyone.
    const facultyQuery = { isActive: true };
    if (subject.program && subject.program !== 'General') {
      facultyQuery.$or = [
        { programs: subject.program },
        { 'teachingHistory.program': subject.program },
      ];
    }

    const candidates = await Faculty.find(facultyQuery)
      .populate('user', 'firstName lastName email')
      .lean();

    // Rank by recency-weighted experience with this exact subject.
    // Recent experience outranks older experience - see utils/teachingExperience.js
    const ranked = rankFacultyForSubject(candidates, subject, {
      onlyWithCapacity: false,
    }).slice(0, 10);

    if (ranked.length === 0) {
      return res.status(200).json({
        success: true,
        subject: { code: subject.subjectCode, name: subject.subjectName },
        message: `No faculty are currently qualified for ${subject.program}.`,
        recommendations: [],
      });
    }

    const experienced = ranked.filter(r => r.experience.timesTaught > 0);

    return res.status(200).json({
      success: true,
      subject: {
        code: subject.subjectCode,
        name: subject.subjectName,
        program: subject.program,
        units: subject.units,
      },
      currentAcademicYear: formatAcademicYear(currentAcademicYearStart()),
      message: experienced.length > 0
        ? `${experienced.length} of ${ranked.length} candidates have taught ${subject.subjectCode} before. Ranked by how recently and how often they taught it.`
        : `No faculty have taught ${subject.subjectCode} before. Ranked by specialization, workload, and qualifications.`,
      recommendations: ranked.map((r, idx) => ({
        rank: idx + 1,
        facultyId: r.faculty._id,
        employeeId: r.faculty.employeeId,
        name: `${r.faculty.user?.firstName || ''} ${r.faculty.user?.lastName || ''}`.trim(),
        position: r.faculty.position,
        employmentType: r.faculty.employmentType,
        score: r.score,
        breakdown: r.breakdown,
        reason: r.reason,
        hasCapacity: r.hasCapacity,
        availableLoad: r.availableLoad,
        // The teaching-history detail the ranking is based on
        timesTaught: r.experience.timesTaught,
        lastTaughtAcademicYear: r.experience.lastTaughtAcademicYear,
        lastTaughtYearsAgo: r.experience.lastTaughtYearsAgo,
        firstTaughtAcademicYear: r.experience.firstTaughtAcademicYear,
        experienceIsDated: r.experience.isStale,
        weightedExperience: Math.round(r.experience.weightedExperience * 100) / 100,
        subjectRating: r.experience.avgRating,
        occurrences: r.experience.occurrences,
      })),
    });
  } catch (error) {
    return sendError(res, error, 'Failed to generate faculty recommendations');
  }
};

/**
 * @desc    Send a chat message to AI assistant with streaming response
 * @route   POST /api/ai/chat/stream
 * @access  Private
 */
exports.sendChatMessageStream = async (req, res) => {
  try {
    const { message, conversationHistory = [], includeContext = true } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Force headers to be sent immediately
    res.flushHeaders();

    // Build comprehensive context from database with RAG
    let context = {};
    
    if (includeContext) {
      try {
        context = await loadRAGContext();
      } catch (contextError) {
        console.error('Error loading RAG context:', contextError);
      }
    }

    // Stream AI response
    const result = await geminiService.generateChatResponseStream(
      message,
      context,
      conversationHistory,
      (chunk) => {
        // Send each chunk as SSE with immediate flush
        const sseData = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
        res.write(sseData);
        
        // Force flush if available (for Node.js streams)
        if (typeof res.flush === 'function') {
          res.flush();
        }
        
        console.log(`📤 Sent chunk (${chunk.length} chars):`, chunk.substring(0, 50) + '...');
      }
    );

    console.log('✅ Streaming completed. Result:', { success: result.success, messageLength: result.message?.length });

    if (result.success) {
      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'done', metadata: { keyUsed: result.keyUsed, totalKeys: result.totalKeys } })}\n\n`);
    } else {
      // Send error event
      res.write(`data: ${JSON.stringify({ type: 'error', message: result.message })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('AI Chat Stream Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to process your message' })}\n\n`);
    res.end();
  }
};

/**
 * @desc    Send a chat message to AI assistant
 * @route   POST /api/ai/chat
 * @access  Private
 */
exports.sendChatMessage = async (req, res) => {
  try {
    const { message, conversationHistory = [], includeContext = true } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    // Build comprehensive context from database with RAG
    let context = {};
    
    if (includeContext) {
      try {
        context = await loadRAGContext();
      } catch (contextError) {
        console.error('Error loading RAG context:', contextError);
      }
    }

    // Generate AI response with fallback support
    const result = await geminiService.generateChatResponse(
      message,
      context,
      conversationHistory
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        metadata: {
          keyUsed: result.keyUsed,
          totalKeys: result.totalKeys,
          contextLoaded: includeContext,
        },
      });
    } else {
      return res.status(503).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }
  } catch (error) {
    return sendError(res, error, 'Failed to process your message');
  }
};

/**
 * @desc    Get scheduling recommendation for a conflict
 * @route   POST /api/ai/recommend
 * @access  Private
 */
exports.getSchedulingRecommendation = async (req, res) => {
  try {
    const { conflictInfo } = req.body;

    if (!conflictInfo) {
      return res.status(400).json({
        success: false,
        message: 'Conflict information is required',
      });
    }

    // Fetch context data with teaching history
    const [subjects, faculty, rooms, schedules] = await Promise.all([
      Subject.find().select('subjectCode subjectName units').limit(50).lean(),
      Faculty.find({ isActive: true })
        .populate('user', 'firstName lastName')
        .select('employeeId specializations maxTeachingLoad maxTeachingHours teachingHistory')
        .limit(100)
        .lean()
        .then(withRealLoads),
      Room.find().select('roomNumber building capacity roomType').limit(50).lean(),
      Schedule.find().populate('subject', 'subjectCode').select('program yearLevel semester shift timeSlots').limit(100).lean(),
    ]);

    const scheduleData = {
      subjects,
      faculty,
      rooms,
      schedules,
    };

    const result = await geminiService.generateChatResponse(conflictInfo, scheduleData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        recommendation: result.message,
        metadata: {
          keyUsed: result.keyUsed,
          totalKeys: result.totalKeys,
        },
      });
    } else {
      return res.status(503).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }
  } catch (error) {
    return sendError(res, error, 'Failed to generate recommendation');
  }
};

/**
 * @desc    Get AI service statistics
 * @route   GET /api/ai/stats
 * @access  Private (Admin only)
 */
exports.getApiStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    // Gemini service stats
    const stats = {
      totalKeys: 5,
      note: 'Gemini service with 5 fallback API keys',
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to retrieve API statistics');
  }
};

/**
 * @desc    Quick help - Common questions and answers
 * @route   GET /api/ai/help
 * @access  Public
 */
exports.getQuickHelp = async (req, res) => {
  try {
    const quickHelp = {
      commonQuestions: [
        {
          question: "How do I assign a faculty to a schedule?",
          answer: "Click on a pending schedule card in the grid, then select a faculty member from the dropdown menu. The AI can recommend the most experienced faculty for that subject!",
          category: "scheduling",
        },
        {
          question: "Who is the best faculty to teach this subject?",
          answer: "Ask the AI Assistant! It will recommend faculty based on their teaching experience, showing how many years they've taught that specific subject.",
          category: "recommendations",
        },
        {
          question: "What does 'Cell is occupied' mean?",
          answer: "It means there's already a schedule in that time slot. Remove the existing schedule first before dropping a new one.",
          category: "scheduling",
        },
        {
          question: "How do I resolve time conflicts?",
          answer: "Check the schedule grid for overlapping time slots. You can either change the time or use a different day for the conflicting schedule.",
          category: "conflicts",
        },
        {
          question: "How do I publish a schedule?",
          answer: "After assigning all faculty and rooms, save the schedules. Then use the publish button on the Schedule page to make them visible to students.",
          category: "publishing",
        },
        {
          question: "Paano mag-assign ng faculty at room?",
          answer: "I-click ang pending schedule card, pagkatapos piliin ang faculty at room mula sa dropdown menu. Makakahingi ka rin ng recommendation sa AI!",
          category: "scheduling",
          language: "Filipino",
        },
      ],
      tips: [
        "💡 Use the duration selector (1h-5h) before dropping subjects",
        "⌨️ Press Ctrl+Z to undo changes",
        "🔄 Press Ctrl+Y to redo changes",
        "🎯 Hover over occupied cells to see warning messages",
        "📊 Check the pending summary at the bottom to see incomplete schedules",
        "⭐ Ask AI to recommend experienced faculty for any subject",
        "🤖 AI considers teaching history when suggesting faculty assignments",
      ],
      languages: [
        "🇬🇧 English",
        "🇵🇭 Filipino/Tagalog",
        "🇪🇸 Spanish",
        "🇯🇵 Japanese",
        "🇰🇷 Korean",
      ],
    };

    return res.status(200).json({
      success: true,
      data: quickHelp,
    });
  } catch (error) {
    return sendError(res, error, 'Failed to retrieve help information');
  }
};
