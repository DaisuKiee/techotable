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

/** Monday, 7 AM or later, in the Philippines. */
const isDigestTime = (now = new Date()) => {
  const manila = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return manila.getDay() === 1 && manila.getHours() >= 7;
};

const T = require('./emailTemplates');

/** Group label + tone per notification type. */
const TYPE_LOOK = {
  schedule: { label: 'Schedule', tone: 'warning' },
  announcement: { label: 'Announcement', tone: 'info' },
  material: { label: 'Material', tone: 'info' },
  enrollment: { label: 'Enrollment', tone: 'info' },
  account: { label: 'Account', tone: 'success' },
  system: { label: 'System', tone: 'neutral' },
};
const lookOf = (n) => {
  const base = TYPE_LOOK[n.type] || TYPE_LOOK.system;
  const kind = n.metadata?.kind;
  if (n.type === 'schedule' && kind === 'published') return { ...base, tone: 'success' };
  if (n.type === 'schedule' && kind === 'removed') return { ...base, tone: 'danger' };
  if (n.type === 'schedule' && ['created', 'generated', 'class_reminder', 'today_classes'].includes(kind)) return { ...base, tone: 'info' };
  return base;
};

const SHOW = 12;

/** The Monday summary email: counts, then the latest items. */
const buildEmail = (user, items) => {
  const counts = items.reduce((acc, n) => ({ ...acc, [n.type]: (acc[n.type] || 0) + 1 }), {});
  const unread = items.filter((n) => !n.isRead).length;
  const fmtDay = (d) => new Date(d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

  // Three stat tiles: total, unread, top category
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const tile = (value, label, color, pad) => `
    <td width="33%" style="padding:${pad};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${T.C.line};border-radius:10px;border-collapse:separate;">
        <tr><td align="center" style="padding:14px 8px;font-family:${T.FONT};">
          <div style="font-size:24px;font-weight:800;color:${color};line-height:1.1;">${T.esc(value)}</div>
          <div style="margin-top:4px;font-size:12px;color:${T.C.muted};">${T.esc(label)}</div>
        </td></tr>
      </table>
    </td>`;
  const tiles = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${tile(items.length, items.length === 1 ? 'update' : 'updates', T.C.ink, '0 6px 0 0')}
        ${tile(unread, 'unread', unread ? '#ea580c' : '#059669', '0 3px')}
        ${tile(top ? top[1] : 0, top ? (TYPE_LOOK[top[0]]?.label || top[0]).toLowerCase() : 'updates', '#2563eb', '0 0 0 6px')}
      </tr>
    </table>`;

  const rows = items.slice(0, SHOW).map((n, i) => {
    const look = lookOf(n);
    const [strong, soft, onSoft] = T.toneOf(look.tone);
    return `
      <tr>
        <td style="padding:12px 0;${i ? `border-top:1px solid ${T.C.line};` : ''}width:8px;vertical-align:top;">
          <div style="width:8px;height:8px;margin-top:6px;border-radius:50%;background:${n.isRead ? T.C.line : strong};">&nbsp;</div>
        </td>
        <td style="padding:12px 0 12px 12px;${i ? `border-top:1px solid ${T.C.line};` : ''}font-family:${T.FONT};vertical-align:top;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${soft};font-size:11px;font-weight:700;color:${onSoft};">${T.esc(look.label)}</span>
          <span style="font-size:12px;color:${T.C.faint};">&nbsp;${T.esc(fmtDay(n.createdAt))}</span>
          <p style="margin:6px 0 0;font-size:14px;font-weight:${n.isRead ? 500 : 700};color:${T.C.ink};">${T.esc(n.title)}</p>
          <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:${T.C.muted};">${T.esc(n.message)}</p>
        </td>
      </tr>`;
  }).join('');

  const body = [
    T.paragraph('Here’s what happened in your classes and account over the past 7 days.'),
    tiles,
    T.sectionTitle('Latest'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`,
    items.length > SHOW
      ? `<p style="margin:10px 0 0;font-family:${T.FONT};font-size:13px;color:${T.C.muted};">…and ${items.length - SHOW} more in the app.</p>`
      : '',
  ].join('');

  const summary = Object.entries(counts).map(([t, c]) => `${c} ${(TYPE_LOOK[t]?.label || t).toLowerCase()}`).join(', ');

  return T.renderEmail({
    subject: `Your week: ${items.length} update${items.length === 1 ? '' : 's'}${unread ? `, ${unread} unread` : ''}`,
    preheader: summary,
    tone: 'info',
    eyebrow: 'Weekly summary',
    title: 'Your week at CTU Daanbantayan',
    greeting: `Hi ${user.firstName || 'there'},`,
    body,
    textBody: [
      `Past 7 days: ${items.length} update${items.length === 1 ? '' : 's'}${unread ? `, ${unread} unread` : ''} (${summary}).`,
      '',
      ...items.slice(0, SHOW).map((n) => `- [${lookOf(n).label}] ${n.title}: ${n.message} (${fmtDay(n.createdAt)})`),
      items.length > SHOW ? `…and ${items.length - SHOW} more in the app.` : null,
    ].filter((l) => l !== null).join('\n'),
    cta: { label: 'Open the timetable', url: T.url('/dashboard') },
    reason: 'You get this every Monday because “Weekly summary” is on in your notification settings.',
    manageLink: true,
  });
};

/** HTML only, kept for older callers. */
const buildHtml = (user, items) => buildEmail(user, items).html;

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
      const result = await sendEmail(user.email, buildEmail(user, items), null);
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

module.exports = { startDigestWatcher, sendDigests, isDigestTime, buildHtml, buildEmail };
