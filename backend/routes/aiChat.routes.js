const express = require('express');
const router = express.Router();
const {
  sendChatMessage,
  sendChatMessageStream,
  getSchedulingRecommendation,
  recommendFacultyForSubject,
  getApiStats,
  getQuickHelp,
} = require('../controllers/aiChat.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/ai/chat/stream
 * @desc    Send a message to AI assistant with streaming response
 * @access  Private (All authenticated users)
 */
router.post('/chat/stream', protect, sendChatMessageStream);

/**
 * @route   POST /api/ai/chat
 * @desc    Send a message to AI assistant
 * @access  Private (All authenticated users)
 */
router.post('/chat', protect, sendChatMessage);

/**
 * @route   POST /api/ai/recommend
 * @desc    Get AI scheduling recommendation for conflicts
 * @access  Private (All authenticated users)
 */
router.post('/recommend', protect, authorize('admin', 'scheduling_officer', 'program_manager'), getSchedulingRecommendation);

/**
 * @route   POST /api/ai/recommend-faculty
 * @desc    Get faculty recommendations based on teaching experience
 * @access  Private (All authenticated users)
 */
router.post('/recommend-faculty', protect, authorize('admin', 'scheduling_officer', 'program_manager'), recommendFacultyForSubject);

/**
 * @route   GET /api/ai/stats
 * @desc    Get API usage statistics
 * @access  Private (Admin only)
 */
router.get('/stats', protect, authorize('admin', 'scheduling_officer', 'program_manager'), getApiStats);

/**
 * @route   GET /api/ai/help
 * @desc    Get quick help and FAQ
 * @access  Public
 */
router.get('/help', getQuickHelp);

module.exports = router;
