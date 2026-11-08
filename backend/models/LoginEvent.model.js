const mongoose = require('mongoose');

/** One sign-in attempt, kept for 90 days for the user's sign-in history. */
const LoginEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  email: { type: String, lowercase: true, trim: true },
  success: { type: Boolean, required: true },
  // ok | bad_password | locked | inactive | unverified | no_account
  reason: { type: String, default: 'ok' },
  device: { type: String, default: 'Unknown device' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
}, { timestamps: true });

LoginEventSchema.index({ user: 1, createdAt: -1 });
LoginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('LoginEvent', LoginEventSchema);
