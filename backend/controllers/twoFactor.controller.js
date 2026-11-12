const jwt = require('jsonwebtoken');

const User = require('../models/User.model');
const TwoFactor = require('../models/TwoFactor.model');
const Passkey = require('../models/Passkey.model');
const { sendError, AppError } = require('../middleware/error.middleware');
const { publicUser } = require('../utils/publicUser');
const { digest, safeEqual } = require('../utils/secretBox');
const twoFactor = require('../services/twoFactor.service');
const webauthn = require('../services/webauthn.service');
const { issueSession, recordLogin } = require('../services/session.service');

/**
 * Everything that happens between "the password was right" and "you are
 * signed in", plus managing the factors themselves.
 *
 * The half-finished sign-in is carried by a challenge token: a JWT with
 * purpose '2fa', a five-minute life and no authority of its own. The
 * `protect` middleware already refuses any token carrying a `purpose`, so
 * one of these can never be used as a session by mistake.
 */

const CHALLENGE_TTL = '5m';

const signChallenge = (userId, stage = '2fa') => jwt.sign(
  { id: String(userId), purpose: stage },
  process.env.JWT_SECRET,
  { expiresIn: CHALLENGE_TTL },
);

const readChallenge = (token, stage = '2fa') => {
  try {
    const decoded = jwt.verify(String(token || ''), process.env.JWT_SECRET);
    if (decoded.purpose !== stage || !decoded.id) return null;
    return decoded;
  } catch (_) {
    return null;
  }
};

/** Resolve the account a challenge token refers to, or answer 401. */
const userFromChallenge = async (req, res, stage = '2fa') => {
  const decoded = readChallenge(req.body.challengeToken, stage);
  if (!decoded) {
    res.status(401).json({
      success: false,
      code: 'CHALLENGE_EXPIRED',
      message: 'This sign-in took too long. Please enter your password again.',
    });
    return null;
  }
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, message: 'Account unavailable.' });
    return null;
  }
  return user;
};

/**
 * Finish a sign-in: start the session and answer exactly like /auth/login.
 * One place, so the password path and the passkey path cannot drift.
 */
const completeSignIn = async (user, req, res, { method, extra = {} }) => {
  user.lastLogin = new Date();
  await user.save();
  await recordLogin(req, { user, email: user.email, success: true, reason: `2fa:${method}` });

  const token = await issueSession(user, req);
  const status = await twoFactor.enrolmentStatus(user);

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: publicUser(user, { self: true }),
      token,
      twoFactor: status,
      ...extra,
    },
  });
};

/* =========================================================== sign-in flow */

/**
 * POST /api/auth/2fa/verify
 * Body: { challengeToken, method: 'totp'|'email'|'recovery', code }
 */
exports.verify = async (req, res) => {
  try {
    const user = await userFromChallenge(req, res);
    if (!user) return undefined;

    const { method, code } = req.body;
    const result = await twoFactor.verifySecondFactor(user, { method, code }, req);

    if (!result.ok) {
      await recordLogin(req, {
        user, email: user.email, success: false, reason: `2fa_failed:${method}`,
      });
      return res.status(401).json({ success: false, code: 'TWOFA_INVALID', message: result.message });
    }

    return completeSignIn(user, req, res, {
      method,
      extra: method === 'recovery'
        ? { recoveryCodesLeft: result.recoveryCodesLeft }
        : {},
    });
  } catch (error) {
    return sendError(res, error, 'Could not verify the code');
  }
};

/** POST /api/auth/2fa/send-code - email the waiting account a fresh code. */
exports.sendCode = async (req, res) => {
  try {
    const user = await userFromChallenge(req, res);
    if (!user) return undefined;

    const record = await twoFactor.recordFor(user._id);
    if (!record || !record.emailEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Email codes are not switched on for this account.',
      });
    }

    const result = await twoFactor.sendEmailCode(user, req);
    if (!result.success) {
      throw new AppError('We could not send the code. Try another method or try again shortly.', 502);
    }
    return res.status(200).json({
      success: true,
      message: `A code is on its way to ${maskEmail(user.email)}.`,
    });
  } catch (error) {
    return sendError(res, error, 'Could not send the code');
  }
};

