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
const { passwordValidator } = require('../utils/passwordPolicy');
const { blockSuspectedBruteForce } = require('../middleware/loginGuard');

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
  body('password').custom(passwordValidator),
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

router.post('/login', blockSuspectedBruteForce, authLimiter, loginValidation, login);
// Rate limited as well as validated: the "email already exists" reply is a
// useful answer for a real person and an enumeration oracle for a script,
// so the script is what gets slowed down.
router.post('/signup', authLimiter, signup); // Student signup with email verification
router.post('/faculty-signup', authLimiter, facultySignup); // Faculty signup - needs an invite token (pending approval)
// Invite links: only the scheduling office can issue them; anyone holding one can check it
router.get('/faculty-invite/:token', authLimiter, checkFacultyInvite);
router.get('/verify-email/:token', authLimiter, verifyEmail); // Verify email
router.post('/resend-verification', authLimiter, resendVerification); // Resend verification email
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

/* ------------------------------------------------------------ two-factor */

const twoFactor = require('../controllers/twoFactor.controller');
const {
  twoFactorLimiter, codeRequestLimiter, sensitiveActionLimiter,
} = require('../middleware/security.middleware');

/**
 * Finishing a sign-in. These carry a short-lived challenge token rather than
 * a session, so they are deliberately outside `protect` - but every one of
 * them is rate limited, because they are the endpoints worth guessing at.
 */
router.post('/2fa/verify', twoFactorLimiter, twoFactor.verify);
router.post('/2fa/send-code', codeRequestLimiter, twoFactor.sendCode);
router.post('/2fa/passkey/options', twoFactorLimiter, twoFactor.passkeyChallengeOptions);
router.post('/2fa/passkey/verify', twoFactorLimiter, twoFactor.passkeyChallengeVerify);

// Signing in with a passkey alone, no password
router.post('/passkey/options', twoFactorLimiter, twoFactor.passwordlessOptions);
router.post('/passkey/login', twoFactorLimiter, twoFactor.passwordlessLogin);

// Managing your own factors
router.get('/2fa', protect, twoFactor.status);
router.post('/2fa/totp/setup', protect, sensitiveActionLimiter, twoFactor.totpSetup);
router.post('/2fa/totp/enable', protect, twoFactorLimiter, twoFactor.totpEnable);
router.delete('/2fa/totp', protect, sensitiveActionLimiter, twoFactor.totpDisable);
router.post('/2fa/email/enable', protect, sensitiveActionLimiter, twoFactor.emailToggle);
router.post('/2fa/email/disable', protect, sensitiveActionLimiter, twoFactor.emailToggle);
router.post('/2fa/recovery', protect, sensitiveActionLimiter, twoFactor.regenerateRecovery);

router.get('/2fa/passkeys', protect, twoFactor.listPasskeys);
router.post('/2fa/passkeys/options', protect, sensitiveActionLimiter, twoFactor.passkeyRegisterOptions);
router.post('/2fa/passkeys', protect, sensitiveActionLimiter, twoFactor.passkeyRegister);
router.patch('/2fa/passkeys/:id', protect, sensitiveActionLimiter, twoFactor.renamePasskey);
router.delete('/2fa/passkeys/:id', protect, sensitiveActionLimiter, twoFactor.deletePasskey);

module.exports = router;
