const mongoose = require('mongoose');

/**
 * One signed-in device. The login token carries this session's id (`sid`),
 * so a session can be ended on its own (Settings > Security) and logging
 * out really ends it instead of just forgetting the token in the browser.
 */
const SessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  device: { type: String, default: 'Unknown device' },
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  lastSeenAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
  // When the token itself expires; the record is cleaned up after that
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', SessionSchema);
