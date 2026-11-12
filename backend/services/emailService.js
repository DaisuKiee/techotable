/**
 * Account emails: verify your email, reset your password, welcome.
 * Same look as the notification emails (see emailTemplates.js).
 */

const crypto = require('crypto');
const T = require('./emailTemplates');
const { getTransport, envelope, inlineAssets } = require('./mailer');

/**
 * Print the message instead of sending it.
 *
 * Tests are included unconditionally: a test run that reaches a real SMTP
 * server mails real people, and a verification or two-factor code is exactly
 * the sort of thing that must never escape a test.
 */
const consoleMode = () => process.env.NODE_ENV === 'test'
  || (process.env.NODE_ENV === 'development' && process.env.EMAIL_CONSOLE_MODE === 'true');

/** Development: print the link instead of sending. */
const printLink = (heading, email, firstName, link, note) => {
  const line = '═'.repeat(63);
  console.log(`\n╔${line}╗`);
  console.log(`║  ${heading.padEnd(61)}║`);
  console.log(`╠${line}╣`);
  console.log(`║  To: ${String(email).padEnd(57)}║`);
  console.log(`║  Name: ${String(firstName || '').padEnd(55)}║`);
  console.log(`╠${line}╣`);
  console.log(`║  ${note.padEnd(61)}║`);
  console.log(`║  ${link}`);
  console.log(`╚${line}╝\n`);
  return { success: true, messageId: 'console-dev-mode' };
};

const send = async (email, rendered, label) => {
  try {
    const info = await getTransport().sendMail({
      ...envelope(),
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...inlineAssets(rendered.html),
    });
    console.log(`${label} email sent:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending ${label.toLowerCase()} email:`, error);
    return { success: false, error: error.message };
  }
};

// Generate verification token
const generateVerificationToken = () => crypto.randomBytes(32).toString('hex');

/* ---------------- Templates ---------------- */

const verificationEmail = (firstName, link) => T.renderEmail({
  subject: 'Verify your email – CTU Daanbantayan',
  preheader: 'One click to finish setting up your timetable account.',
  tone: 'info',
  eyebrow: 'Confirm your email',
  title: 'One last step',
  greeting: `Hi ${firstName || 'there'},`,
  body: [
    T.paragraph('Thanks for signing up for the CTU Daanbantayan Smart Timetabling System. Confirm that this is your email address to activate your account.'),
    T.callout('This link expires in 24 hours', 'Didn’t create an account? You can safely ignore this email.', 'neutral'),
  ].join(''),
  textBody: [
    'Thanks for signing up for the CTU Daanbantayan Smart Timetabling System.',
    'Confirm your email address to activate your account. The link expires in 24 hours.',
    '',
    'Didn’t create an account? You can safely ignore this email.',
  ].join('\n'),
  cta: { label: 'Verify my email', url: link },
  showLink: true,
});

const resetEmail = (firstName, link) => T.renderEmail({
  subject: 'Reset your password – CTU Daanbantayan',
  preheader: 'Use this link within 10 minutes to choose a new password.',
  tone: 'warning',
  eyebrow: 'Password reset',
  title: 'Reset your password',
  greeting: `Hi ${firstName || 'there'},`,
  body: [
    T.paragraph('We got a request to reset the password for your timetable account. Click the button to choose a new one.'),
    T.callout('This link expires in 10 minutes', 'If you didn’t ask for this, ignore this email; your password stays the same. If it keeps happening, change your password after you sign in.', 'warning'),
  ].join(''),
  textBody: [
    'We got a request to reset the password for your timetable account.',
    'Use the link below within 10 minutes to choose a new one.',
    '',
    'If you didn’t ask for this, ignore this email; your password stays the same.',
  ].join('\n'),
  cta: { label: 'Choose a new password', url: link },
  showLink: true,
});

