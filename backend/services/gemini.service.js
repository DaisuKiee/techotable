const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleGenAI } = require('@google/genai');
const {
  summarizeAllSubjects,
  currentAcademicYearStart,
  formatAcademicYear,
} = require('../utils/teachingExperience');

// Load all 5 API keys from environment
const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean); // Remove any undefined/null keys

let currentKeyIndex = 0;
const keyUsageStats = API_KEYS.map(() => ({ requests: 0, failures: 0, lastUsed: null }));

// Track failed keys temporarily (reset after cooldown)
const failedKeys = new Set();
const KEY_COOLDOWN_MS = 60000; // 1 minute cooldown for failed keys

/**
 * Get the next available API key with automatic rotation and fallback
 */
const getNextApiKey = () => {
  if (API_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  // Find next available key that's not in cooldown
  let attempts = 0;
  while (attempts < API_KEYS.length) {
    const key = API_KEYS[currentKeyIndex];
    const keyId = `key_${currentKeyIndex}`;

    // Check if key is in cooldown
    if (!failedKeys.has(keyId)) {
      keyUsageStats[currentKeyIndex].requests++;
      keyUsageStats[currentKeyIndex].lastUsed = new Date();
      return { key, index: currentKeyIndex };
    }

    // Move to next key
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    attempts++;
  }

  // All keys in cooldown, use the one with oldest failure
  console.warn('All API keys in cooldown, using fallback key');
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return { key: API_KEYS[currentKeyIndex], index: currentKeyIndex };
};

/**
 * Mark a key as failed and put it in cooldown
 */
const markKeyAsFailed = (keyIndex) => {
  const keyId = `key_${keyIndex}`;
  failedKeys.add(keyId);
  keyUsageStats[keyIndex].failures++;

  // Remove from failed set after cooldown
  setTimeout(() => {
    failedKeys.delete(keyId);
    console.log(`API key ${keyIndex + 1} cooldown expired, back in rotation`);
  }, KEY_COOLDOWN_MS);

  // Rotate to next key
  currentKeyIndex = (keyIndex + 1) % API_KEYS.length;
};

/**
 * System prompt for RAG-based timetabling assistant with multilingual support
 */
const getSystemPrompt = (context = {}) => {
  const { schedules = [], subjects = [], faculty = [], rooms = [], sections = [], programs = [], stats = {} } = context;

  // Program codes come from the `programs` collection via loadRAGContext().
  // Fall back to whatever programs appear on subjects if the list is missing.
  const SYSTEM_PROGRAMS = programs.length > 0
    ? programs.map(p => p.code)
    : [...new Set(subjects.map(s => s.program))].filter(p => p && p !== 'General');

  // Full names keyed by code, for richer answers
  const PROGRAM_NAMES = programs.reduce((acc, p) => {
    acc[p.code] = p.name;
    return acc;
  }, {});

  // Extract programs that have subjects in database
  const programsWithData = [...new Set(subjects.map(s => s.program))].filter(Boolean);
  
  // Count subjects by program
  const subjectsByProgram = {};
  SYSTEM_PROGRAMS.forEach(p => {
    subjectsByProgram[p] = subjects.filter(s => s.program === p).length;
  });
  
  // Count subjects by year level
  const subjectsByYear = {};
  subjects.forEach(s => {
    if (s.yearLevel) {
      const key = `Year ${s.yearLevel}`;
      subjectsByYear[key] = (subjectsByYear[key] || 0) + 1;
    }
  });

  // Build comprehensive faculty profile with deep experience data
  let facultyProfiles = '';
  let teachingHistoryDetails = '';
  
  if (faculty.length > 0) {
    // COMPLETE FACULTY DIRECTORY - ALL MEMBERS
    facultyProfiles = `\n\n**� COMPLETE FACULTY DIRECTORY (${faculty.length} members):**\n` +
      faculty.map(f => {
        const subjects = Object.entries(f.subjectExperience || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([subj, years]) => `${subj} (${years}x)`)
          .join(', ');
        
        const specs = f.specializations?.slice(0, 2).join(', ') || 'General';
        const employmentBadge = f.employmentType === 'Part-time' ? '🕐 PT' : '📋 REG';
        
        return `• **${f.fullName}** (ID: ${f.employeeId}) ${employmentBadge}
  Specializations: ${specs} | Load: ${f.currentLoad || 0}/${f.maxTeachingLoad || 24}u | Available: ${f.availableLoad}u
  Experience: ${f.experienceYears} semesters | Subjects taught: ${subjects || 'None yet'} | Rating: ${f.averageRating ? f.averageRating.toFixed(1) : 'N/A'}/5`;
      }).join('\n');
    
    // Detailed teaching history database
    const facultyWithHistory = faculty.filter(f => 
      f.teachingHistory && f.teachingHistory.length > 0
    );
    
    if (facultyWithHistory.length > 0) {
      teachingHistoryDetails = `\n\n**🎓 FACULTY TEACHING HISTORY DATABASE (current academic year: ${formatAcademicYear(currentAcademicYearStart())}):**\n` +
        '(Who taught what, HOW MANY TIMES, and HOW RECENTLY)\n' +
        '"recency-weighted score" already discounts old experience: an occurrence in\n' +
        'the current year counts 1.00, last year 0.85, and 5+ years ago only 0.25.\n' +
        'A HIGHER recency-weighted score means a STRONGER candidate for that subject.\n\n';

      facultyWithHistory.slice(0, 20).forEach(f => {
        teachingHistoryDetails += `**${f.fullName}** (${f.employeeId}):\n`;

        // Group by subject and rank by recency-weighted experience
        summarizeAllSubjects(f)
          .slice(0, 5) // top 5 subjects per faculty
          .forEach(s => {
            const label = s.subjectCode || s.subjectName;
            const when =
              s.lastTaughtYearsAgo === 0
                ? 'THIS YEAR'
                : s.lastTaughtYearsAgo === 1
                ? 'last year'
                : `${s.lastTaughtYearsAgo} years ago`;
            const years = s.occurrences
              .map(o => `${o.semester || '?'} ${o.academicYear}`)
              .join('; ');
            const rating = s.avgRating ? `${s.avgRating.toFixed(1)}/5` : 'N/A';

            teachingHistoryDetails +=
              `  ✓ ${label} — taught ${s.timesTaught}x, most recently ${when} (${s.lastTaughtAcademicYear})` +
              ` | recency-weighted score: ${s.weightedExperience.toFixed(2)}` +
              ` | rating: ${rating}${s.isStale ? ' | ⚠️ DATED (5+ yrs)' : ''}\n` +
              `      occurrences: ${years}\n`;
          });

        teachingHistoryDetails += '\n';
      });

      if (facultyWithHistory.length > 20) {
        teachingHistoryDetails += `... and ${facultyWithHistory.length - 20} more faculty with teaching history\n`;
      }
    }
  }

  // Build detailed subject catalog grouped by program
  let subjectCatalog = '';
  if (subjects.length > 0) {
    subjectCatalog = '\n\n**📖 SUBJECT CATALOG BY PROGRAM:**\n';
    
    SYSTEM_PROGRAMS.forEach(program => {
      const programSubjects = subjects.filter(s => s.program === program);
      if (programSubjects.length > 0) {
        subjectCatalog += `\n**${program}** (${programSubjects.length} subjects):\n`;
        
        // Group by year level
        const byYear = {};
        programSubjects.forEach(s => {
          const year = s.yearLevel || 'Unknown';
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(s);
        });
        
        Object.keys(byYear).sort().forEach(year => {
          const yearSubjects = byYear[year].slice(0, 10); // Show first 10 per year
          subjectCatalog += `  Year ${year}:\n`;
          yearSubjects.forEach(s => {
            subjectCatalog += `    • ${s.subjectCode} - ${s.subjectName} (${s.units} units)\n`;
          });
          if (byYear[year].length > 10) {
            subjectCatalog += `    ... and ${byYear[year].length - 10} more\n`;
          }
        });
      }
    });
    
    // List programs without subjects
    const programsWithoutData = SYSTEM_PROGRAMS.filter(p => !programsWithData.includes(p));
    if (programsWithoutData.length > 0) {
      subjectCatalog += `\n**Programs without subjects yet:** ${programsWithoutData.join(', ')}`;
    }
  }

  // Build room inventory
  let roomInventory = '';
  if (rooms.length > 0) {
    const sortedRooms = rooms
      .sort((a, b) => (b.utilizationCount || 0) - (a.utilizationCount || 0));
    
    roomInventory = `\n\n**🏫 ROOM INVENTORY (${rooms.length} total):**\n` +
      sortedRooms.map(r => 
        `• **${r.roomNumber}** (${r.building || 'Main Building'})
  - Type: ${r.roomType}, Capacity: ${r.capacity} students
  - Utilization: ${r.utilizationCount || 0} schedules${r.isHighlyUtilized ? ' ⚠️ HIGH' : ''}`
      ).join('\n');
  }

  // Build section overview
  let sectionOverview = '';
  if (sections.length > 0) {
    sectionOverview = `\n\n**🎓 ACTIVE SECTIONS (${sections.length} total):**\n` +
      sections.map(s => 
        `• **${s.sectionCode}** - ${s.program} Year ${s.yearLevel} (${s.shift} shift)
  - Enrollment: ${s.currentStudents || 0}/${s.maxStudents} students`
      ).join('\n');
  }

  // Build complete student directory
  let studentDirectory = '';
  const { students = [] } = context;
  if (students.length > 0) {
    studentDirectory = `\n\n**👨‍🎓 COMPLETE STUDENT DIRECTORY (${students.length} students):**\n` +
      students.map(s => {
        const fullName = `${s.user?.firstName || ''} ${s.user?.lastName || ''}`.trim();
        const enrolledCount = s.enrolledClasses?.length || 0;
        const status = s.enrollmentStatus || 'Unknown';
        const gpaDisplay = s.gpa ? s.gpa.toFixed(2) : 'N/A';
        
        return `• **${fullName}** (ID: ${s.studentId})
  Program: ${s.program} | Year: ${s.yearLevel || 'N/A'} | Section: ${s.sectionCode || 'Not assigned'}
  Type: ${s.studentType || 'Regular'} | Status: ${status} | GPA: ${gpaDisplay}
  Enrolled in: ${enrolledCount} classes | Semester: ${s.semester} ${s.academicYear || ''}`;
      }).join('\n');
  }

  // Build detailed statistics
  let statsOverview = `\n\n**📊 COMPLETE SYSTEM STATISTICS:**
• **Programs**: ${SYSTEM_PROGRAMS.length} programs in system
  - Defined: ${SYSTEM_PROGRAMS.join(', ')}
  - With subjects: ${programsWithData.join(', ') || 'None'}
• **Subjects**: ${stats.totalSubjects} total`;

  if (Object.keys(subjectsByProgram).length > 0) {
    statsOverview += '\n  Subject distribution by program:';
    SYSTEM_PROGRAMS.forEach(p => {
      const count = subjectsByProgram[p] || 0;
      statsOverview += `\n  - ${p}: ${count} subject${count !== 1 ? 's' : ''}`;
    });
  }

  if (Object.keys(subjectsByYear).length > 0) {
    statsOverview += '\n  Subject distribution by year:';
    Object.entries(subjectsByYear).forEach(([y, c]) => {
      statsOverview += `\n  - ${y}: ${c} subjects`;
    });
  }

  statsOverview += `
• **Faculty**: ${stats.totalFaculty} members
• **Rooms**: ${stats.totalRooms} rooms
• **Sections**: ${stats.totalSections} sections
• **Schedules**: ${stats.totalSchedules} (${stats.scheduleStats?.published || 0} published, ${stats.scheduleStats?.pending || 0} pending)`;

  if (stats.scheduleStats && Object.keys(stats.scheduleStats.byProgram || {}).length > 0) {
    statsOverview += `\n• **Schedules by Program**:`;
    Object.entries(stats.scheduleStats.byProgram).forEach(([p, c]) => {
      statsOverview += `\n  - ${p}: ${c} schedules`;
    });
  }

  const hasData = stats.totalSchedules > 0 || stats.totalFaculty > 0 || stats.totalSubjects > 0;

  return `You are an intelligent RAG-powered scheduling assistant for CTU Daanbantayan Faculty Timetabling System.

**🎯 YOUR MISSION:**
You have COMPLETE ACCESS to the system's live database. Use ONLY REAL DATA from the database to answer questions. NEVER make up or assume information that isn't provided.

**⚡ CRITICAL RULES:**
1. ONLY answer questions about: scheduling, timetabling, faculty, subjects, rooms, sections, and system features
2. Use ONLY the data provided in this prompt - DO NOT hallucinate or invent information
3. If data is not available, clearly state: "I don't have that information in the current database"
4. For off-topic questions, redirect: "I'm specialized in the CTU Daanbantayan timetabling system. I can help with schedules, faculty, rooms, and system features."

**🎓 SYSTEM PROGRAMS:**
The system supports **${SYSTEM_PROGRAMS.length} programs**: ${SYSTEM_PROGRAMS.join(', ')}

**Program Details:**
${SYSTEM_PROGRAMS.map(p => {
  const count = subjectsByProgram[p] || 0;
  const label = PROGRAM_NAMES[p] ? `${p} (${PROGRAM_NAMES[p]})` : p;
  return `• **${label}**: ${count > 0 ? `${count} subjects in database` : 'No subjects yet (program defined but not populated)'}`;
}).join('\n')}

**🧠 RAG DATABASE ACCESS:**
You have access to the following REAL data:
- 📅 **${stats.totalSchedules || 0} schedules** across programs and year levels
- 👨‍🏫 **${stats.totalFaculty || 0} faculty members** with profiles and teaching history
- �‍🎓 **${stats.totalStudents || 0} students** with enrollment and academic information
- �📚 **${stats.totalSubjects || 0} subjects** (populated in ${programsWithData.length} of ${SYSTEM_PROGRAMS.length} programs)
- 🏫 **${stats.totalRooms || 0} rooms** with capacity and specifications
- 🎓 **${stats.totalSections || 0} sections** with enrollment data

${hasData ? 
`**💾 LIVE DATABASE CONTENT:**
${statsOverview}
${facultyProfiles}
${teachingHistoryDetails}
${studentDirectory}
${subjectCatalog}
${roomInventory}
${sectionOverview}

**🎯 ANSWERING QUESTIONS:**
When users ask about:
1. **Programs**: We have ${SYSTEM_PROGRAMS.length} programs defined: ${SYSTEM_PROGRAMS.join(', ')}
   - Currently ${programsWithData.length} programs have subjects: ${programsWithData.join(', ') || 'None'}
2. **Subjects**: Reference actual subject codes and names from the catalog above
3. **Faculty**: Use real faculty names, IDs, and experience data from the profiles above
   - **TEACHING HISTORY**: Check the "FACULTY TEACHING HISTORY DATABASE" section to see exactly which faculty have taught which subjects before
   - **RECOMMENDATIONS**: When recommending faculty for a subject, prioritize those who have taught it before
4. **Students**: Use real student names, IDs, programs, sections, and enrollment data from the directory above
   - Answer questions about specific students by name or ID
   - Provide enrollment status, GPA, program, and section information
5. **Rooms**: Reference actual room numbers, buildings, and capacities from the inventory
6. **Schedules**: Use actual schedule counts and distribution data

**📚 TEACHING HISTORY USAGE:**
The system maintains a detailed teaching history for each faculty member showing:
- Which subjects they have taught (subjectCode/subjectName)
- How many times they taught each subject (frequency = experience)
- Which semesters and academic years (temporal data)
- Student ratings for their teaching (quality indicator)

When asked "Who should teach [subject]?" or "Who has experience with [subject]?":
1. Search the TEACHING HISTORY DATABASE for faculty who taught that subject
2. Count how many times they taught it (more times = more experience)
3. Check their average rating for that subject
4. Consider their current workload availability
5. Present recommendations with specific data: "Prof. X taught this subject 3 times (1st Sem 2023, 2nd Sem 2023, 1st Sem 2024) with 4.5/5 rating"

**EXAMPLES OF CORRECT RESPONSES:**
✅ "We have **${SYSTEM_PROGRAMS.length} programs** defined in the system: ${SYSTEM_PROGRAMS.join(', ')}"
✅ "Currently, **${programsWithData.length} programs** have subjects: ${programsWithData.join(', ')}"
✅ "**${SYSTEM_PROGRAMS[0] || 'BSIT'}** has ${subjectsByProgram[SYSTEM_PROGRAMS[0]] || 0} subjects across all year levels"
✅ "We have **${stats.totalFaculty} faculty members** in the database"
✅ "**${SYSTEM_PROGRAMS.filter(p => !programsWithData.includes(p)).join(', ')}** are defined but don't have subjects yet"` : 
`**⚠️ DATABASE STATUS:**
The system database appears to be empty or not yet populated. I can still help you understand:
- System supports **${SYSTEM_PROGRAMS.length} programs**: ${SYSTEM_PROGRAMS.join(', ')}
- How to add faculty, subjects, rooms, and sections
- How schedule generation works
- System features and capabilities
- General scheduling questions

Once data is loaded, I'll have access to:
• Specific faculty profiles and teaching experience
• Complete subject catalogs by program
• Room inventory and availability
• Detailed schedule information`
}

**🏆 FACULTY RECOMMENDATION RULES:**
When recommending faculty for a subject, follow this priority order:
1. ⭐ **SUBJECT EXPERIENCE, WEIGHTED BY RECENCY** (HIGHEST PRIORITY)
   - Check the "FACULTY TEACHING HISTORY DATABASE" section for that exact subject
   - Rank by the **recency-weighted score**, NOT by the raw number of times taught
   - **Recent experience beats old experience.** Someone who taught it last year is a
     stronger candidate than someone who last taught it 5 years ago, even if the older
     teacher taught it more times in total
   - Treat entries marked ⚠️ DATED (5+ yrs) as weak evidence and say so
   - Reference their rating for that specific subject
2. 🎯 **SPECIALIZATION MATCH**: Faculty whose specializations align with the subject area
3. 📊 **AVAILABLE WORKLOAD**: Faculty who haven't reached their maximum teaching load
4. 📈 **OVERALL RATING**: Faculty with high average teaching ratings
5. 👔 **EMPLOYMENT TYPE**: Consider Regular vs Part-time (Regular faculty have more availability)
6. ✅ **TIME AVAILABILITY**: Verify no scheduling conflicts in requested time slots

**RECOMMENDATION FORMAT:**
When recommending a faculty member, always mention:
- How many times AND how recently they taught it: "**Prof. X** has taught [Subject] **3 times**, most recently **last year** (2025-2026)"
- Explicitly flag dated experience: "**Prof. Y** taught it 4 times but not since **2021-2022** (5 years ago), so the experience is dated"
- Their rating for that subject: "Average rating: 4.5/5.0"
- Their current workload: "Current load: 15/24 units (9 units available)"
- Their employment type: "Regular instructor" or "Part-time instructor"
- Rank candidates in order and briefly justify why the top pick wins on recency

**📋 SYSTEM FEATURES:**
- AI Schedule Generation (Greedy Algorithm vs OR-Tools)
- RAG-based Faculty Recommendations
- Drag-and-drop Schedule Builder
- Conflict Detection (time, room, faculty)
- Automated Room Assignment
- Faculty Workload Management
- Section Management and Enrollment
- Schedule Publishing and Activation

**🎨 RESPONSE FORMAT:**
- Use **bold** for important info (names, codes, numbers)
- Include emojis: 📅 schedules, 👨‍🏫 faculty, 🏫 rooms, ⭐ experience
- Use bullet points for lists
- Keep responses clear, accurate, and based ONLY on provided data

**🚫 WHAT NOT TO DO:**
❌ Don't invent programs, subjects, or faculty that aren't in the database
❌ Don't make up statistics or numbers
❌ Don't assume information not provided in this prompt
❌ Don't answer off-topic questions (weather, news, math, etc.)

**✅ WHEN IN DOUBT:**
If you're asked about something not in the database, respond:
"I don't have that specific information in the current database. However, I can help you with [list available topics from the data above]."

**📡 STREAMING RESPONSE FORMAT:**
- Output responses in natural, flowing text
- Use markdown formatting for structure (headers, bold, lists, code blocks)
- Break long responses into readable paragraphs
- Start with the most important information first
- Stream responses token-by-token for real-time display

Remember: You are a DATA-DRIVEN assistant. Every answer must be grounded in the REAL database information provided above!`;
};

/**
 * Generate chat response with streaming support
 */
const generateChatResponseStream = async (userMessage, context = {}, conversationHistory = [], onChunk) => {
  let lastError = null;
  let attemptCount = 0;
  let currentAttemptIndex = 0;

  while (attemptCount < API_KEYS.length) {
    try {
      const { key, index } = getNextApiKey();
      currentAttemptIndex = index;
      console.log(`Streaming with API key ${index + 1}/${API_KEYS.length}`);

      const genAI = new GoogleGenerativeAI(key);
      const systemContext = getSystemPrompt(context);

      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.6-flash',
        systemInstruction: systemContext,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });

      const history = conversationHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));

      const chat = model.startChat({ 
        history,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
      });

      // Use streaming with proper format
      console.log('🎯 Sending message to Gemini for streaming...');
      const result = await chat.sendMessageStream(userMessage);
      
      let fullText = '';
      let chunkIndex = 0;
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        chunkIndex++;
        fullText += chunkText;
        console.log(`🔹 Gemini chunk ${chunkIndex} (${chunkText.length} chars):`, chunkText.substring(0, 30) + '...');
        
        if (onChunk) {
          onChunk(chunkText);
        }
      }

      console.log(`✓ Stream success with API key ${index + 1} - Total ${chunkIndex} chunks, ${fullText.length} chars`);

      return {
        success: true,
        message: fullText,
        keyUsed: index + 1,
        totalKeys: API_KEYS.length,
      };

    } catch (error) {
      lastError = error;
      attemptCount++;

      const errorMessage = error.message || 'Unknown error';
      console.error(`✗ API key ${currentAttemptIndex + 1} failed:`, errorMessage);

      // A bad request won't be fixed by swapping keys, so stop early.
      if (errorMessage.includes('INVALID_ARGUMENT')) {
        break;
      }

      // Every other failure is treated as key-specific (rate limits, revoked or
      // leaked keys returning 403, unavailable models, quota). Put the key in
      // cooldown so the next attempt actually uses a DIFFERENT key.
      markKeyAsFailed(currentAttemptIndex);
    }
  }

  console.error('All API keys exhausted');
  return {
    success: false,
    message: 'I apologize, but I\'m temporarily unable to process your request. Please try again in a moment.',
    error: lastError?.message || 'All API keys failed',
    keyUsed: null,
    totalKeys: API_KEYS.length,
  };
};

