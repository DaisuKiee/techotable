/**
 * Mail transport and sender, from .env, shared by every email the app sends.
 *
 * Sender shown to recipients:
 *   EMAIL_FROM        technotabler@cebutech.digital   (falls back to EMAIL_USER)
 *   EMAIL_FROM_NAME   CTU Daanbantayan Timetabling
 *   EMAIL_REPLY_TO    optional; where replies go
 *
 * How it's sent (pick one):
 *   Gmail account:  EMAIL_SERVICE=gmail, EMAIL_USER, EMAIL_PASSWORD (app password)
 *   Any SMTP host:  EMAIL_HOST, EMAIL_PORT (465 or 587), EMAIL_SMTP_USER, EMAIL_PASSWORD
 *                   e.g. Resend: smtp.resend.com / 465 / user "resend" / password = API key
 *
 * A custom-domain From only reaches inboxes reliably when the host sending it
 * is authorised for that domain (SPF/DKIM). cebutech.digital is set up for
 * Resend; plain Gmail will rewrite or flag the From.
 */

const nodemailer = require('nodemailer');

let cached = null;

const transportOptions = () => {
  const auth = {
    user: process.env.EMAIL_SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  };
  if (process.env.EMAIL_HOST) {
    const port = Number(process.env.EMAIL_PORT) || 465;
    return { host: process.env.EMAIL_HOST, port, secure: port === 465, auth, pool: true };
  }
  return { service: process.env.EMAIL_SERVICE || 'gmail', auth, pool: true };
};

/** One pooled transport for the whole app. */
const getTransport = () => {
  if (!cached) cached = nodemailer.createTransport(transportOptions());
  return cached;
};

const senderAddress = () => process.env.EMAIL_FROM || process.env.EMAIL_USER;

/** "CTU Daanbantayan Timetabling" <technotabler@cebutech.digital> */
const fromHeader = () => {
  const name = (process.env.EMAIL_FROM_NAME || 'CTU Daanbantayan Timetabling').replace(/"/g, '');
  return `"${name}" <${senderAddress()}>`;
};

/** From, Reply-To and headers to spread into nodemailer's sendMail options. */
const envelope = () => ({
  from: fromHeader(),
  ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
});

module.exports = { getTransport, fromHeader, senderAddress, envelope };
