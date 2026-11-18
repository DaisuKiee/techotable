const User = require('../models/User.model');
const { notify } = require('./inAppNotification.service');

/**
 * A one-time nudge to set up two-step verification.
 *
 * Two-step verification is recommended, not required: there is no deadline and
 * no lock-out. The standing reminder is the on-page banner; this sends a single
 * courtesy notice (and email) to each account that could add a second factor
 * but hasn't, so it isn't only discoverable by opening Settings. The reminder
 * stage is recorded on the user so it is sent once and two instances can't
 * double up.
 */

const CHECK_EVERY = 6 * 60 * 60 * 1000; // a gentle reminder doesn't need to be frequent

const REMINDER = {
  title: 'Secure your account with two-step verification',
  message:
    'Add a second sign-in step — a fingerprint, an authenticator app or emailed '
    + 'codes. It takes about a minute and keeps your account safer. You can set '
    + 'it up any time in Settings.',
};

const sendReminders = async () => {
  const { isRequiredFor } = require('./twoFactor.service');

  // Accounts that could add a second factor but haven't, and haven't been
  // reminded yet. No deadline, no lock-out — a single courtesy nudge.
  const pending = await User.find({
    isActive: true,
    twoFactorEnabled: false,
    $or: [
      { twoFactorReminderStage: { $exists: false } },
      { twoFactorReminderStage: null },
      { twoFactorReminderStage: { $lt: 1 } },
    ],
  }).select('email firstName role twoFactorReminderStage');

  let sent = 0;

  for (const user of pending) {
    if (!isRequiredFor(user)) continue;

    await notify([user._id], {
      type: 'account',
      title: REMINDER.title,
      message: REMINDER.message,
      link: '/settings?tab=twofactor',
      metadata: { kind: 'twofactor-reminder' },
      preference: null,
    });

    try {
      const { sendTwoFactorSetupReminder } = require('./emailService');
      await sendTwoFactorSetupReminder(user.email, user.firstName);
    } catch (err) {
      // The in-app notice is the one that matters; e-mail is a courtesy.
      console.error('Two-factor reminder email failed:', err.message);
    }

    // Recorded after sending, so a crash mid-send repeats rather than skips.
    await User.updateOne({ _id: user._id }, { twoFactorReminderStage: 1 });
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

module.exports = { startTwoFactorReminderWatcher, sendReminders };
