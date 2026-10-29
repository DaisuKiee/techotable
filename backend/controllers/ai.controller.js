const Subject = require('../models/Subject.model');
const Faculty = require('../models/Faculty.model');
const { sendError } = require('../middleware/error.middleware');
const {
  recommendInstructorForSubject,
  analyzeWorkloadBalance,
  isAIAvailable,
  getActiveProvider
} = require('../services/aiRecommendation.service');

// @desc    Recommend instructor for a subject
// @route   POST /api/ai/recommend-instructor
// @access  Private/Admin
exports.recommendInstructor = async (req, res) => {
  try {
    const { subjectId, academicYear, semester, useAI } = req.body;

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        message: 'Subject ID is required'
      });
    }

    const result = await recommendInstructorForSubject({
      subjectId,
      academicYear,
      semester,
      useAI: useAI !== false // Default to true
    });

    res.status(200).json({
      success: result.success,
      message: result.message || 'Recommendations generated successfully',
      data: result
    });

  } catch (error) {
    sendError(res, error, 'Error generating instructor recommendations');
  }
};

// @desc    Recommend instructors for entire curriculum
// @route   POST /api/ai/recommend-curriculum
// @access  Private/Admin
exports.recommendInstructorsForCurriculum = async (req, res) => {
  try {
    const { program, yearLevel, semester, academicYear } = req.body;

    if (!program || !yearLevel || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Program, year level, and semester are required'
      });
    }

    // Get all subjects for the curriculum
    const subjects = await Subject.find({
      program,
      yearLevel,
      semester,
      isActive: true
    });

    if (subjects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No subjects found for this curriculum'
      });
    }

    // Get recommendations for each subject
    const recommendations = [];
    
    for (const subject of subjects) {
      try {
        const result = await recommendInstructorForSubject({
          subjectId: subject._id,
          academicYear,
          semester,
          useAI: true
        });

        recommendations.push({
          subject: {
            id: subject._id,
            code: subject.subjectCode,
            name: subject.subjectName,
            units: subject.units
          },
          recommendations: result.recommendations.slice(0, 3), // Top 3
          usedAI: result.usedAI
        });
      } catch (error) {
        recommendations.push({
          subject: {
            id: subject._id,
            code: subject.subjectCode,
            name: subject.subjectName
          },
          error: error.message,
          recommendations: []
        });
      }
    }

    res.status(200).json({
      success: true,
      program,
      yearLevel,
      semester,
      totalSubjects: subjects.length,
      data: recommendations
    });

  } catch (error) {
    sendError(res, error, 'Error generating curriculum recommendations');
  }
};

// @desc    Analyze workload balance
// @route   POST /api/ai/analyze-workload
// @access  Private/Admin
exports.analyzeWorkloadBalance = async (req, res) => {
  try {
    const analysis = await analyzeWorkloadBalance();

    res.status(200).json({
      success: true,
      message: 'Workload analysis completed',
      data: analysis
    });

  } catch (error) {
    sendError(res, error, 'Error analyzing workload');
  }
};

// @desc    Predict schedule quality
// @route   POST /api/ai/predict-quality
// @access  Private/Admin
exports.predictScheduleQuality = async (req, res) => {
  try {
    const { scheduleData } = req.body;

    // Placeholder for schedule quality prediction
    // Will analyze factors like:
    // - Faculty-subject match quality
    // - Workload distribution
    // - Time slot efficiency
    // - Room utilization

    res.status(200).json({
      success: true,
      message: 'Schedule quality prediction',
      data: {
        overallScore: 85,
        factors: {
          facultyMatch: 90,
          workloadBalance: 80,
          timeEfficiency: 85,
          roomUtilization: 85
        },
        recommendations: [
          'Consider redistributing load for Dr. Smith',
          'Room CL-101 is underutilized on Wednesdays'
        ]
      }
    });

  } catch (error) {
    sendError(res, error, 'Error predicting schedule quality');
  }
};

// @desc    Get AI recommendation insights
// @route   GET /api/ai/insights
// @access  Private/Admin
exports.getRecommendationInsights = async (req, res) => {
  try {
    const aiStatus = {
      available: isAIAvailable(),
      activeProvider: getActiveProvider(),
      providers: {
        gemini: !!process.env.GEMINI_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
        openai: !!process.env.OPENAI_API_KEY
      }
    };

    const workloadAnalysis = await analyzeWorkloadBalance();

    res.status(200).json({
      success: true,
      data: {
        aiStatus,
        workloadSummary: workloadAnalysis.statistics,
        recommendations: [
          'AI-powered recommendations are ' + (aiStatus.available ? 'enabled' : 'disabled'),
          `Using ${aiStatus.activeProvider} for intelligent suggestions`,
          `${workloadAnalysis.statistics.available} faculty members have available capacity`
        ]
      }
    });

  } catch (error) {
    sendError(res, error, 'Error fetching insights');
  }
};
