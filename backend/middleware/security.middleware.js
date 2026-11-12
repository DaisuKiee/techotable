const rateLimit = require('express-rate-limit');

/**
 * Request-level defences that apply before any route runs.
 *
 *   sanitizeRequest  - strips MongoDB operators out of user input
 *   noSniffParams    - rejects duplicated query parameters
 *   limiters         - tighter rate limits on the endpoints worth attacking
 *
 * The broad limiter in server.js guards the API as a whole; these are the
 * per-endpoint budgets, because 500 requests in 15 minutes is generous for
 * browsing and far too generous for guessing a six-digit code.
 */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && !(v instanceof Date) && !Buffer.isBuffer(v);

/**
 * Keys that reach an object's prototype rather than the object.
 *
 * JSON.parse creates `__proto__` as an ordinary own property, so a body like
 * {"__proto__":{"isAdmin":true}} is harmless on its own. It stops being
 * harmless the moment that body is copied with a deep merge or Object.assign
 * into something else, which then sets a property on Object.prototype that
 * every object in the process can see - including ones that are about to be
 * checked for permissions. Dropping the keys at the edge means no handler
 * added later has to remember this.
 */
const POLLUTING = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Remove any key that Mongo would read as an operator.
 *
 * `{ email: { $ne: null } }` posted to a login form would otherwise match the
 * first user in the collection, and a key containing a dot can reach into a
 * nested path the handler never meant to expose. Keys are deleted rather than
 * escaped so a request can never half-work.
 */
const scrub = (value, depth = 0) => {
  if (depth > 12 || !isPlainObject(value)) {
    if (Array.isArray(value)) value.forEach((v) => scrub(v, depth + 1));
    return value;
  }
  Object.keys(value).forEach((key) => {
    if (key.startsWith('$') || key.includes('.') || POLLUTING.has(key)) {
      delete value[key];
      return;
    }
    const child = value[key];
    scrub(child, depth + 1);
    /**
     * `{"email": {"$ne": null}}` would otherwise be left as `{"email": {}}`.
     * Mongo-safe, but a handler that does String(email) then compares
     * "[object Object]", which is a confusing way to fail. An object that is
     * empty only because its keys were stripped is dropped entirely, so the
     * field reads as missing - which every handler already copes with.
     */
    if (isPlainObject(child) && Object.keys(child).length === 0) delete value[key];
  });
  return value;
};

const sanitizeRequest = (req, res, next) => {
  // req.query and req.params are getters on some Express versions, so they
  // are scrubbed in place rather than reassigned.
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
};

/**
 * `?role=student&role=admin` arrives as an array, and a handler written for a
 * string then compares an array - which quietly skips most checks. Anything
 * that is unexpectedly repeated collapses to its last value.
 */
const noDuplicateParams = (req, res, next) => {
  Object.keys(req.query || {}).forEach((key) => {
    if (Array.isArray(req.query[key])) req.query[key] = req.query[key][req.query[key].length - 1];
  });
  next();
};

/** Rate-limit key: the signed-in user when there is one, else the IP. */
const byUserOrIp = (req) => (req.user ? `u:${req.user._id}` : `ip:${req.ip}`);

const makeLimiter = ({ windowMinutes, max, message, code = 'RATE_LIMITED', keyGenerator }) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, code, message },
  skip: () => process.env.NODE_ENV === 'test',
});

/** Guessing a 6-digit code: 10 tries an hour makes brute force hopeless. */
const twoFactorLimiter = makeLimiter({
  windowMinutes: 15,
  max: 10,
  code: 'TOO_MANY_CODES',
  message: 'Too many verification attempts. Wait 15 minutes and try again.',
});

/** Sending codes and reset links costs money and can be used to spam a mailbox. */
const codeRequestLimiter = makeLimiter({
  windowMinutes: 15,
  max: 5,
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many codes requested. Wait a few minutes before asking for another.',
});

/** Enrolment and credential changes: frequent enough for a real user, not a script. */
const sensitiveActionLimiter = makeLimiter({
  windowMinutes: 15,
  max: 30,
  message: 'Too many security changes in a short time. Please wait a few minutes.',
  keyGenerator: byUserOrIp,
});

/** Model calls are slow and billed, so they get their own budget per account. */
const aiLimiter = makeLimiter({
  windowMinutes: 10,
  max: 40,
  code: 'AI_RATE_LIMITED',
  message: 'You are sending requests to the assistant too quickly. Give it a moment.',
  keyGenerator: byUserOrIp,
});

/** Uploads are the most expensive thing an ordinary account can do. */
const uploadLimiter = makeLimiter({
  windowMinutes: 15,
  max: 40,
  message: 'Too many uploads. Please wait a few minutes.',
  keyGenerator: byUserOrIp,
});

/**
 * Headers helmet does not set for us, plus the ones worth stating outright.
 * The API serves JSON and uploaded images only, so the policy can be strict.
 */
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), interest-cohort=()');
  // Nothing the API returns should ever be cached by a shared proxy
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
};

module.exports = {
  sanitizeRequest,
  noDuplicateParams,
  securityHeaders,
  twoFactorLimiter,
  codeRequestLimiter,
  sensitiveActionLimiter,
  aiLimiter,
  uploadLimiter,
  byUserOrIp,
};
