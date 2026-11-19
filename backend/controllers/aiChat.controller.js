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
const helpAssistant = require('../services/helpAssistant.service');
const { searchClause, escapeRegex } = require('../utils/safeQuery');

// Only staff get the data-driven assistant. Students and faculty get the
// help-desk mode, which never receives database records.
const STAFF_ROLES = ['admin', 'scheduling_officer', 'program_manager'];
const isStaff = (user) => STAFF_ROLES.includes(user?.role);

/**
 * Work out how to answer a non-staff message.
 * Returns { reply } for a fixed answer (limit hit or data request), or
 * { options, history } to ask the AI in help mode.
 */
const prepareHelpMode = (req, message, conversationHistory) => {
  const role = req.user.role === 'faculty' ? 'faculty' : 'student';
  const limit = helpAssistant.checkLimit(req.user._id);
  if (!limit.ok) return { reply: limit.message, limited: true };
  if (message.length > helpAssistant.MAX_LENGTH) {
    return { reply: `Please keep your question under ${helpAssistant.MAX_LENGTH} characters.` };
  }
  if (helpAssistant.isDataProbe(message)) return { reply: helpAssistant.dataWarning(role), guarded: true };
  return {
    options: { systemPrompt: helpAssistant.buildHelpPrompt(role, req.user.firstName), temperature: 0.3 },
    history: (Array.isArray(conversationHistory) ? conversationHistory : []).slice(-helpAssistant.HISTORY_LIMIT),
  };
};

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
// `program`: a program manager's B-LO only sees their own program's records
const loadRAGContext = async (program = null) => {
  const only = program ? { program } : {};

  // Fetch ALL relevant data for deep knowledge
  const [subjects, faculty, rooms, schedules, sections, students, classSpaces, users, programs] = await Promise.all([
    // Subjects with full details
    Subject.find(program ? { program: { $in: [program, 'General'] } } : {})
      .select('subjectCode subjectName description units lectureHours labHours program yearLevel semester prerequisite')
      .lean(),

    // Faculty with complete profile and teaching history
    Faculty.find({ isActive: true, ...(program && { programs: program }) })
      .populate('user', 'firstName lastName email')
      .select('employeeId specializations maxTeachingLoad maxTeachingHours position teachingHistory averageRating qualifications')
      .lean(),

    // Rooms with full specifications.
    // `roomCode` is the identifier people actually use ("COTE-26"), and it was
    // missing from this list, so the assistant could count laboratories but
    // could not name one.
    Room.find()
      .select('roomCode roomNumber building capacity roomType facilities isActive')
      .lean(),

    // Schedules with relationships.
    //
    // `.select()` has to name the reference fields themselves, or Mongoose
    // never fetches them and the `.populate()` calls above have nothing to
    // populate. It did not, so every schedule reached the assistant stripped
    // of its subject, teacher, room and section - which is why B-LO answered
    // "I don't have that information" to "who teaches CC 4112 for BSIT-4B-N?"
    // while the answer sat in the database. `sectionCode` is stored on the
    // schedule itself and is what the rest of the system matches on.
    Schedule.find({ isActive: true, ...only })
      .populate('subject', 'subjectCode subjectName units')
      .populate({ path: 'faculty', select: 'employeeId', populate: { path: 'user', select: 'firstName lastName' } })
      .select('subject faculty room section sectionCode program yearLevel semester shift day startTime endTime timeSlots isPublished status createdAt')
      .lean(),

    // Sections with enrollment data
    Section.find(only)
      .select('sectionCode program yearLevel semester shift maxStudents currentStudents')
      .lean(),

    // Students: HEADCOUNTS ONLY.
    //
    // This used to load every student's name, email, student number and GPA
    // and hand all of it to Google on every staff message. Building a
    // timetable needs to know how many people are in a section, never who
    // they are, so nothing that identifies a student is read here at all -
    // the personal fields are not selected, and `user` is not populated.
    // See the RA 10173 note on `studentCounts` below.
    Student.find(only)
      .select('program yearLevel sectionCode studentType enrollmentStatus -_id')
      .lean(),

    // ClassSpace: seat counts, not rosters. `enrolledStudents` holds student
    // ids and is deliberately excluded.
    ClassSpace.find(only)
      .select('sectionCode isActive')
      .lean(),

    // Users: role counts only. Names and email addresses are never needed to
    // schedule a class, so they are not read.
    User.find(program ? { program } : {})
      .select('role program isActive -_id')
      .lean(),

    // Programs (the authoritative list of program codes/names)
    Program.find({ isActive: true })
      .select('code name description department duration')
      .sort({ code: 1 })
      .lean()
  ]);

  // Build rich context with statistics
  // `Schedule.room` is a String holding a Room id, so it cannot be populated
  // (see utils/roomLabel.js). Resolve the readable labels in one batched
  // query, the same way every other screen does, so the assistant can say
  // "COTE-26" instead of a 24-character hex id.
  await require('../utils/roomLabel').attachScheduleRoomLabels(schedules);

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

  /**
   * Student headcounts, and nothing else.
   *
   * RA 10173 (Data Privacy Act of 2012). The assistant is a timetabling aid
   * for chairpersons: it needs to know how many students a section has, never
   * which students. Everything below is a count. No name, email address,
   * student number, GPA or enrolment record is produced here, so none of it
   * can reach the external model however the prompt is later assembled.
   *
   * `tests/defects.test.js` (D-12) asserts this.
   */
  const bump = (bucket, key) => {
    const k = key === undefined || key === null || key === '' ? 'unassigned' : String(key);
    bucket[k] = (bucket[k] || 0) + 1;
  };

  const studentStats = {
    total: students.length,
    byProgram: {},
    byYearLevel: {},
    bySection: {},
    byType: {},
    byStatus: {}
  };

  students.forEach(s => {
    bump(studentStats.byProgram, s.program);
    bump(studentStats.byYearLevel, s.yearLevel);
    bump(studentStats.bySection, s.sectionCode);
    bump(studentStats.byType, s.studentType);
    bump(studentStats.byStatus, s.enrollmentStatus);
  });

  const userStats = { total: users.length, byRole: {} };
  users.forEach(u => bump(userStats.byRole, u.role));

  const context = {
    subjects: subjects || [],
    faculty: facultyStats || [],
    rooms: roomStats || [],
    schedules: schedules || [],
    sections: sections || [],
    // Deliberately NOT a student roster - see studentStats above.
    studentCounts: studentStats,
    classSpaces: classSpaces || [],
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
      studentStats,
      userStats
    }
  };

  console.log(`RAG Context loaded: ${programs.length} programs, ${subjects.length} subjects, ${faculty.length} faculty, ${rooms.length} rooms, ${schedules.length} schedules, ${sections.length} sections, ${students.length} student headcounts (no personal data), ${classSpaces.length} classSpaces, ${users.length} user role counts`);

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
      subject = await Subject.findOne({ subjectName: new RegExp(`^${escapeRegex(subjectName)}$`, 'i') });
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

    // Teachers from OTHER departments who have taught this subject (matched by
    // code or name), plus any already approved for it. The scheduling manager
    // can borrow them for this subject only.
    const approved = new Set((subject.guestFaculty || []).map(g => String(g.faculty)));
    const inProgramIds = candidates.map(c => c._id);
    let otherDepartments = [];
    if (subject.program && subject.program !== 'General') {
      const outsiders = await Faculty.find({ isActive: true, _id: { $nin: inProgramIds } })
        .populate('user', 'firstName lastName email')
        .lean();
      // Show capable teachers from other programs so the officer can choose
      // freely, ranked by fit — not only those who already taught it. Approved
      // borrows are always included (the picker renders them from here).
      const rankedOut = rankFacultyForSubject(outsiders, subject, { onlyWithCapacity: false });
      otherDepartments = [
        ...rankedOut.filter(r => approved.has(String(r.faculty._id))),
        ...rankedOut.filter(r => !approved.has(String(r.faculty._id))).slice(0, 20),
      ];
    }
    // Real teaching load for the borrowable outsiders, for the workload capsule.
    const outLoads = otherDepartments.length
      ? await getFacultyLoads({ facultyIds: otherDepartments.map((r) => r.faculty._id) })
      : new Map();
    const toRow = (r, idx) => ({
      rank: idx + 1,
      facultyId: r.faculty._id,
      employeeId: r.faculty.employeeId,
      name: `${r.faculty.user?.firstName || ''} ${r.faculty.user?.lastName || ''}`.trim(),
      department: (r.faculty.programs || [])[0] || r.faculty.department || '',
      approved: approved.has(String(r.faculty._id)),
      score: r.score,
      reason: r.reason,
      hasCapacity: r.hasCapacity,
      teachingHours: (outLoads.get(String(r.faculty._id)) || EMPTY_LOAD).hours,
      maxHours: r.faculty.maxTeachingHours || 36,
      availableLoad: r.availableLoad,
      timesTaught: r.experience.timesTaught,
      lastTaughtAcademicYear: r.experience.lastTaughtAcademicYear,
      experienceIsDated: r.experience.isStale,
    });

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
      // Borrowable for this subject only (see Subject.guestFaculty)
      otherDepartments: otherDepartments.map(toRow),
      guestFacultyIds: [...approved],
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

    let context = {};
    let history = conversationHistory;
    let aiOptions = {};

    if (!isStaff(req.user)) {
      // Help-desk mode: no records are loaded at all
      const help = prepareHelpMode(req, message, conversationHistory);
      if (help.reply) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: help.reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', metadata: { guarded: !!help.guarded, limited: !!help.limited } })}\n\n`);
        return res.end();
      }
      history = help.history;
      aiOptions = help.options;
    } else if (includeContext) {
      // Build comprehensive context from database with RAG
      try {
        context = await loadRAGContext(req.user.role === 'program_manager' ? req.user.program || '__none__' : null);
      } catch (contextError) {
        console.error('Error loading RAG context:', contextError);
      }
    }

    // Stream AI response
    const result = await geminiService.generateChatResponseStream(
      message,
      context,
      history,
      (chunk) => {
        // Send each chunk as SSE with immediate flush
        const sseData = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
        res.write(sseData);

        // Force flush if available (for Node.js streams)
        if (typeof res.flush === 'function') {
          res.flush();
        }
      },
      aiOptions
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

    let context = {};
    let history = conversationHistory;
    let aiOptions = {};

    if (!isStaff(req.user)) {
      const help = prepareHelpMode(req, message, conversationHistory);
      if (help.reply) {
        return res.status(help.limited ? 429 : 200).json({ success: !help.limited, message: help.reply, metadata: { guarded: !!help.guarded } });
      }
      history = help.history;
      aiOptions = help.options;
    } else if (includeContext) {
      // Build comprehensive context from database with RAG
      try {
        context = await loadRAGContext(req.user.role === 'program_manager' ? req.user.program || '__none__' : null);
      } catch (contextError) {
        console.error('Error loading RAG context:', contextError);
      }
    }

    // Generate AI response with fallback support
    const result = await geminiService.generateChatResponse(
      message,
      context,
      history,
      aiOptions
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        metadata: {
          keyUsed: result.keyUsed,
          totalKeys: result.totalKeys,
          contextLoaded: isStaff(req.user) && includeContext,
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