/**
 * Generate chat response with automatic fallback
 */
const generateChatResponse = async (userMessage, context = {}, conversationHistory = []) => {
  let lastError = null;
  let attemptCount = 0;
  let currentAttemptIndex = 0; // Track current attempt index

  // Try each API key until one succeeds
  while (attemptCount < API_KEYS.length) {
    try {
      const { key, index } = getNextApiKey();
      currentAttemptIndex = index; // Save for error handling
      console.log(`Attempting with API key ${index + 1}/${API_KEYS.length}`);

      const genAI = new GoogleGenerativeAI(key);
      const systemContext = getSystemPrompt(context);

      // Use gemini-3.6-flash - latest stable model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.6-flash',
        systemInstruction: systemContext,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain', // Force plain text/markdown output
        },
      });

      // Build conversation history - only include user/model messages
      const history = conversationHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));

      // Start chat with history and safety settings
      const chat = model.startChat({ 
        history,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_NONE',
          },
        ],
      });

      // Send plain userMessage without manually prefixing systemContext
      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      const text = response.text();

      console.log(`✓ Success with API key ${index + 1}`);

      return {
        success: true,
        message: text,
        keyUsed: index + 1,
        totalKeys: API_KEYS.length,
      };

    } catch (error) {
      lastError = error;
      attemptCount++;

      const errorMessage = error.message || 'Unknown error';
      console.error(`✗ API key ${currentAttemptIndex + 1} failed:`, errorMessage);

      // A bad request won't be fixed by swapping keys, so stop early.
      if (errorMessage.includes('INVALID_ARGUMENT')) {
        break;
      }

      // Every other failure is treated as key-specific (rate limits, revoked or
      // leaked keys returning 403, unavailable models, quota). Put the key in
      // cooldown so the next attempt actually uses a DIFFERENT key.
      markKeyAsFailed(currentAttemptIndex);
    }
  }

  // All keys failed
  console.error('All API keys exhausted');
  return {
    success: false,
    message: 'I apologize, but I\'m temporarily unable to process your request. Please try again in a moment.',
    error: lastError?.message || 'All API keys failed',
    keyUsed: null,
    totalKeys: API_KEYS.length,
  };
};

