/**
 * AI Recommendation Service
 * 
 * Integrates with Gemini API (primary) with Groq and OpenAI as fallbacks
 * Provides intelligent instructor recommendations based on:
 * - Qualifications and specializations
 * - Teaching history and ratings
 * - Current workload
 * - Subject requirements
 */

const axios = require('axios');
const Faculty = require('../models/Faculty.model');
const Subject = require('../models/Subject.model');
const { summarizeSubjectExperience } = require('../utils/teachingExperience');

// AI Provider configurations
const AI_PROVIDERS = {
  gemini: {
    name: 'Gemini',
    apiKey: process.env.GEMINI_API_KEY,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    active: !!process.env.GEMINI_API_KEY
  },
  groq: {
    name: 'Groq',
    apiKey: process.env.GROQ_API_KEY,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'mixtral-8x7b-32768',
    active: !!process.env.GROQ_API_KEY
  },
  openai: {
    name: 'OpenAI',
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    active: !!process.env.OPENAI_API_KEY
  }
};

/**
 * Recommend instructors for a subject
 * @param {Object} params - Recommendation parameters
 * @returns {Array} Ranked list of recommended faculty
 */
async function recommendInstructorForSubject(params) {
  const { subjectId, academicYear, semester, useAI = true } = params;

  try {
    // Get subject details
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      throw new Error('Subject not found');
    }

    // Get all available faculty
    const allFaculty = await Faculty.find({ isActive: true })
      .populate('user', 'firstName lastName email')
      .lean();

    // Filter faculty by basic criteria
    const eligibleFaculty = allFaculty.filter(f => {
      // Must have available teaching load
      const hasCapacity = f.currentLoad < f.maxTeachingLoad;
      
      // Must have required qualifications (if specified)
      const meetsQualifications = subject.requiredQualifications.length === 0 ||
        subject.requiredQualifications.some(req =>
          f.specializations.includes(req) ||
          f.qualifications.some(q => 
            q.field.toLowerCase().includes(req.toLowerCase())
          )
        );

      return hasCapacity && meetsQualifications;
    });

    if (eligibleFaculty.length === 0) {
      return {
        success: false,
        message: 'No eligible faculty found',
        recommendations: []
      };
    }

    // Calculate scores for each faculty
    const scoredFaculty = eligibleFaculty.map(faculty => {
      const score = calculateFacultyScore(faculty, subject);
      return {
        faculty,
        score,
        breakdown: score.breakdown
      };
    });

    // Sort by score (highest first)
    scoredFaculty.sort((a, b) => b.score.total - a.score.total);

    // If AI is enabled and API key available, enhance recommendations
    if (useAI && isAIAvailable()) {
      try {
        const aiEnhanced = await enhanceWithAI(scoredFaculty, subject);
        return {
          success: true,
          recommendations: aiEnhanced,
          usedAI: true,
          provider: getActiveProvider()
        };
      } catch (aiError) {
        console.warn('AI enhancement failed, using basic scoring:', aiError.message);
      }
    }

    // Return basic scored recommendations
    return {
      success: true,
      recommendations: scoredFaculty.map(item => ({
        facultyId: item.faculty._id,
        facultyName: `${item.faculty.user.firstName} ${item.faculty.user.lastName}`,
        employeeId: item.faculty.employeeId,
        score: item.score.total,
        scoreBreakdown: item.breakdown,
        currentLoad: item.faculty.currentLoad,
        maxLoad: item.faculty.maxTeachingLoad,
        availableLoad: item.faculty.maxTeachingLoad - item.faculty.currentLoad,
        specializations: item.faculty.specializations,
        qualifications: item.faculty.qualifications
      })),
      usedAI: false
    };

  } catch (error) {
    console.error('Instructor recommendation error:', error);
    throw error;
  }
}

/**
 * Calculate faculty score for a subject (rule-based)
 */