/** m****o@gmail.com - enough to recognise, not enough to learn. */
const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return 'your email';
  const shown = local.length <= 2 ? local[0] || '' : `${local[0]}${'*'.repeat(Math.min(6, local.length - 2))}${local[local.length - 1]}`;
  return `${shown}@${domain}`;
};
exports.maskEmail = maskEmail;

/* ------------------------------------------- passkey as the second factor */

/** POST /api/auth/2fa/passkey/options - after a correct password. */
exports.passkeyChallengeOptions = async (req, res) => {
  try {
    const user = await userFromChallenge(req, res);
    if (!user) return undefined;
    const options = await webauthn.authenticationOptions({ user, req });
    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    return sendError(res, error, 'Could not start passkey verification');
  }
};

/** POST /api/auth/2fa/passkey/verify */
exports.passkeyChallengeVerify = async (req, res) => {
  try {
    const user = await userFromChallenge(req, res);
    if (!user) return undefined;

    const result = await webauthn.verifyAuthentication({ response: req.body.response, user, req });
    if (!result.ok) {
      await recordLogin(req, { user, email: user.email, success: false, reason: '2fa_failed:passkey' });
      return res.status(401).json({ success: false, code: 'TWOFA_INVALID', message: result.message });
    }
    return completeSignIn(user, req, res, { method: 'passkey' });
  } catch (error) {
    return sendError(res, error, 'Could not verify the passkey');
  }
};

/* ----------------------------------------------- passwordless passkey login */

/**
 * POST /api/auth/passkey/options
 *
 * No password, no e-mail: the browser offers whatever passkeys it holds for
 * this site and the account is identified by the one that answers. The
 * challenge is tied to a random key this response hands back, because there
 * is no account to tie it to yet.
 */
exports.passwordlessOptions = async (req, res) => {
  try {
    const sessionKey = require('crypto').randomBytes(24).toString('base64url');
    const options = await webauthn.authenticationOptions({ sessionKey, req });
    return res.status(200).json({ success: true, data: { options, sessionKey } });
  } catch (error) {
    return sendError(res, error, 'Could not start passkey sign-in');
  }
};

/** POST /api/auth/passkey/login - { sessionKey, response } */
exports.passwordlessLogin = async (req, res) => {
  try {
    const { sessionKey, response } = req.body;
    if (!sessionKey || !response) {
      return res.status(400).json({ success: false, message: 'Incomplete passkey response.' });
    }

    const result = await webauthn.verifyAuthentication({ response, sessionKey, req });
    if (!result.ok) {
      await recordLogin(req, { email: 'passkey', success: false, reason: 'passkey_failed' });
      return res.status(401).json({ success: false, message: result.message });
    }

    const user = await User.findById(result.passkey.user);
    if (!user) {
      return res.status(401).json({ success: false, message: 'That account no longer exists.' });
    }
    if (!user.isActive) {
      await recordLogin(req, { user, email: user.email, success: false, reason: 'inactive' });
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administration.',
      });
    }

    /**
     * A passkey is already two factors in one - something you have (the
     * device) plus something you are (the biometric the device checked, which
     * we required with userVerification). So this is a complete sign-in, not
     * a first step.
     */
    return completeSignIn(user, req, res, { method: 'passkey-passwordless' });
  } catch (error) {
    return sendError(res, error, 'Could not sign in with that passkey');
  }
};

/* ============================================================== enrolment */

/** GET /api/auth/2fa */
exports.status = async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: await twoFactor.describe(req.user) });
  } catch (error) {
    return sendError(res, error, 'Could not load your security settings');
  }
};

