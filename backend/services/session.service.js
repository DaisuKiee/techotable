/**
 * Sign-in sessions, sign-in history and lockout.
 *
 *   issueSession   - a session record + a login token that names it (sid)
 *   reissueToken   - a fresh token for the same session (after "sign out
 *                    everywhere else" or a password change, which reject
 *                    every token issued before them)
 *   recordLogin    - sign-in history, and a notice on a new device
 *   registerFailure / clearFailures - 5 wrong passwords lock the account
 *                    for 15 minutes
 */

const jwt = require('jsonwebtoken');
const Session = require('../models/Session.model');
const LoginEvent = require('../models/LoginEvent.model');
const { describeDevice, clientIp } = require('../utils/device');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const sign = (userId, sid) => jwt.sign(
  { id: String(userId), sid: String(sid) },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

const expiryOf = (token) => new Date(jwt.decode(token).exp * 1000);

/** Start a session for this request's device and return its token. */
const issueSession = async (user, req) => {
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 400);
  const session = new Session({
    user: user._id,
    userAgent,
    device: describeDevice(userAgent),
    ip: clientIp(req),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // replaced below
  });
  const token = sign(user._id, session._id);
  session.expiresAt = expiryOf(token);
  await session.save();
  return token;
};

/** A new token for an existing session (or a new session if it has none). */
const reissueToken = async (user, req, sid) => {
  if (!sid) return issueSession(user, req);
  const token = sign(user._id, sid);
  await Session.updateOne({ _id: sid }, { expiresAt: expiryOf(token), lastSeenAt: new Date() });
  return token;
};

/** End every session of this user except `keepSid`. Returns how many. */
const revokeOtherSessions = async (userId, keepSid) => {
  const filter = { user: userId, revokedAt: null };
  if (keepSid) filter._id = { $ne: keepSid };
  const { modifiedCount } = await Session.updateMany(filter, { revokedAt: new Date() });
  return modifiedCount;
};

/**
 * Save a sign-in attempt. On a successful sign-in from a device this account
 * hasn't used in 90 days, tell the owner (skipped on their very first one).
 */
const recordLogin = async (req, { user = null, email, success, reason = 'ok' }) => {
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 400);
  const device = describeDevice(userAgent);
  const ip = clientIp(req);
  try {
    let newDevice = false;
    if (success && user) {
      const [anyBefore, sameDevice] = await Promise.all([
        LoginEvent.exists({ user: user._id, success: true }),
        LoginEvent.exists({ user: user._id, success: true, device }),
      ]);
      newDevice = !!anyBefore && !sameDevice;
    }
    await LoginEvent.create({ user: user?._id || null, email, success, reason, device, userAgent, ip });
    if (newDevice) {
      const { createNotification } = require('./inAppNotification.service');
      await createNotification([user._id], {
        type: 'account',
        title: `New sign-in: ${device}`,
        message: `Your account was signed in from ${device} (${ip}). If this wasn't you, change your password and sign out of other devices in Settings.`,
        link: '/settings',
        metadata: { kind: 'new_device' },
        preference: null,
      });
    }
  } catch (error) {
    // History is best-effort; never block a sign-in on it
    console.error('Recording sign-in failed:', error.message);
  }
};

/** Minutes left on a lock, or 0. */
const lockMinutesLeft = (user) => {
  const until = user.lockUntil ? new Date(user.lockUntil).getTime() : 0;
  return until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0;
};

/** Count a wrong password; locks the account at the limit. Returns true if it just locked. */
const registerFailure = async (user) => {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    user.failedLoginAttempts = 0;
    user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    try {
      const { createNotification } = require('./inAppNotification.service');
      await createNotification([user._id], {
        type: 'account',
        title: 'Sign-in locked after failed attempts',
        message: `Someone entered the wrong password ${MAX_FAILED_ATTEMPTS} times, so sign-in is locked for ${LOCK_MINUTES} minutes. If this wasn't you, change your password.`,
        link: '/settings',
        metadata: { kind: 'locked' },
        preference: null,
      });
    } catch (_) { /* the lock matters more than the notice */ }
    return true;
  }
  user.failedLoginAttempts = attempts;
  await user.save({ validateBeforeSave: false });
  return false;
};

const clearFailures = (user) => {
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
};

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  issueSession,
  reissueToken,
  revokeOtherSessions,
  recordLogin,
  lockMinutesLeft,
  registerFailure,
  clearFailures,
};
