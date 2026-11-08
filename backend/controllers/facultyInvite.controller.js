const crypto = require('crypto');
const FacultyInvite = require('../models/FacultyInvite.model');
const Program = require('../models/Program.model');
const { sendError } = require('../middleware/error.middleware');
const { managerProgram } = require('../utils/programScope');

const MIN_MINUTES = 30;
const MAX_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

const shape = (invite, now = new Date()) => {
  const obj = invite.toObject ? invite.toObject() : invite;
  const status = invite.status ? invite.status(now) : obj.status;
  return {
    _id: obj._id,
    code: obj.code,
    program: obj.program,
    note: obj.note,
    expiresAt: obj.expiresAt,
    maxUses: obj.maxUses,
    uses: obj.uses,
    signups: (obj.signups || []).map(({ name, email, at }) => ({ name, email, at })),
    createdAt: obj.createdAt,
    createdBy: obj.createdBy && obj.createdBy.firstName
      ? `${obj.createdBy.firstName} ${obj.createdBy.lastName}`.trim()
      : undefined,
    revokedAt: obj.revokedAt,
    status,
  };
};

// @desc    Invite links (a program manager sees their own program's)
// @route   GET /api/faculty-invites?program=
// @access  Staff
exports.listInvites = async (req, res) => {
  try {
    const own = managerProgram(req);
    const filter = {};
    if (own) filter.program = own;
    else if (req.query.program) filter.program = String(req.query.program).toUpperCase();
    // Recent history only: cancelled/expired links older than 30 days drop off
    filter.$or = [{ expiresAt: { $gt: new Date(Date.now() - 30 * DAY) } }, { revokedAt: null, expiresAt: { $gt: new Date() } }];

    const invites = await FacultyInvite.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(100);
    const now = new Date();
    const data = invites.map((i) => shape(i, now));
    res.json({ success: true, data, active: data.filter((i) => i.status === 'active').length });
  } catch (error) {
    sendError(res, error, 'Error loading invite links');
  }
};

// @desc    Create an invite link for a program, valid until a chosen date
// @route   POST /api/faculty-invites  { program, expiresAt, maxUses?, note? }
// @access  Staff (program managers: their own program)
exports.createInvite = async (req, res) => {
  try {
    const own = managerProgram(req);
    const program = String(own || req.body.program || '').toUpperCase().trim();
    if (!program) {
      return res.status(400).json({ success: false, message: 'Choose the program these teachers will join' });
    }
    if (own && req.body.program && String(req.body.program).toUpperCase() !== own) {
      return res.status(403).json({ success: false, message: `You can only invite faculty to ${own}` });
    }
    if (!(await Program.exists({ code: program }))) {
      return res.status(400).json({ success: false, message: `${program} is not a program` });
    }

    const expiresAt = new Date(req.body.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Choose when the link expires' });
    }
    const ms = expiresAt.getTime() - Date.now();
    if (ms < MIN_MINUTES * 60 * 1000) {
      return res.status(400).json({ success: false, message: `The expiry must be at least ${MIN_MINUTES} minutes from now` });
    }
    if (ms > MAX_DAYS * DAY) {
      return res.status(400).json({ success: false, message: `A link can last at most ${MAX_DAYS} days` });
    }

    let maxUses = null;
    if (req.body.maxUses !== undefined && req.body.maxUses !== null && req.body.maxUses !== '') {
      maxUses = parseInt(req.body.maxUses, 10);
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500) {
        return res.status(400).json({ success: false, message: 'Sign-up limit must be between 1 and 500, or empty for no limit' });
      }
    }

    const invite = await FacultyInvite.create({
      code: crypto.randomBytes(18).toString('base64url'),
      program,
      note: String(req.body.note || '').slice(0, 120),
      createdBy: req.user._id,
      expiresAt,
      maxUses,
    });
    await invite.populate('createdBy', 'firstName lastName');
    res.status(201).json({ success: true, message: 'Invite link created', data: shape(invite) });
  } catch (error) {
    sendError(res, error, 'Error creating invite link');
  }
};

// @desc    Cancel a link; it stops working at once
// @route   DELETE /api/faculty-invites/:id
// @access  Staff (program managers: their own program)
exports.revokeInvite = async (req, res) => {
  try {
    const invite = await FacultyInvite.findById(req.params.id);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite link not found' });
    const own = managerProgram(req);
    if (own && invite.program !== own) {
      return res.status(403).json({ success: false, message: `You can only manage ${own} invite links` });
    }
    if (!invite.revokedAt) {
      invite.revokedAt = new Date();
      invite.revokedBy = req.user._id;
      await invite.save();
    }
    res.json({ success: true, message: 'Invite link cancelled', data: shape(invite) });
  } catch (error) {
    sendError(res, error, 'Error cancelling invite link');
  }
};
