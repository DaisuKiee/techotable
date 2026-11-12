/**
 * What a user record is allowed to look like once it leaves the server.
 *
 * Several handlers used to answer with `user.toObject()` minus `password`,
 * which still carried the e-mail verification token, the password-reset
 * token, the lockout counters and (now) the two-factor secrets. Anyone who
 * could read another account - an admin editing a user, or the account owner
 * through an XSS - got everything needed to take it over.
 *
 * Every endpoint that returns a user goes through here instead. The list is
 * a denylist on purpose: a new profile field should appear in the API by
 * default, while a new secret has to be added below, and the test in
 * tests/security.test.js fails loudly if a known secret ever escapes.
 */

/** Never leaves the server, for anybody, ever. */
const SECRET_FIELDS = [
  'password',
  'passwordResetToken',
  'passwordResetExpires',
  'emailVerificationToken',
  'emailVerificationExpires',
  'twoFactor',
  'pendingTwoFactor',
];

/** Internal bookkeeping: useful to the owner, meaningless or risky to others. */
const PRIVATE_FIELDS = [
  'failedLoginAttempts',
  'lockUntil',
  'tokensValidAfter',
  '__v',
];

/** A mongoose `.select()` string that leaves out every secret. */
const SAFE_SELECT = SECRET_FIELDS.map((f) => `-${f}`).join(' ');

const strip = (object, fields) => {
  fields.forEach((field) => { delete object[field]; });
  return object;
};

/**
 * `user` may be a mongoose document or a plain object.
 * Pass `{ self: true }` when the recipient is the account owner, which keeps
 * the harmless bookkeeping fields the Settings page shows.
 */
const publicUser = (user, { self = false } = {}) => {
  if (!user) return null;
  const plain = typeof user.toObject === 'function'
    ? user.toObject({ virtuals: true })
    : { ...user };

  strip(plain, SECRET_FIELDS);
  if (!self) strip(plain, PRIVATE_FIELDS);

  // The two-factor state the UI needs, without the secrets behind it
  if (user.twoFactor) {
    plain.twoFactorEnabled = !!user.twoFactor.enabled;
    if (self) {
      plain.twoFactorMethods = {
        totp: !!user.twoFactor.totpEnabledAt,
        email: !!user.twoFactor.emailEnabled,
        passkeys: Number(user.twoFactor.passkeyCount || 0),
        recoveryCodesLeft: Array.isArray(user.twoFactor.recoveryCodes)
          ? user.twoFactor.recoveryCodes.filter((c) => !c.usedAt).length
          : 0,
      };
    }
  } else {
    plain.twoFactorEnabled = false;
  }

  return plain;
};

/** Same treatment for a list. */
const publicUsers = (users, options) => (users || []).map((u) => publicUser(u, options));

module.exports = { publicUser, publicUsers, SAFE_SELECT, SECRET_FIELDS, PRIVATE_FIELDS };