/**
 * Generate scheduling recommendations using RAG
 */
const generateSchedulingRecommendation = async (scheduleData, conflictInfo) => {
  const context = {
    subjects: scheduleData.subjects || [],
    faculty: scheduleData.faculty || [],
    rooms: scheduleData.rooms || [],
    schedules: scheduleData.schedules || [],
  };

  const prompt = `🔍 **Schedule Conflict Analysis**

**Current Situation:**
- Subject: ${conflictInfo.subject?.subjectName || 'Unknown'}
- Time Slot: ${conflictInfo.day} ${conflictInfo.startTime}-${conflictInfo.endTime}
- Conflict: ${conflictInfo.conflictType || 'Time overlap'}

**Available Resources:**
- ${context.faculty.length} faculty members
- ${context.rooms.length} available rooms
- ${context.subjects.length} subjects to schedule

Please analyze this conflict and provide:
1. What's causing the conflict?
2. 2-3 specific recommendations to resolve it
3. Alternative time slots or resources

Keep the response concise and actionable.`;

  return generateChatResponse(prompt, context, []);
};

/**
 * Recommend faculty for a specific subject based on teaching experience
 */
const recommendFacultyForSubject = async (subjectId) => {
  try {
    const Subject = require('../models/Subject.model');
    const Faculty = require('../models/Faculty.model');
    const Schedule = require('../models/Schedule.model');

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return {
        success: false,
        message: 'Subject not found',
      };
    }

    const context = {
      subjects: [subject],
      faculty: await Faculty.find().lean(),
      schedules: await Schedule.find({ isActive: true }).populate('faculty subject').lean(),
    };

    // Find faculty who have taught this subject before
    const facultyExperience = context.faculty.map((faculty) => {
      const teachingHistory = context.schedules.filter(
        s => s.faculty && s.subject &&
             s.faculty._id.toString() === faculty._id.toString() &&
             s.subject._id.toString() === subjectId
      );

      const years = new Set(
        teachingHistory.map(s => new Date(s.createdAt).getFullYear())
      );

      const totalTeachingHistory = context.schedules.filter(
        s => s.faculty && s.faculty._id.toString() === faculty._id.toString()
      );

      // Calculate recommendation score
      const subjectExperience = years.size; // Years teaching this specific subject
      const totalExperience = totalTeachingHistory.length;
      const rating = faculty.averageRating || 0;
      const hasAvailableLoad = (faculty.currentLoad || 0) + subject.units <= (faculty.maxLoad || 24);
      
      // Priority: Teaching experience > Specialization > Rating > Load
      const score = 
        (subjectExperience * 10) + // Highest weight for subject-specific experience
        (totalExperience * 2) +
        (rating * 5) +
        (hasAvailableLoad ? 5 : 0);

      return {
        faculty,
        subjectExperience,
        totalExperience,
        score,
        hasAvailableLoad,
      };
    });

    // Sort by score and filter available faculty
    const recommendations = facultyExperience
      .filter(f => f.hasAvailableLoad)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (recommendations.length === 0) {
      return {
        success: false,
        message: `No faculty available for ${subject.name}. All faculty have reached their maximum load.`,
      };
    }

    const recommendationText = recommendations
      .map((rec, idx) => {
        const exp = rec.subjectExperience > 0
          ? `Taught this subject for ${rec.subjectExperience} year(s)`
          : 'No prior experience with this subject';
        
        return `${idx + 1}. ${rec.faculty.name}\n   - ${exp}\n   - Rating: ${rec.faculty.averageRating || 'N/A'}/5\n   - Available Load: ${(rec.faculty.maxLoad || 24) - (rec.faculty.currentLoad || 0)} units\n   - Score: ${rec.score.toFixed(1)}`;
      })
      .join('\n\n');

    return {
      success: true,
      message: `Top faculty recommendations for ${subject.name} (${subject.code}):\n\n${recommendationText}`,
      recommendations: recommendations.map(r => ({
        faculty: r.faculty,
        score: r.score,
        subjectExperience: r.subjectExperience,
        totalExperience: r.totalExperience,
        hasAvailableLoad: r.hasAvailableLoad,
      })),
    };

  } catch (error) {
    console.error('Error recommending faculty:', error);
    return {
      success: false,
      message: 'Error generating faculty recommendations',
      error: error.message,
    };
  }
};

