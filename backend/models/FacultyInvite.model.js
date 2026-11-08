const mongoose = require('mongoose');

/**
 * A faculty sign-up link for one program. Program managers hand these to
 * their own teachers; whoever signs up through one joins that program and is
 * approved by that program's manager (or the scheduling office).
 *
 * Stored, unlike the signed tokens it replaces, so links can be listed,
 * counted and cancelled before they expire.
 */
const FacultyInviteSchema = new mongoose.Schema({
  // The secret in the link (/faculty-signup?invite=<code>)
  code: { type: String, required: true, unique: true },
  program: { type: String, required: true, uppercase: true, trim: true, index: true },
  note: { type: String, trim: true, maxlength: 120, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  // null: any number of sign-ups until it expires
  maxUses: { type: Number, min: 1, default: null },
  uses: { type: Number, default: 0 },
  signups: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String,
    at: { type: Date, default: Date.now },
  }],
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

/** active | expired | revoked | used_up */
FacultyInviteSchema.methods.status = function status(now = new Date()) {
  if (this.revokedAt) return 'revoked';
  if (this.expiresAt <= now) return 'expired';
  if (this.maxUses && this.uses >= this.maxUses) return 'used_up';
  return 'active';
};

module.exports = mongoose.model('FacultyInvite', FacultyInviteSchema);
