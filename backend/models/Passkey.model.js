const mongoose = require('mongoose');

/**
 * One WebAuthn credential: a fingerprint or face on a phone or laptop
 * (Windows Hello, Touch ID, Android biometrics) or a hardware key.
 *
 * What makes a passkey worth the work is that the private half never leaves
 * the device and the signature is bound to this site's origin. A convincing
 * fake login page cannot collect anything reusable, which is the one attack
 * that still beats a careful person with a strong password.
 *
 * Nothing stored here is secret - the public key is public by design - but
 * the rows are still never returned raw, because the credential id
 * identifies a specific physical device the person owns.
 */

const PasskeySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // base64url credential id from the authenticator; unique across all users
  credentialId: { type: String, required: true, unique: true, index: true },

  // COSE public key bytes used to verify each assertion
  publicKey: { type: Buffer, required: true },

  /**
   * Signature counter. Authenticators that implement it increment on every
   * use, so a counter that goes backwards means the credential was cloned.
   * Many platform authenticators report 0 forever, which is allowed.
   */
  counter: { type: Number, default: 0 },

  // 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'
  transports: { type: [String], default: [] },

  // 'singleDevice' | 'multiDevice' - a synced passkey exists on more than one
  deviceType: { type: String, default: 'singleDevice' },
  backedUp: { type: Boolean, default: false },

  // What the person calls it in Settings, e.g. "Work laptop"
  name: { type: String, default: 'Passkey', trim: true, maxlength: 60 },

  lastUsedAt: { type: Date, default: null },
  lastUsedIp: { type: String, default: null },
}, { timestamps: true });

/** Safe to send to the browser: no credential id, no key material. */
PasskeySchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    deviceType: this.deviceType,
    backedUp: this.backedUp,
    transports: this.transports,
    createdAt: this.createdAt,
    lastUsedAt: this.lastUsedAt,
  };
};

module.exports = mongoose.model('Passkey', PasskeySchema);
