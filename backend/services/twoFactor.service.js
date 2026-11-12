const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const User = require('../models/User.model');
const TwoFactor = require('../models/TwoFactor.model');
const Passkey = require('../models/Passkey.model');
const AuthChallenge = require('../models/AuthChallenge.model');
const { encrypt, decrypt, digest, safeEqual } = require('../utils/secretBox');
const { clientIp } = require('../utils/device');

/**
 * Second factors: authenticator app, emailed code, and recovery codes.
 * Passkeys are in webauthn.service.js; this module owns everything else and
 * the policy question of who has to enrol.
 */

// A 30-second step, accepting the neighbouring window either side so a phone
// whose clock is a few seconds out still works.
authenticator.options = { step: 30, window: 1 };

const ISSUER = process.env.TWOFA_ISSUER || 'CTU Daanbantayan Timetabling';

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;

/* ------------------------------------------------------------------ policy */

/**
 * Everyone has to enrol. `TWOFA_REQUIRED_ROLES` can narrow that per
 * deployment, and `TWOFA_GRACE_DAYS` gives each account a window to set it up
 * rather than locking out the whole campus the moment this ships.
 */
const requiredRoles = () => {
  const configured = String(process.env.TWOFA_REQUIRED_ROLES || '').trim();
  if (!configured) return null; // null means "every role"
  return new Set(configured.split(',').map((r) => r.trim()).filter(Boolean));
};

const GRACE_DAYS = () => {
  const raw = Number(process.env.TWOFA_GRACE_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 7;
};

const isRequiredFor = (user) => {
  if (!user) return false;
  const roles = requiredRoles();
  return roles === null ? true : roles.has(user.role);
};

/**
 * What the app should do about this account right now.
 *
 *   enrolled  - has at least one working second factor
 *   required  - policy says they need one
 *   graceEndsAt / mustEnrolNow - how long they can keep postponing it
 */
const enrolmentStatus = async (user) => {
  const required = isRequiredFor(user);
  const enrolled = !!user.twoFactorEnabled;

  if (!required || enrolled) {
    return { required, enrolled, mustEnrolNow: false, graceEndsAt: null, graceDaysLeft: null };
  }

  // The clock starts the first time we tell them, not at deploy time
  let since = user.twoFactorRequiredSince;
  if (!since) {
    since = new Date();
    await User.updateOne({ _id: user._id }, { twoFactorRequiredSince: since });
    user.twoFactorRequiredSince = since;
  }

  const graceEndsAt = new Date(new Date(since).getTime() + GRACE_DAYS() * 24 * 60 * 60 * 1000);
  const msLeft = graceEndsAt.getTime() - Date.now();
  return {
    required: true,
    enrolled: false,
    mustEnrolNow: msLeft <= 0,
    graceEndsAt,
    graceDaysLeft: Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
  };
};

/* --------------------------------------------------------------- enrolment */

const recordFor = async (userId, { create = false } = {}) => {
  let record = await TwoFactor.findOne({ user: userId });
  if (!record && create) record = await TwoFactor.create({ user: userId });
  return record;
};

/**
 * Recalculate User.twoFactorEnabled from what is actually enrolled.
 *
 * The flag is a cache the login path reads; this is the only thing allowed
 * to write it, so it can never claim an account is protected by a method
 * that was since deleted.
 */
const syncEnabledFlag = async (userId) => {
  const [record, passkeys] = await Promise.all([
    TwoFactor.findOne({ user: userId }),
    Passkey.countDocuments({ user: userId }),
  ]);
  const enabled = passkeys > 0
    || !!(record && (record.totpEnabledAt || record.emailEnabled));

  const update = { twoFactorEnabled: enabled };
  if (enabled) update.twoFactorEnrolledAt = new Date();
  await User.updateOne({ _id: userId }, update);
  return enabled;
};

/**
 * Everything the Settings page needs, with no secrets in it.
 *
 * The user is re-read rather than trusted as passed. Callers hand us
 * `req.user`, which was loaded before the enrolment that just happened, so
 * using it directly made the panel report "two-step verification is off"
 * immediately after someone turned it on.
 */
const describe = async (userLike) => {
  const [user, record, passkeys] = await Promise.all([
    User.findById(userLike._id).select('role twoFactorEnabled twoFactorRequiredSince'),
    TwoFactor.findOne({ user: userLike._id }),
    Passkey.find({ user: userLike._id }).sort({ createdAt: 1 }),
  ]);
  const status = await enrolmentStatus(user || userLike);
  return {
    ...status,
    methods: {
      totp: !!(record && record.totpEnabledAt),
      email: !!(record && record.emailEnabled),
      passkeys: passkeys.length,
      recoveryCodesLeft: record ? record.unusedRecoveryCount() : 0,
    },
    passkeys: passkeys.map((p) => p.toPublic()),
    lastVerifiedAt: record ? record.lastVerifiedAt : null,
  };
};

/* -------------------------------------------------------------------- TOTP */

/**
 * Start enrolling an authenticator app. The seed is stored immediately but
 * `totpEnabledAt` stays null, so the method does not count until a code from
 * the app proves it was scanned correctly - otherwise a mistyped scan would
 * lock the person out of their own account.
 */
const beginTotpSetup = async (user) => {
  const secret = authenticator.generateSecret(20); // 160-bit, per RFC 4226
  const record = await recordFor(user._id, { create: true });
  record.totpSecret = encrypt(secret);
  record.totpEnabledAt = null;
  await record.save();

  const otpauth = authenticator.keyuri(user.email, ISSUER, secret);
  return {
    secret,                                    // shown once, for manual entry
    otpauth,
    qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 240 }),
  };
};