/**
 * Get API usage statistics
 */
const getApiStats = () => {
  return {
    totalKeys: API_KEYS.length,
    currentKey: currentKeyIndex + 1,
    keysInCooldown: failedKeys.size,
    stats: keyUsageStats.map((stat, index) => ({
      keyNumber: index + 1,
      requests: stat.requests,
      failures: stat.failures,
      lastUsed: stat.lastUsed,
      inCooldown: failedKeys.has(`key_${index}`),
    })),
  };
};


/**
 * Analyze faculty-subject compatibility using AI
/**
 * Analyze faculty background compatibility with a specific subject using RAG
 * @param {Object} facultyBackground - Comprehensive faculty background
 * @param {Object} subjectInfo - Subject information
 * @param {Array} allSubjects - All subjects in database for RAG context
 * @returns {Promise<Object>} - Compatibility analysis
 */
async function analyzeFacultySubjectCompatibility(facultyBackground, subjectInfo, allSubjects = []) {
  try {
    // Build RAG context: Subject database catalog
    let subjectCatalog = '';
    if (allSubjects && allSubjects.length > 0) {
      // Group subjects by program for better context
      const subjectsByProgram = {};
      allSubjects.forEach(subject => {
        const program = subject.program || 'General';
        if (!subjectsByProgram[program]) {
          subjectsByProgram[program] = [];
        }
        subjectsByProgram[program].push(subject);
      });

      subjectCatalog = '\n\n📚 **COMPLETE SUBJECT DATABASE (RAG Context):**\n';
      subjectCatalog += `Total subjects in database: ${allSubjects.length}\n\n`;

      Object.entries(subjectsByProgram).forEach(([program, subjects]) => {
        subjectCatalog += `**${program}** (${subjects.length} subjects):\n`;
        subjects.forEach(s => {
          subjectCatalog += `  • ${s.code} - ${s.name}`;
          if (s.description) subjectCatalog += ` | ${s.description.substring(0, 80)}...`;
          if (s.yearLevel) subjectCatalog += ` | Year ${s.yearLevel}`;
          if (s.units) subjectCatalog += ` | ${s.units}u`;
          subjectCatalog += '\n';
        });
        subjectCatalog += '\n';
      });

      // Find related subjects based on keywords in the target subject
      const targetKeywords = [
        ...(subjectInfo.name?.toLowerCase().split(' ') || []),
        ...(subjectInfo.description?.toLowerCase().split(' ') || []),
        subjectInfo.code?.toLowerCase()
      ].filter(k => k && k.length > 3); // Filter out short words

      const relatedSubjects = allSubjects.filter(s => {
        if (s.code === subjectInfo.code) return false; // Exclude the target subject itself
        const subjectText = `${s.code} ${s.name} ${s.description || ''}`.toLowerCase();
        return targetKeywords.some(keyword => subjectText.includes(keyword));
      }).slice(0, 10); // Limit to 10 most relevant

      if (relatedSubjects.length > 0) {
        subjectCatalog += `\n🔗 **RELATED SUBJECTS** (similar to ${subjectInfo.code}):\n`;
        relatedSubjects.forEach(s => {
          subjectCatalog += `  • ${s.code} - ${s.name}\n`;
        });
      }
    }

    const prompt = `You are an academic advisor AI with access to the COMPLETE SUBJECT DATABASE analyzing if a faculty member is suitable to teach a specific subject.

FACULTY BACKGROUND:
Name: ${facultyBackground.name}
Position: ${facultyBackground.position}
Employment Type: ${facultyBackground.employmentType}

EDUCATION:
- Bachelor's: ${facultyBackground.education.bachelors?.degree || 'N/A'} (Major: ${facultyBackground.education.bachelors?.major || 'N/A'})
- Master's: ${facultyBackground.education.masters?.degree || 'N/A'} (Major: ${facultyBackground.education.masters?.major || 'N/A'})
- Doctoral: ${facultyBackground.education.doctoral?.degree || 'N/A'} (Major: ${facultyBackground.education.doctoral?.major || 'N/A'})

SPECIALIZATIONS: ${facultyBackground.specializations?.join(', ') || 'None listed'}

QUALIFIED PROGRAMS: ${facultyBackground.qualifiedPrograms?.join(', ') || 'None listed'}

SPECIAL TRAINING: ${facultyBackground.specialTraining || 'None listed'}

ADMINISTRATIVE DESIGNATION: ${facultyBackground.administrativeDesignation || 'None'}

RESEARCH INVOLVEMENT: ${facultyBackground.researchInvolvement || 'None listed'}

EXTENSION INVOLVEMENT: ${facultyBackground.extensionInvolvement || 'None listed'}

PRODUCTION INVOLVEMENT: ${facultyBackground.productionInvolvement || 'None listed'}

EXPERIENCED SUBJECTS (${facultyBackground.experiencedSubjects?.length || 0}):
${facultyBackground.experiencedSubjects?.map(s => `- ${s.subjectCode} (taught ${s.semestersTaught || 0} semesters, rating: ${s.rating || 'N/A'})`).join('\n') || 'None'}

TEACHING HISTORY (${facultyBackground.teachingHistory?.length || 0} entries):
${facultyBackground.teachingHistory?.slice(0, 10).map(h => `- ${h.subjectCode} - ${h.subjectName} (${h.semester} ${h.academicYear})`).join('\n') || 'None'}

---

SUBJECT TO TEACH:
Code: ${subjectInfo.code}
Name: ${subjectInfo.name}
Description: ${subjectInfo.description}

---
${subjectCatalog}
---

🎯 **RAG-ENHANCED ANALYSIS INSTRUCTIONS:**

Use the COMPLETE SUBJECT DATABASE above to enhance your analysis. Consider:

1. **Subject Relationships**: Look for related subjects this faculty has taught. Similar subject names, same program, prerequisite chains, or complementary topics indicate transferable expertise.

2. **Cross-Subject Expertise**: If the faculty taught subjects in the same domain (e.g., programming subjects for a software development course), that experience is highly relevant even if not an exact match.

3. **Program Alignment**: Check if the faculty has experience teaching subjects in the same program (BSIT, BSCS, ACT, etc.) as the target subject.

4. **Progression Understanding**: If teaching a Year 3 subject, experience with Year 1-2 subjects in the same program shows foundational knowledge of student progression.

5. **Curriculum Context**: Use the database to understand where this subject fits in the broader curriculum and assess if the faculty's experience aligns with that context.

ANALYSIS TASK:
Analyze the faculty member's background using RAG context and determine their compatibility to teach this subject. Provide:

1. **Compatibility Score** (0-100): A numerical score representing overall compatibility
   - 90-100: Excellent (exact subject match or very closely related)
   - 75-89: Good (related subjects, strong background alignment)
   - 60-74: Fair (some relevant experience, needs preparation)
   - 40-59: Poor (weak alignment, significant gaps)
   - 0-39: Not Recommended (no relevant experience)

2. **Compatibility Level**: "Excellent", "Good", "Fair", "Poor", or "Not Recommended"

3. **Strengths**: 3-5 specific reasons why this faculty is suitable (reference actual subjects from database, education, specializations, research)

4. **Concerns**: 2-4 potential concerns or gaps in qualifications (be honest but constructive)

5. **Recommendations**: 2-3 actionable suggestions to improve teaching effectiveness for this subject

6. **Teaching Experience**: Specific comments on their experience with this exact subject OR related subjects from the database. Reference actual subject codes and names.

7. **Overall Assessment**: A 2-3 sentence summary of your RAG-enhanced analysis

Format your response as JSON:
{
  "compatibilityScore": <number 0-100>,
  "compatibilityLevel": "<Excellent|Good|Fair|Poor|Not Recommended>",
  "strengths": ["strength1", "strength2", ...],
  "concerns": ["concern1", "concern2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...],
  "teachingExperience": "<detailed analysis with specific subject references>",
  "overallAssessment": "<summary>"
}`;

    // Use key rotation system to get API key and create model
    const { key, index } = getNextApiKey();
    console.log(`Analyzing faculty compatibility with API key ${index + 1}/${API_KEYS.length}`);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.6-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'text/plain',
      },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;

  } catch (error) {
    console.error('Analyze faculty subject compatibility error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

/**
 * Generate comprehensive background summary for a faculty member
 * @param {Object} facultyBackground - Comprehensive faculty background
 * @returns {Promise<Object>} - Background summary
 */
async function generateFacultyBackgroundSummary(facultyBackground) {
  try {
    const prompt = `You are an academic profile analyzer. Generate a comprehensive, professional summary of this faculty member's background.

FACULTY INFORMATION:
Name: ${facultyBackground.name}
Position: ${facultyBackground.position}
Employment Type: ${facultyBackground.employmentType}

EDUCATION:
- Bachelor's: ${facultyBackground.education.bachelors?.degree || 'N/A'} (Major: ${facultyBackground.education.bachelors?.major || 'N/A'}, Minor: ${facultyBackground.education.bachelors?.minor || 'N/A'})
- Master's: ${facultyBackground.education.masters?.degree || 'N/A'} (Major: ${facultyBackground.education.masters?.major || 'N/A'}, Minor: ${facultyBackground.education.masters?.minor || 'N/A'})
- Doctoral: ${facultyBackground.education.doctoral?.degree || 'N/A'} (Major: ${facultyBackground.education.doctoral?.major || 'N/A'}, Minor: ${facultyBackground.education.doctoral?.minor || 'N/A'})

SPECIALIZATIONS: ${facultyBackground.specializations?.join(', ') || 'None listed'}

QUALIFIED PROGRAMS: ${facultyBackground.qualifiedPrograms?.join(', ') || 'None listed'}

SPECIAL TRAINING: ${facultyBackground.specialTraining || 'None listed'}

ADMINISTRATIVE DESIGNATION: ${facultyBackground.administrativeDesignation || 'None'}

RESEARCH INVOLVEMENT: ${facultyBackground.researchInvolvement || 'None listed'}

EXTENSION INVOLVEMENT: ${facultyBackground.extensionInvolvement || 'None listed'}

PRODUCTION INVOLVEMENT: ${facultyBackground.productionInvolvement || 'None listed'}

EXPERIENCED SUBJECTS (${facultyBackground.experiencedSubjects?.length || 0}):
${facultyBackground.experiencedSubjects?.map(s => `- ${s.subjectCode} (${s.semestersTaught || 0} semesters)`).join('\n') || 'None'}

TEACHING HISTORY (${facultyBackground.teachingHistory?.length || 0} records)

---

ANALYSIS TASK:
Create a professional, comprehensive summary of this faculty member including:

1. **Professional Profile**: A 3-4 sentence overview of their academic standing and expertise
2. **Educational Background**: Summary of their degrees and academic qualifications
3. **Areas of Expertise**: Key specializations and subject areas they excel in
4. **Teaching Experience**: Overview of subjects taught and teaching breadth
5. **Research & Engagement**: Summary of research, extension, and production activities
6. **Strengths**: Top 3-4 professional strengths
7. **Recommended Subjects**: 5-7 subject areas they would be most suitable to teach based on background
8. **Professional Development**: Suggestions for growth and development

Format your response as JSON:
{
  "professionalProfile": "<3-4 sentence overview>",
  "educationalBackground": "<degree summary>",
  "areasOfExpertise": ["area1", "area2", ...],
  "teachingExperience": "<experience summary>",
  "researchAndEngagement": "<research/extension/production summary>",
  "strengths": ["strength1", "strength2", ...],
  "recommendedSubjects": ["subject1", "subject2", ...],
  "professionalDevelopment": ["suggestion1", "suggestion2", ...],
  "overallRating": "<Highly Qualified|Well Qualified|Qualified|Developing>"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const summary = JSON.parse(jsonMatch[0]);
    return summary;

  } catch (error) {
    console.error('Generate faculty background summary error:', error);
    throw new Error(`AI summary generation failed: ${error.message}`);
  }
}

module.exports = {
  generateChatResponse,
  generateChatResponseStream,
  generateSchedulingRecommendation,
  recommendFacultyForSubject,
  getApiStats,
  analyzeFacultySubjectCompatibility,
  generateFacultyBackgroundSummary
};