function calculateFacultyScore(faculty, subject) {
  let total = 0;
  const breakdown = {};

  // 1. Specialization Match (0-40 points)
  const specializationMatch = faculty.specializations.filter(spec =>
    subject.requiredQualifications.some(req =>
      spec.toLowerCase().includes(req.toLowerCase()) ||
      req.toLowerCase().includes(spec.toLowerCase())
    )
  ).length;
  
  const specializationScore = Math.min(specializationMatch * 20, 40);
  breakdown.specialization = specializationScore;
  total += specializationScore;

  // 2. Teaching History (0-30 points), weighted by RECENCY.
  // Teaching a subject last year counts far more than teaching it 5 years ago,
  // so we score the recency-weighted occurrence count rather than a raw count.
  const exp = summarizeSubjectExperience(faculty, subject);

  let historyScore = exp.weightedExperience * 10;
  if (exp.avgRating) {
    historyScore += exp.avgRating * 2; // Bonus for good ratings on this subject
  }
  historyScore = Math.min(historyScore, 30);
  breakdown.history = Math.round(historyScore * 10) / 10;
  breakdown.historyDetail = {
    timesTaught: exp.timesTaught,
    lastTaughtAcademicYear: exp.lastTaughtAcademicYear,
    lastTaughtYearsAgo: exp.lastTaughtYearsAgo,
    isStale: exp.isStale,
  };
  total += historyScore;

  // 3. Workload Balance (0-20 points)
  const workloadRatio = faculty.currentLoad / faculty.maxTeachingLoad;
  const workloadScore = (1 - workloadRatio) * 20; // Prefer less loaded faculty
  breakdown.workload = Math.round(workloadScore);
  total += workloadScore;

  // 4. Qualification Level (0-10 points)
  const hasPhD = faculty.qualifications.some(q => q.degree === 'PhD');
  const hasMasters = faculty.qualifications.some(q => q.degree === 'MS' || q.degree === 'MA');
  const qualificationScore = hasPhD ? 10 : hasMasters ? 7 : 5;
  breakdown.qualification = qualificationScore;
  total += qualificationScore;

  return {
    total: Math.round(total),
    breakdown
  };
}

/**
 * Enhance recommendations with AI analysis
 */
async function enhanceWithAI(scoredFaculty, subject) {
  const topCandidates = scoredFaculty.slice(0, 5); // Analyze top 5

  const prompt = `You are an expert academic scheduling assistant. Analyze these faculty members and recommend the best instructor for teaching "${subject.subjectName}" (${subject.subjectCode}).

Subject Details:
- Name: ${subject.subjectName}
- Code: ${subject.subjectCode}
- Units: ${subject.units}
- Lecture Hours: ${subject.lectureHours}
- Lab Hours: ${subject.labHours}
- Required Qualifications: ${subject.requiredQualifications.join(', ') || 'None specified'}

Faculty Candidates:
${topCandidates.map((item, index) => `
${index + 1}. ${item.faculty.user.firstName} ${item.faculty.user.lastName}
   - Employee ID: ${item.faculty.employeeId}
   - Specializations: ${item.faculty.specializations.join(', ')}
   - Qualifications: ${item.faculty.qualifications.map(q => `${q.degree} in ${q.field}`).join(', ')}
   - Current Load: ${item.faculty.currentLoad}/${item.faculty.maxTeachingLoad} units
   - Teaching History: ${item.faculty.teachingHistory.length} courses taught
   - Base Score: ${item.score.total}/100
`).join('\n')}

Provide a JSON response with:
1. Ranking of faculty (1-5)
2. Brief reasoning for each
3. Overall recommendation

Format:
{
  "rankings": [
    {
      "rank": 1,
      "facultyId": "employeeId",
      "reason": "brief reason",
      "confidence": 0-100
    }
  ],
  "recommendation": "overall recommendation text"
}`;

  try {
    const aiResponse = await callAI(prompt);
    const aiData = JSON.parse(aiResponse);
    
    // Merge AI rankings with scores
    return topCandidates.map((item, index) => {
      const aiRanking = aiData.rankings.find(r => 
        r.facultyId === item.faculty.employeeId
      );

      return {
        facultyId: item.faculty._id,
        facultyName: `${item.faculty.user.firstName} ${item.faculty.user.lastName}`,
        employeeId: item.faculty.employeeId,
        score: item.score.total,
        scoreBreakdown: item.breakdown,
        aiRank: aiRanking?.rank || index + 1,
        aiReason: aiRanking?.reason || 'No AI analysis available',
        aiConfidence: aiRanking?.confidence || 0,
        currentLoad: item.faculty.currentLoad,
        maxLoad: item.faculty.maxTeachingLoad,
        specializations: item.faculty.specializations,
        qualifications: item.faculty.qualifications
      };
    });

  } catch (error) {
    console.error('AI enhancement error:', error);
    // Return basic recommendations if AI fails
    throw error;
  }
}