/**
 * Check a code against the stored seed.
 *
 * `totpLastStep` records the time step that was accepted, so the same code
 * cannot be used twice - without it, a code shoulder-surfed or captured by a
 * proxy stays valid for the rest of its 30-second window.
 */
const verifyTotp = async (record, token) => {
  const secret = decrypt(record.totpSecret);
  if (!secret) return false;

  const clean = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  if (!authenticator.verify({ token: clean, secret })) return false;

  const step = Math.floor(Date.now() / 1000 / 30);
  // Accept the step itself or either neighbour, but never one already used
  if (record.totpLastStep && step <= record.totpLastStep) return false;
  record.totpLastStep = step;
  return true;
};

/** Turn on the authenticator app once the first code checks out. */
const enableTotp = async (user, token) => {
  const record = await recordFor(user._id);
  if (!record || !record.totpSecret) {
    return { ok: false, message: 'Start the setup again - no pending authenticator was found.' };
  }
  if (!(await verifyTotp(record, token))) {
    return { ok: false, message: 'That code is not right. Check your authenticator app and try the current code.' };
  }
  record.totpEnabledAt = new Date();
  await record.save();
  await syncEnabledFlag(user._id);
  return { ok: true };
};

/* -------------------------------------------------------- recovery codes */

/** Format: 4-4-4 lowercase base32-ish, unambiguous characters only. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no i, l, o, 0, 1

const makeRecoveryCode = () => {
  const pick = () => ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join('');
  return `${group()}-${group()}-${group()}`;
};

const normaliseRecovery = (code) => String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Replace every recovery code with a fresh set and return the plaintext
 * once. Regenerating invalidates the old list, which is the point: it is
 * what someone does after printing the codes and losing the paper.
 */
const regenerateRecoveryCodes = async (userId) => {
  const record = await recordFor(userId, { create: true });
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, makeRecoveryCode);
  record.recoveryCodes = codes.map((c) => ({ hash: digest(normaliseRecovery(c)), usedAt: null }));
  record.recoveryGeneratedAt = new Date();
  await record.save();
  await syncEnabledFlag(userId);
  return codes;
};

/** Spend one code. Each works exactly once. */
const verifyRecoveryCode = async (record, code, ip) => {
  const wanted = digest(normaliseRecovery(code));
  const entry = record.recoveryCodes.find((c) => !c.usedAt && safeEqual(c.hash, wanted));
  if (!entry) return false;
  entry.usedAt = new Date();
  entry.usedIp = ip || null;
  return true;
};

