const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  acceptTerms,
  updateProfile,
  changePassword,
  logout,
  updateSettings,
  getSettings,
  signup,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  facultySignup,
  checkFacultyInvite,
  getSessions,
  revokeSession,
  revokeOtherSessions,
  getLoginActivity
} = require('../controllers/auth.controller');
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/auth.middleware');

// Validation middleware
//
// NOTE: do NOT use .normalizeEmail() here. It strips dots from Gmail
// addresses ("a.b@gmail.com" -> "ab@gmail.com"), while /auth/signup stores
// the address exactly as typed. That mismatch meant anyone who signed up with
// a dot in their Gmail address could never log in: the lookup searched for an
// address that was never stored. Lowercasing is all the normalising we do,
// and the controllers already lowercase before querying.
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Public routes
router.post('/register', registerValidation, register);
// Per-IP cap on password guessing and reset-email spam, on top of the
// per-account lock in the login controller. Unlike the global limiter it
// also applies on localhost.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  // Only failures count: a campus shares one public IP, and 30 successful
  // sign-ins in 15 minutes is a normal morning
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many sign-in attempts from this network. Wait 15 minutes and try again.' },
});

router.post('/login', authLimiter, loginValidation, login);
router.post('/signup', signup); // Student signup with email verification
router.post('/faculty-signup', facultySignup); // Faculty signup - needs an invite token (pending approval)
// Invite links: only the scheduling office can issue them; anyone holding one can check it
router.get('/faculty-invite/:token', checkFacultyInvite);
router.get('/verify-email/:token', verifyEmail); // Verify email
router.post('/resend-verification', resendVerification); // Resend verification email
router.post('/forgot-password', authLimiter, forgotPassword); // Request password reset
router.post('/reset-password/:token', authLimiter, resetPassword); // Reset password with token

// Protected routes
router.get('/me', protect, getMe);
router.post('/accept-terms', protect, acceptTerms);
router.get('/terms-version', (req, res) => res.json({ success: true, version: require('../config/terms').TERMS_VERSION }));
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/settings', protect, getSettings);
router.put('/settings', protect, updateSettings);
router.post('/logout', protect, logout);
router.get('/sessions', protect, getSessions);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);
router.delete('/sessions/:id', protect, revokeSession);
router.get('/login-activity', protect, getLoginActivity);

module.exports = router;