/** POST /api/auth/2fa/totp/setup */
exports.totpSetup = async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: await twoFactor.beginTotpSetup(req.user) });
  } catch (error) {
    return sendError(res, error, 'Could not start authenticator setup');
  }
};

/**
 * POST /api/auth/2fa/totp/enable - { code }
 * Returns the recovery codes the first time any method is enabled, because
 * that is the moment losing the phone starts to matter.
 */
exports.totpEnable = async (req, res) => {
  try {
    const result = await twoFactor.enableTotp(req.user, req.body.code);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    const record = await twoFactor.recordFor(req.user._id);
    const recoveryCodes = record.unusedRecoveryCount() === 0
      ? await twoFactor.regenerateRecoveryCodes(req.user._id)
      : null;

    return res.status(200).json({
      success: true,
      message: 'Authenticator app enabled.',
      data: { recoveryCodes, status: await twoFactor.describe(req.user) },
    });
  } catch (error) {
    return sendError(res, error, 'Could not enable the authenticator app');
  }
};

/** POST /api/auth/2fa/email/enable and /disable */
exports.emailToggle = async (req, res) => {
  try {
    const enable = req.path.endsWith('/enable');
    const record = await twoFactor.recordFor(req.user._id, { create: true });

    if (!enable && !(await canRemoveMethod(req.user, 'email'))) {
      return res.status(400).json({
        success: false,
        message: 'This is your only second factor, and your account is required to have one. Add an authenticator app or a passkey first.',
      });
    }

    record.emailEnabled = enable;
    await record.save();
    await twoFactor.syncEnabledFlag(req.user._id);

    const recoveryCodes = enable && record.unusedRecoveryCount() === 0
      ? await twoFactor.regenerateRecoveryCodes(req.user._id)
      : null;

    return res.status(200).json({
      success: true,
      message: enable ? 'Email codes enabled.' : 'Email codes turned off.',
      data: { recoveryCodes, status: await twoFactor.describe(req.user) },
    });
  } catch (error) {
    return sendError(res, error, 'Could not update email codes');
  }
};

/**
 * Would removing this method leave a required account with nothing?
 * Recovery codes do not count: they are for emergencies, not for signing in
 * every day, and an account holding only those is one lost sheet of paper
 * away from needing an administrator.
 */
const canRemoveMethod = async (user, removing) => {
  if (!twoFactor.isRequiredFor(user)) return true;
  const methods = await twoFactor.methodsFor(user._id);
  const remaining = [
    removing === 'totp' ? false : methods.totp,
    removing === 'email' ? false : methods.email,
    removing === 'passkey' ? false : methods.passkey,
  ].filter(Boolean).length;
  return remaining > 0;
};

/** DELETE /api/auth/2fa/totp - { password } */
exports.totpDisable = async (req, res) => {
  try {
    if (!(await confirmPassword(req, res))) return undefined;
    if (!(await canRemoveMethod(req.user, 'totp'))) {
      return res.status(400).json({
        success: false,
        message: 'This is your only second factor, and your account is required to have one. Add a passkey or email codes first.',
      });
    }
    await TwoFactor.updateOne(
      { user: req.user._id },
      { totpSecret: '', totpEnabledAt: null, totpLastStep: 0 },
    );
    await twoFactor.syncEnabledFlag(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Authenticator app removed.',
      data: { status: await twoFactor.describe(req.user) },
    });
  } catch (error) {
    return sendError(res, error, 'Could not remove the authenticator app');
  }
};

/** POST /api/auth/2fa/recovery - { password } - new codes, old ones void. */
exports.regenerateRecovery = async (req, res) => {
  try {
    if (!(await confirmPassword(req, res))) return undefined;
    const recoveryCodes = await twoFactor.regenerateRecoveryCodes(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'New recovery codes generated. The previous set no longer works.',
      data: { recoveryCodes },
    });
  } catch (error) {
    return sendError(res, error, 'Could not generate recovery codes');
  }
};

