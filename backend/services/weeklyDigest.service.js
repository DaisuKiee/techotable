/**
 * Weekly summary email (Settings > Notifications > Weekly summary).
 *
 * Every Monday from 7 AM Manila time, each user who turned it on gets one
 * email listing the past week's notifications. `lastDigestAt` keeps it to
 * one a week even across server restarts.
 */

const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { sendEmail } = require('./emailNotification.service');

const DAY = 24 * 60 * 60 * 1000;
const CHECK_EVERY = 60 * 60 * 1000; // hourly
const APP_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';

const TYPE_LABELS = {
  schedule: 'Schedule changes',
  announcement: 'Announcements',
  material: 'Class materials',
  enrollment: 'Enrollment',
  account: 'Account',
  system: 'System',
};

/** Monday, 7 AM or later, in the Philippines. */
const isDigestTime = (now = new Date()) => {
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manila.getDay() === 1 && manila.getHours() >= 7;
};

const escapeHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const buildHtml = (user, items) => {
  const counts = items.reduce((acc, n) => ({ ...acc, [n.type]: (acc[n.type] || 0) + 1 }), {});
  const unread = items.filter((n) => !n.isRead).length;
  const rows = items.slice(0, 15).map((n) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">
        <div style="font-weight:600;color:#111">${escapeHtml(n.title)}</div>
        <div style="color:#555;font-size:13px">${escapeHtml(n.message)}</div>
        <div style="color:#999;font-size:12px">${new Date(n.createdAt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
      </td>
    </tr>`).join('');
  const summary = Object.entries(counts).map(([t, c]) => `${c} ${TYPE_LABELS[t] || t}`).join(' · ');

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
    <div style="background:#1d4ed8;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0">Your week at CTU Daanbantayan</h2>
    </div>
    <div style="padding:20px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
      <p>Hi ${escapeHtml(user.firstName)}, here's what happened this week.</p>
      <p style="background:#f3f4f6;padding:10px 12px;border-radius:6px">
        <strong>${items.length} notification${items.length === 1 ? '' : 's'}</strong>${unread ? `, ${unread} unread` : ''}<br>
        <span style="color:#555;font-size:13px">${summary}</span>
      </p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      ${items.length > 15 ? `<p style="color:#555;font-size:13px">…and ${items.length - 15} more.</p>` : ''}
      <p><a href="${APP_URL}/dashboard" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Open the timetable</a></p>
      <p style="color:#999;font-size:12px">You get this because Weekly summary is on in Settings &gt; Notifications.</p>
    </div>
  </div>`;
};

/** Send the digest to everyone who's due one. Returns how many were sent. */
const sendDigests = async (now = new Date()) => {
  const users = await User.find({
    isActive: { $ne: false },
    'settings.notifications.weeklyDigest': true,
    'settings.notifications.emailNotifications': { $ne: false },
    $or: [
      { 'settings.notifications.lastDigestAt': null },
      { 'settings.notifications.lastDigestAt': { $lt: new Date(now.getTime() - 6 * DAY) } },
    ],
  }).select('email firstName').lean();

  let sent = 0;
  for (const user of users) {
    const items = await Notification.find({ recipient: user._id, createdAt: { $gte: new Date(now.getTime() - 7 * DAY) } })
      .sort({ createdAt: -1 }).limit(100).lean();
    // Nothing happened: no email, but count the week as done
    if (items.length) {
      const result = await sendEmail(user.email, `Your weekly summary: ${items.length} update${items.length === 1 ? '' : 's'}`, buildHtml(user, items));
      if (!result.success) continue; // try again next hour
      sent += 1;
    }
    await User.updateOne({ _id: user._id }, { 'settings.notifications.lastDigestAt': now });
  }
  return sent;
};

let timer = null;

const startDigestWatcher = () => {
  if (timer) return;
  const tick = () => {
    if (!isDigestTime()) return;
    sendDigests().then((n) => { if (n) console.log(`📬 Weekly summary sent to ${n} user(s)`); })
      .catch((e) => console.error('Weekly summary failed:', e.message));
  };
  timer = setInterval(tick, CHECK_EVERY);
  timer.unref?.();
  setTimeout(tick, 30 * 1000).unref?.();
};

module.exports = { startDigestWatcher, sendDigests, isDigestTime, buildHtml };
