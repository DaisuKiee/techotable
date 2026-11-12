const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const Session = require('../models/Session.model');
const { clientIp } = require('../utils/device');

// Verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Invite links are signed with the same secret; they're not logins
    if (decoded.purpose || !decoded.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    req.user = await User.findById(decoded.id)
      .select('-password')
      .populate('facultyProfile');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Issued before a password change or "sign out everywhere"
    const validAfter = req.user.tokensValidAfter ? Math.floor(new Date(req.user.tokensValidAfter).getTime() / 1000) : 0;
    if (decoded.iat < validAfter) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_ENDED',
        message: 'You were signed out because your password changed or all devices were signed out. Please sign in again.'
      });
    }

    // A session that was ended from Settings, or by logging out
    if (decoded.sid) {
      const session = await Session.findById(decoded.sid).select('user revokedAt lastSeenAt').lean();
      if (!session || session.revokedAt || String(session.user) !== String(req.user._id)) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'This device was signed out. Please sign in again.'
        });
      }
      // "Last active" for the sessions list, at most every 5 minutes
      if (Date.now() - new Date(session.lastSeenAt).getTime() > 5 * 60 * 1000) {
        Session.updateOne({ _id: session._id }, { lastSeenAt: new Date(), ip: clientIp(req) }).catch(() => {});
      }
      req.sessionId = String(decoded.sid);
    }

    if (!req.user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired'
    });
  }
};

/**
 * Attach req.user when a valid token is present, but never reject.
 *
 * For the handful of endpoints a signed-out visitor legitimately needs (the
 * programme list on the sign-up form), so they can answer with less detail to
 * anonymous callers instead of being thrown open entirely.
 */
exports.optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.purpose || !decoded.id) return next();
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) req.user = user;
  } catch (_) {
    // An invalid token is treated as no token here, not as an error
  }
  return next();
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};
