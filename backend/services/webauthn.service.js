const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const Passkey = require('../models/Passkey.model');
const AuthChallenge = require('../models/AuthChallenge.model');
const { clientIp } = require('../utils/device');

/**
 * Passkeys: fingerprint, face or a hardware key, via WebAuthn.
 *
 * The browser signs a challenge with a private key that never leaves the
 * device, and the signature is bound by the browser to this exact origin.
 * That is what makes it phishing-proof - a lookalike domain cannot get a
 * signature the real server will accept, no matter how convincing it is.
 *
 * Two things must be configured correctly or nothing works:
 *   rpID     the registrable domain, e.g. technotabler.cebutech.digital
 *            (no scheme, no port, and it must match the page's domain)
 *   origin   the full origin the SPA is served from
 * Both are derived from FRONTEND_URL so there is one thing to set.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Every origin the SPA is legitimately served from. */
const allowedOrigins = () => {
  const list = [
    process.env.FRONTEND_URL,
    process.env.WEBAUTHN_ORIGIN,
    'https://technotabler.cebutech.digital',
    'https://time-table-ivory.vercel.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
  ].filter(Boolean).map((u) => String(u).replace(/\/$/, ''));
  return [...new Set(list)];
};

/**
 * The relying-party id. WebAuthn requires this to be the page's domain or a
 * parent of it, so it is taken from the configured frontend rather than
 * guessed from the request - a request header would let an attacker who can
 * reach the API choose the domain a credential is bound to.
 */
const rpID = () => {
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
  const url = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    return new URL(url).hostname;
  } catch (_) {
    return 'localhost';
  }
};

const rpName = () => process.env.TWOFA_ISSUER || 'CTU Daanbantayan Timetabling';

const saveChallenge = async (kind, { user, challenge, sessionKey, req }) => {
  await AuthChallenge.deleteMany({ kind, ...(user ? { user } : { sessionKey }) });
  await AuthChallenge.create({
    kind,
    user: user || null,
    value: challenge,
    sessionKey: sessionKey || null,
    ip: clientIp(req),
    userAgent: String(req.headers?.['user-agent'] || '').slice(0, 400),
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
};

const takeChallenge = async (kind, { user, sessionKey }) => {
  const query = { kind, consumedAt: null, expiresAt: { $gt: new Date() } };
  if (user) query.user = user;
  if (sessionKey) query.sessionKey = sessionKey;
  const found = await AuthChallenge.findOne(query).sort({ createdAt: -1 });
  if (!found) return null;
  // One challenge, one use - this is what stops a captured assertion being
  // replayed later.
  found.consumedAt = new Date();
  await found.save();
  return found.value;
};

/* ------------------------------------------------------------ registration */

/** Options for enrolling a new passkey on the device making this request. */
const registrationOptions = async (user, req) => {
  const existing = await Passkey.find({ user: user._id }).select('credentialId transports');

  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpID(),
    // A stable, non-guessable handle. Not the e-mail: the user handle is
    // stored on the authenticator and may be shown by the OS.
    userID: Buffer.from(String(user._id)),
    userName: user.email,
    userDisplayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    attestationType: 'none', // we don't need to know the make of the device
    // Stops the same device enrolling twice and confusing the person later
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',      // enables signing in without typing an e-mail
      userVerification: 'required',  // the biometric or PIN prompt is the point
    },
  });

  await saveChallenge('webauthn-register', { user: user._id, challenge: options.challenge, req });
  return options;
};

/** Verify what the authenticator returned and store the credential. */
const verifyRegistration = async (user, response, req, name) => {
  const expectedChallenge = await takeChallenge('webauthn-register', { user: user._id });
  if (!expectedChallenge) {
    return { ok: false, message: 'That setup attempt expired. Start again.' };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: true,
    });
  } catch (err) {
    return { ok: false, message: `This device could not be registered: ${err.message}` };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, message: 'This device could not be registered.' };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // A credential id is globally unique; if it is already on another account
  // something is wrong, and silently moving it would be worse.
  const clash = await Passkey.findOne({ credentialId: credential.id });
  if (clash) {
    return String(clash.user) === String(user._id)
      ? { ok: false, message: 'That device is already registered on this account.' }
      : { ok: false, message: 'That device is already registered to a different account.' };
  }

  const passkey = await Passkey.create({
    user: user._id,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter || 0,
    transports: credential.transports || response.response?.transports || [],
    deviceType: credentialDeviceType,
    backedUp: !!credentialBackedUp,
    name: (name && String(name).trim().slice(0, 60)) || defaultName(req),
  });

  return { ok: true, passkey: passkey.toPublic() };
};

/** "Chrome on Windows" reads better in a device list than "Passkey". */
const defaultName = (req) => {
  const { describeDevice } = require('../utils/device');
  const described = describeDevice(String(req.headers?.['user-agent'] || ''));
  if (typeof described === 'string' && described.trim()) return described.slice(0, 60);
  if (described && described.label) return String(described.label).slice(0, 60);
  if (described && (described.browser || described.os)) {
    return [described.browser, described.os].filter(Boolean).join(' on ').slice(0, 60);
  }
  return 'Passkey';
};

/* ---------------------------------------------------------- authentication */

/**
 * Options for signing in with a passkey.
 *
 * With no user, this is a passwordless sign-in: no credentials are listed,
 * the browser offers whatever it holds for this site, and the account is
 * identified by the credential that answers. `sessionKey` ties the challenge
 * to this browser, since there is no account to tie it to yet.
 */
const authenticationOptions = async ({ user, sessionKey, req }) => {
  const credentials = user
    ? await Passkey.find({ user: user._id }).select('credentialId transports')
    : [];

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: 'required',
    allowCredentials: user
      ? credentials.map((c) => ({ id: c.credentialId, transports: c.transports }))
      : undefined,
  });

  await saveChallenge('webauthn-login', {
    user: user ? user._id : null,
    sessionKey: user ? null : sessionKey,
    challenge: options.challenge,
    req,
  });

  return options;
};

/**
 * Verify an assertion. Returns the Passkey (with .user) on success, so the
 * caller can both identify the account and start its session.
 */
const verifyAuthentication = async ({ response, user, sessionKey, req }) => {
  const expectedChallenge = await takeChallenge('webauthn-login', {
    user: user ? user._id : null,
    sessionKey: user ? null : sessionKey,
  });
  if (!expectedChallenge) {
    return { ok: false, message: 'That sign-in attempt expired. Try again.' };
  }

  const passkey = await Passkey.findOne({ credentialId: response.id });
  if (!passkey) {
    return { ok: false, message: 'That device is not registered for this site.' };
  }
  if (user && String(passkey.user) !== String(user._id)) {
    return { ok: false, message: 'That device belongs to a different account.' };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });
  } catch (err) {
    return { ok: false, message: `That device could not be verified: ${err.message}` };
  }

  if (!verification.verified) {
    return { ok: false, message: 'That device could not be verified.' };
  }

  /**
   * A counter that did not advance means either an authenticator that does
   * not implement counters (common, and fine) or a cloned credential. We can
   * only tell them apart when the stored counter was already non-zero.
   */
  const { newCounter } = verification.authenticationInfo;
  if (passkey.counter > 0 && newCounter <= passkey.counter) {
    return { ok: false, message: 'This passkey looks like it has been copied. Remove it and register the device again.' };
  }

  passkey.counter = newCounter;
  passkey.lastUsedAt = new Date();
  passkey.lastUsedIp = clientIp(req);
  await passkey.save();

  return { ok: true, passkey };
};

module.exports = {
  rpID,
  allowedOrigins,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
};
