const mongoose = require('mongoose');

/**
 * A user's second-factor enrolment.
 *
 * Deliberately a separate collection rather than fields on User. Dozens of
 * handlers answer with a user record, and only one of them has to forget a
 * `.select()` for a TOTP seed to end up in a JSON response. Nothing here is
 * ever populated onto a user, so that mistake cannot be made.
 *
 * Passkeys live in their own collection again (Passkey.model.js), because
 * there can be several per account.
 */

const RecoveryCodeSchema = new mongoose.Schema({
  // SHA-256 of the code. The plaintext is shown once, at generation, and
  // never stored - same reasoning as a password.
  hash: { type: String, required: true },
  usedAt: { type: Date, default: null },
  usedIp: { type: String, default: null },
}, { _id: false });

const TwoFactorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },

  // --- authenticator app -------------------------------------------------
  // AES-256-GCM via utils/secretBox; the server must read this back to check
  // a code, so it cannot be hashed.
  totpSecret: { type: String, default: '' },
  // Set only once the first correct code proves the app is really enrolled
  totpEnabledAt: { type: Date, default: null },
  // The step already accepted, so a code cannot be replayed within its window
  totpLastStep: { type: Number, default: 0 },

  // --- emailed code ------------------------------------------------------
  emailEnabled: { type: Boolean, default: false },

  // --- recovery ----------------------------------------------------------
  recoveryCodes: { type: [RecoveryCodeSchema], default: [] },
  recoveryGeneratedAt: { type: Date, default: null },

  // --- bookkeeping -------------------------------------------------------
  lastVerifiedAt: { type: Date, default: null },
  lastVerifiedMethod: { type: String, default: null },
}, { timestamps: true });

/** Methods the account can actually complete a sign-in with, right now. */
TwoFactorSchema.methods.availableMethods = function availableMethods() {
  return {
    totp: !!this.totpEnabledAt,
    email: !!this.emailEnabled,
    recovery: this.recoveryCodes.some((c) => !c.usedAt),
  };
};

TwoFactorSchema.methods.unusedRecoveryCount = function unusedRecoveryCount() {
  return this.recoveryCodes.filter((c) => !c.usedAt).length;
};

module.exports = mongoose.model('TwoFactor', TwoFactorSchema);