/**
 * Call AI API with fallback support
 */
async function callAI(prompt) {
  const providers = ['gemini', 'groq', 'openai'];
  
  for (const providerKey of providers) {
    const provider = AI_PROVIDERS[providerKey];
    
    if (!provider.active) continue;

    try {
      if (providerKey === 'gemini') {
        return await callGemini(prompt, provider);
      } else {
        return await callOpenAICompatible(prompt, provider);
      }
    } catch (error) {
      console.warn(`${provider.name} API failed:`, error.message);
      continue; // Try next provider
    }
  }

  throw new Error('All AI providers failed or no API keys configured');
}

/**
 * Call Gemini API
 */
async function callGemini(prompt, provider) {
  const response = await axios.post(
    `${provider.endpoint}?key=${provider.apiKey}`,
    {
      contents: [{
        parts: [{ text: prompt }]
      }]
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }
  );

  return response.data.candidates[0].content.parts[0].text;
}

/**
 * Call OpenAI-compatible APIs (Groq, OpenAI)
 */
async function callOpenAICompatible(prompt, provider) {
  const response = await axios.post(
    provider.endpoint,
    {
      model: provider.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert academic scheduling assistant. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    },
    {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Check if any AI provider is available
 */
function isAIAvailable() {
  return Object.values(AI_PROVIDERS).some(p => p.active);
}

/**
 * Get active AI provider name
 */
function getActiveProvider() {
  const active = Object.entries(AI_PROVIDERS).find(([_, p]) => p.active);
  return active ? active[1].name : 'None';
}

/**
 * Analyze workload balance across faculty
 */
async function analyzeWorkloadBalance() {
  const faculty = await Faculty.find({ isActive: true })
    .populate('user', 'firstName lastName');

  const analysis = faculty.map(f => ({
    name: `${f.user.firstName} ${f.user.lastName}`,
    currentLoad: f.currentLoad,
    maxLoad: f.maxTeachingLoad,
    utilizationRate: ((f.currentLoad / f.maxTeachingLoad) * 100).toFixed(1),
    status: f.currentLoad >= f.maxTeachingLoad ? 'overloaded' :
            f.currentLoad >= f.maxTeachingLoad * 0.8 ? 'near_capacity' : 'available'
  }));

  const avgUtilization = analysis.reduce((sum, f) => 
    sum + parseFloat(f.utilizationRate), 0) / analysis.length;

  return {
    faculty: analysis,
    statistics: {
      totalFaculty: faculty.length,
      averageUtilization: avgUtilization.toFixed(1) + '%',
      overloaded: analysis.filter(f => f.status === 'overloaded').length,
      nearCapacity: analysis.filter(f => f.status === 'near_capacity').length,
      available: analysis.filter(f => f.status === 'available').length
    }
  };
}

module.exports = {
  recommendInstructorForSubject,
  analyzeWorkloadBalance,
  isAIAvailable,
  getActiveProvider,
  // Exposed for unit testing (Appendix G): the deterministic scoring function
  // behind instructor recommendations, scored without calling the AI.
  __test__: { calculateFacultyScore },
};