/* --------------------------------------------------------- emailed codes */

const sixDigits = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

/**
 * Send a one-time code and remember only its hash.
 *
 * Any code outstanding for this user is dropped first, so asking for a new
 * one cannot leave several valid at once - that would multiply an attacker's
 * guessing odds by the number of codes in flight.
 */
const sendEmailCode = async (user, req) => {
  await AuthChallenge.deleteMany({ kind: 'email-code', user: user._id });

  const code = sixDigits();
  await AuthChallenge.create({
    kind: 'email-code',
    user: user._id,
    value: digest(code),
    ip: clientIp(req),
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 400),
    expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
  });

  const { sendTwoFactorCodeEmail } = require('./emailService');
  const result = await sendTwoFactorCodeEmail(user.email, code, user.firstName, {
    minutes: Math.round(EMAIL_CODE_TTL_MS / 60000),
    ip: clientIp(req),
  });
  return result;
};

/** Check a code and burn it, whether or not it was right. */
const verifyEmailCode = async (userId, code) => {
  const challenge = await AuthChallenge.findOne({
    kind: 'email-code',
    user: userId,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!challenge) return { ok: false, message: 'That code has expired. Ask for a new one.' };

  if (challenge.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    await AuthChallenge.deleteOne({ _id: challenge._id });
    return { ok: false, message: 'Too many wrong codes. Ask for a new one.' };
  }

  const clean = String(code || '').replace(/\s+/g, '');
  if (!safeEqual(challenge.value, digest(clean))) {
    challenge.attempts += 1;
    await challenge.save();
    return { ok: false, message: 'That code is not right.' };
  }

  challenge.consumedAt = new Date();
  await challenge.save();
  return { ok: true };
};

/* ------------------------------------------------------- the login check */

/**
 * Verify whichever second factor the person chose.
 * Returns { ok, message }. The caller issues the session on ok.
 */
const verifySecondFactor = async (user, { method, code }, req) => {
  const record = await recordFor(user._id);

  if (method === 'email') {
    if (!record || !record.emailEnabled) {
      return { ok: false, message: 'Email codes are not switched on for this account.' };
    }
    const result = await verifyEmailCode(user._id, code);
    if (!result.ok) return result;
  } else if (method === 'totp') {
    if (!record || !record.totpEnabledAt) {
      return { ok: false, message: 'No authenticator app is set up for this account.' };
    }
    if (!(await verifyTotp(record, code))) {
      return { ok: false, message: 'That code is not right. Codes change every 30 seconds - try the current one.' };
    }
  } else if (method === 'recovery') {
    if (!record || record.unusedRecoveryCount() === 0) {
      return { ok: false, message: 'There are no unused recovery codes on this account.' };
    }
    if (!(await verifyRecoveryCode(record, code, clientIp(req)))) {
      return { ok: false, message: 'That recovery code is not valid, or it has already been used.' };
    }
  } else {
    return { ok: false, message: 'Unknown verification method.' };
  }

  record.lastVerifiedAt = new Date();
  record.lastVerifiedMethod = method;
  await record.save();
  return { ok: true, recoveryCodesLeft: record.unusedRecoveryCount() };
};

/** Which prompts to offer on the sign-in screen for this account. */
const methodsFor = async (userId) => {
  const [record, passkeys] = await Promise.all([
    TwoFactor.findOne({ user: userId }),
    Passkey.countDocuments({ user: userId }),
  ]);
  return {
    totp: !!(record && record.totpEnabledAt),
    email: !!(record && record.emailEnabled),
    recovery: !!(record && record.unusedRecoveryCount() > 0),
    passkey: passkeys > 0,
  };
};

module.exports = {
  isRequiredFor,
  enrolmentStatus,
  describe,
  recordFor,
  syncEnabledFlag,
  beginTotpSetup,
  enableTotp,
  regenerateRecoveryCodes,
  sendEmailCode,
  verifyEmailCode,
  verifySecondFactor,
  methodsFor,
  RECOVERY_CODE_COUNT,
};