/**
 * Re-type the password before changing anything security-related.
 *
 * Without this, anyone who walks up to an unlocked laptop - or any XSS that
 * already has the session token - can quietly enrol their own passkey and
 * keep access after the password is changed.
 */
const confirmPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({
      success: false,
      code: 'PASSWORD_REQUIRED',
      message: 'Enter your password to confirm this change.',
    });
    return false;
  }
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ success: false, message: 'That password is not correct.' });
    return false;
  }
  return true;
};

/* ----------------------------------------------------------- passkeys ---- */

/** GET /api/auth/2fa/passkeys */
exports.listPasskeys = async (req, res) => {
  try {
    const passkeys = await Passkey.find({ user: req.user._id }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: passkeys.map((p) => p.toPublic()) });
  } catch (error) {
    return sendError(res, error, 'Could not list your passkeys');
  }
};

/** POST /api/auth/2fa/passkeys/options */
exports.passkeyRegisterOptions = async (req, res) => {
  try {
    const options = await webauthn.registrationOptions(req.user, req);
    return res.status(200).json({ success: true, data: options });
  } catch (error) {
    return sendError(res, error, 'Could not start passkey setup');
  }
};

/** POST /api/auth/2fa/passkeys - { response, name } */
exports.passkeyRegister = async (req, res) => {
  try {
    const result = await webauthn.verifyRegistration(req.user, req.body.response, req, req.body.name);
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });

    await twoFactor.syncEnabledFlag(req.user._id);
    const record = await twoFactor.recordFor(req.user._id, { create: true });
    const recoveryCodes = record.unusedRecoveryCount() === 0
      ? await twoFactor.regenerateRecoveryCodes(req.user._id)
      : null;

    return res.status(201).json({
      success: true,
      message: `${result.passkey.name} registered.`,
      data: { passkey: result.passkey, recoveryCodes, status: await twoFactor.describe(req.user) },
    });
  } catch (error) {
    return sendError(res, error, 'Could not register that device');
  }
};

/** PATCH /api/auth/2fa/passkeys/:id - { name } */
exports.renamePasskey = async (req, res) => {
  try {
    const passkey = await Passkey.findOne({ _id: req.params.id, user: req.user._id });
    if (!passkey) return res.status(404).json({ success: false, message: 'Passkey not found.' });
    passkey.name = String(req.body.name || '').trim().slice(0, 60) || passkey.name;
    await passkey.save();
    return res.status(200).json({ success: true, data: passkey.toPublic() });
  } catch (error) {
    return sendError(res, error, 'Could not rename that passkey');
  }
};

/** DELETE /api/auth/2fa/passkeys/:id - { password } */
exports.deletePasskey = async (req, res) => {
  try {
    if (!(await confirmPassword(req, res))) return undefined;

    const passkey = await Passkey.findOne({ _id: req.params.id, user: req.user._id });
    if (!passkey) return res.status(404).json({ success: false, message: 'Passkey not found.' });

    const remaining = await Passkey.countDocuments({ user: req.user._id });
    if (remaining === 1 && !(await canRemoveMethod(req.user, 'passkey'))) {
      return res.status(400).json({
        success: false,
        message: 'This is your only second factor, and your account is required to have one. Add an authenticator app or email codes first.',
      });
    }

    await passkey.deleteOne();
    await twoFactor.syncEnabledFlag(req.user._id);
    return res.status(200).json({
      success: true,
      message: 'Passkey removed.',
      data: { status: await twoFactor.describe(req.user) },
    });
  } catch (error) {
    return sendError(res, error, 'Could not remove that passkey');
  }
};

/* Shared with auth.controller for the password step of login */
exports.signChallenge = signChallenge;
exports.readChallenge = readChallenge;
exports.digestFor = digest;
exports.safeEqual = safeEqual;