const welcomeEmail = (firstName) => {
  const step = (n, title, text) => `
    <tr>
      <td width="36" style="padding:10px 0;vertical-align:top;">
        <div style="width:28px;height:28px;line-height:28px;border-radius:50%;background:#ecfdf5;color:#047857;text-align:center;font-family:${T.FONT};font-size:13px;font-weight:800;">${n}</div>
      </td>
      <td style="padding:10px 0 10px 8px;font-family:${T.FONT};vertical-align:top;">
        <p style="margin:0;font-size:14px;font-weight:700;color:${T.C.ink};">${T.esc(title)}</p>
        <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:${T.C.muted};">${T.esc(text)}</p>
      </td>
    </tr>`;
  return T.renderEmail({
    subject: 'Welcome to CTU Daanbantayan Timetabling',
    preheader: 'Your account is verified. Here’s how to get started.',
    tone: 'success',
    eyebrow: 'Email verified',
    title: 'Welcome aboard!',
    greeting: `Hi ${firstName || 'there'},`,
    body: [
      T.paragraph('Your email is verified and your account is ready. Here’s what you can do:'),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${step(1, 'See your timetable', 'Your classes for the week, with times, rooms and teachers, on any device.')}
        ${step(2, 'Join your class spaces', 'Announcements and materials from your teachers, all in one place.')}
        ${step(3, 'Turn on notifications', 'Get told right away when a class is added, moved or cancelled.')}
      </table>`,
    ].join(''),
    textBody: [
      'Your email is verified and your account is ready.',
      '',
      '1. See your timetable: your classes for the week, with times, rooms and teachers.',
      '2. Join your class spaces: announcements and materials from your teachers.',
      '3. Turn on notifications: get told when a class is added, moved or cancelled.',
    ].join('\n'),
    cta: { label: 'Go to my dashboard', url: T.url('/dashboard') },
  });
};

/* ---------------- Senders ---------------- */

/**
 * A sign-in code. Deliberately plain: no button and no link, because the
 * whole point of this message is that there is nothing in it to click. A
 * phishing mail that imitates it has to ask the reader to type the code
 * somewhere, which is a much harder sell than "click here".
 */
const twoFactorCodeEmail = (firstName, code, { minutes = 10, ip } = {}) => T.renderEmail({
  subject: `${code} is your sign-in code - CTU Daanbantayan`,
  preheader: `Your code is ${code}. It expires in ${minutes} minutes.`,
  tone: 'info',
  eyebrow: 'Sign-in verification',
  title: 'Your sign-in code',
  greeting: `Hi ${firstName || 'there'},`,
  body: [
    T.paragraph('Someone is signing in to your timetable account. Enter this code to finish:'),
    `<div style="margin:18px 0;text-align:center;font-family:${T.FONT};font-size:34px;letter-spacing:10px;font-weight:700;color:#111827;">${T.esc(code)}</div>`,
    T.callout(
      `This code expires in ${minutes} minutes`,
      `If you did not try to sign in${ip ? ` (the attempt came from ${T.esc(ip)})` : ''}, someone else has your password. Change it as soon as you can - do not share this code with anyone, including anyone claiming to be CTU staff.`,
      'warning',
    ),
  ].join(''),
  textBody: [
    'Someone is signing in to your timetable account.',
    '',
    `Your code is: ${code}`,
    `It expires in ${minutes} minutes.`,
    '',
    'If you did not try to sign in, someone else has your password - change it as soon as you can.',
    'Never share this code with anyone, including anyone claiming to be CTU staff.',
  ].join('\n'),
  showLink: false,
});

/**
 * The countdown, in the one place everyone actually looks. Unlike the code
 * email this one does carry a link, because the whole point is to get the
 * person to the setup screen.
 */
const twoFactorReminderEmail = (firstName, daysLeft) => {
  const urgent = daysLeft <= 1;
  const deadline = daysLeft <= 0
    ? 'Two-step verification is now required on your account'
    : `You have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  return T.renderEmail({
    subject: daysLeft <= 0
      ? 'Action needed: set up two-step verification - CTU Daanbantayan'
      : `${deadline} to set up two-step verification - CTU Daanbantayan`,
    preheader: `${deadline}. It takes about a minute.`,
    tone: urgent ? 'warning' : 'info',
    eyebrow: 'Account security',
    title: 'Set up two-step verification',
    greeting: `Hi ${firstName || 'there'},`,
    body: [
      T.paragraph('Your timetable account holds real schedules and student records, so a password on its own is no longer enough. Adding a second step takes about a minute and you will only be asked for it when you sign in on a new device.'),
      T.callout(deadline, daysLeft <= 0
        ? 'You will be asked to set this up the next time you sign in.'
        : 'After that you will need to set it up before you can carry on using the system.',
        urgent ? 'warning' : 'info'),
      T.paragraph('You can use your fingerprint or face, an authenticator app, or a code sent to this address - whichever suits you.'),
    ].join(''),
    textBody: [
      'Your timetable account needs a second sign-in step.',
      '',
      deadline + '.',
      '',
      'You can use your fingerprint or face, an authenticator app, or a code sent to this address.',
      'Open Settings then Two-step verification to set it up.',
    ].join('\n'),
    cta: { label: 'Set it up now', url: T.url('/settings?tab=twofactor') },
    showLink: true,
  });
};

const sendTwoFactorSetupReminder = async (email, firstName, daysLeft) => {
  if (consoleMode()) {
    console.log(`  2FA REMINDER to ${email}: ${daysLeft} day(s) left (console mode, not sent)`);
    return { success: true, messageId: 'console-dev-mode' };
  }
  return send(email, twoFactorReminderEmail(firstName, daysLeft), 'Two-factor reminder');
};

const sendTwoFactorCodeEmail = async (email, code, firstName, options = {}) => {
  if (consoleMode()) {
    console.log(`
  2FA CODE for ${email}: ${code}  (console mode, not sent)
`);
    return { success: true, messageId: 'console-dev-mode' };
  }
  return send(email, twoFactorCodeEmail(firstName, code, options), 'Two-factor code');
};

const sendVerificationEmail = async (email, token, firstName) => {
  const link = T.url(`/verify-email/${token}`);
  if (consoleMode()) return printLink('📧 EMAIL VERIFICATION LINK (Development Mode)', email, firstName, link, 'Verification link (expires in 24 hours):');
  return send(email, verificationEmail(firstName, link), 'Verification');
};

const sendPasswordResetEmail = async (email, token, firstName) => {
  const link = T.url(`/reset-password/${token}`);
  if (consoleMode()) return printLink('🔒 PASSWORD RESET LINK (Development Mode)', email, firstName, link, 'Reset link (expires in 10 minutes):');
  return send(email, resetEmail(firstName, link), 'Password reset');
};

const sendWelcomeEmail = async (email, firstName) => {
  if (consoleMode()) {
    console.log(`📧 Welcome email to ${email} (console mode, not sent)`);
    return { success: true, messageId: 'console-dev-mode' };
  }
  return send(email, welcomeEmail(firstName), 'Welcome');
};

module.exports = {
  generateVerificationToken,
  sendTwoFactorCodeEmail,
  twoFactorCodeEmail,
  sendTwoFactorSetupReminder,
  twoFactorReminderEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  // For previews and tests
  verificationEmail,
  resetEmail,
  welcomeEmail,
};
