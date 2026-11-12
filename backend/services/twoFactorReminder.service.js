const User = require('../models/User.model');
const { notify } = require('./inAppNotification.service');

/**
 * Telling people their account needs a second factor, before the day it
 * starts refusing them.
 *
 * Without this the only place the deadline appears is Settings -> Two-step
 * verification, which nobody opens unprompted. The first a user would hear
 * of it is being locked out mid-task on day eight, which is both a support
 * problem and the fastest way to make people resent a security control.
 *
 * Four notices, each sent once: when the clock starts, three days out, one
 * day out, and when it has run out. The stage is recorded on the user, so
 * restarting the server does not re-send and two instances cannot double up.
 */

const CHECK_EVERY = 60 * 60 * 1000; // hourly is plenty for a daily countdown
const DAY = 24 * 60 * 60 * 1000;

const STAGES = {
  1: {
    title: 'Set up two-step verification',
    message: (days) => `Your account will need a second sign-in step. You have ${days} day${days === 1 ? '' : 's'} to set it up - a fingerprint, an authenticator app or emailed codes all work.`,
    email: true,
  },
  2: {
    title: 'Three days left to set up two-step verification',
    message: () => 'After that you will not be able to sign in until you add one. It takes about a minute.',
    email: true,
  },
  3: {
    title: 'Last day to set up two-step verification',
    message: () => 'From tomorrow you will be asked to set this up before you can use the system.',
    email: true,
  },
  4: {
    title: 'Two-step verification is now required',
    message: () => 'Add a second sign-in step to carry on using the system. Your work is not affected - you just need to finish this first.',
    email: false, // they see the gate itself at this point; another mail is noise
  },
};

/**
 * Which notice is due for an account, from how long is left.
 * Returns 0 when nothing should be sent.
 */
const stageFor = (requiredSince, graceDays) => {
  if (!requiredSince) return 0;
  const msLeft = new Date(requiredSince).getTime() + graceDays * DAY - Date.now();
  const daysLeft = Math.ceil(msLeft / DAY);

  if (msLeft <= 0) return 4;
  if (daysLeft <= 1) return 3;
  if (daysLeft <= 3) return 2;
  return 1;
};

const daysLeftFor = (requiredSince, graceDays) => Math.max(
  0,
  Math.ceil((new Date(requiredSince).getTime() + graceDays * DAY - Date.now()) / DAY),
);

const sendReminders = async () => {
  const { isRequiredFor } = require('./twoFactor.service');
  const graceDays = (() => {
    const raw = Number(process.env.TWOFA_GRACE_DAYS);
    return Number.isFinite(raw) && raw >= 0 ? raw : 7;
  })();

  // Only accounts that have actually been told the clock started: the field
  // is set the first time enrolmentStatus runs for them.
  const pending = await User.find({
    isActive: true,
    twoFactorEnabled: false,
    twoFactorRequiredSince: { $ne: null },
  }).select('email firstName role twoFactorRequiredSince twoFactorReminderStage');

  let sent = 0;

  for (const user of pending) {
    if (!isRequiredFor(user)) continue;

    const stage = stageFor(user.twoFactorRequiredSince, graceDays);
    if (stage === 0 || stage <= (user.twoFactorReminderStage || 0)) continue;

    const notice = STAGES[stage];
    const daysLeft = daysLeftFor(user.twoFactorRequiredSince, graceDays);

    await notify([user._id], {
      type: 'account',
      title: notice.title,
      message: notice.message(daysLeft),
      link: '/settings?tab=twofactor',
      metadata: { kind: 'twofactor-reminder', stage, daysLeft },
      preference: null, // a sign-in requirement is not an opt-out preference
    });

    if (notice.email) {
      try {
        const { sendTwoFactorSetupReminder } = require('./emailService');
        await sendTwoFactorSetupReminder(user.email, user.firstName, daysLeft);
      } catch (err) {
        // The in-app notice is the one that matters; e-mail is a courtesy
        console.error('Two-factor reminder email failed:', err.message);
      }
    }

    // Recorded after sending, so a crash mid-send repeats rather than skips
    await User.updateOne({ _id: user._id }, { twoFactorReminderStage: stage });
    sent += 1;
  }

  return sent;
};

let timer = null;
let running = false;

const startTwoFactorReminderWatcher = () => {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    sendReminders()
      .then((n) => { if (n) console.log(`🔐 Sent ${n} two-factor setup reminder(s)`); })
      .catch((e) => console.error('Two-factor reminders failed:', e.message))
      .finally(() => { running = false; });
  };
  timer = setInterval(tick, CHECK_EVERY);
  timer.unref?.();
  setTimeout(tick, 30 * 1000).unref?.();
};

module.exports = { startTwoFactorReminderWatcher, sendReminders, stageFor, daysLeftFor };
