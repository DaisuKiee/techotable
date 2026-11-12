const mongoose = require('mongoose');

/**
 * Short-lived server-side state for a sign-in that is half finished:
 * a WebAuthn challenge waiting to be signed, or an emailed code waiting to
 * be typed.
 *
 * Why not keep it in the token the client holds? Because the server has to
 * be able to count attempts and burn the challenge after one use. A value
 * the client carries can be replayed; a row can be deleted.
 *
 * Mongo expires these automatically, so a challenge that is never completed
 * disappears on its own rather than accumulating.
 */

const AuthChallengeSchema = new mongoose.Schema({
  // 'webauthn-register' | 'webauthn-login' | 'email-code'
  kind: { type: String, required: true, index: true },

  // Absent for a passwordless passkey sign-in, where the account is not
  // known until the authenticator answers
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

  // The WebAuthn challenge (base64url), or the SHA-256 of an emailed code.
  // Codes are hashed for the same reason passwords are: a database read
  // should not hand over a working second factor.
  value: { type: String, required: true },

  // Ties a challenge to the browser that asked for it
  sessionKey: { type: String, default: null, index: true },

  attempts: { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },

  ip: { type: String, default: null },
  userAgent: { type: String, default: null },

  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Mongo removes the document once expiresAt passes
AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthChallenge', AuthChallengeSchema);
