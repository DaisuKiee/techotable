/**
 * Shared look for every email the system sends.
 *
 * Email clients (Gmail, Outlook, phone mail apps) ignore most modern CSS, so
 * this is deliberately old-school: tables for layout, inline styles, no
 * flexbox, no web fonts, no gradients that carry meaning. Colours follow the
 * app's colour roles: blue = info/brand, green = success, orange = needs
 * attention, red = problem, gold = CTU highlight.
 *
 *   const { html, text } = renderEmail({ tone: 'success', eyebrow, title, ... });
 */

const APP_URL = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
const isPublicUrl = !/localhost|127\.0\.0\.1/.test(APP_URL);

const C = {
  ink: '#111827',
  body: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#e5e7eb',
  page: '#f3f4f6',
  card: '#ffffff',
  soft: '#f9fafb',
  navy: '#1e3a8a',
  gold: '#facc15',
};

/** Accent per meaning: [strong, soft background, text on soft]. */
const TONES = {
  info: ['#2563eb', '#eff6ff', '#1d4ed8'],
  success: ['#059669', '#ecfdf5', '#047857'],
  warning: ['#ea580c', '#fff7ed', '#c2410c'],
  danger: ['#dc2626', '#fef2f2', '#b91c1c'],
  neutral: ['#4b5563', '#f3f4f6', '#374151'],
};
const toneOf = (t) => TONES[t] || TONES.info;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/* ---------------- Text helpers ---------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Escaped, with line breaks kept (for announcement bodies and the like). */
const paragraphs = (s) => esc(s).trim().replace(/\r?\n/g, '<br>');

const toMin = (t) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
};

/** 13:30 -> 1:30 PM */
const fmtTime = (t) => {
  if (!t) return '';
  const m = toMin(t);
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const SEMESTERS = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };
const termLabel = (academicYear, semester) =>
  [academicYear ? `S.Y. ${academicYear}` : null, SEMESTERS[semester] || null].filter(Boolean).join(' · ');

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const sortSlots = (slots = []) => [...slots].sort(
  (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || toMin(a.startTime) - toMin(b.startTime)
);

const url = (path = '/') => `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

/* ---------------- Building blocks (return HTML strings) ---------------- */

const button = (label, href, tone = 'info') => {
  const [strong] = toneOf(tone);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${strong}" style="border-radius:8px;">
        <a href="${esc(href)}" target="_blank"
           style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;
};

/** Label / value rows, e.g. [['Section', 'BSIT-3A'], ['Room', 'COTE-06']]. Values are escaped. */
const details = (rows) => {
  const list = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!list.length) return '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid ${C.line};border-radius:10px;border-collapse:separate;">
    ${list.map(([label, value], i) => `
    <tr>
      <td style="padding:11px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:13px;color:${C.muted};width:34%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:11px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:14px;color:${C.ink};font-weight:500;vertical-align:top;">${esc(value)}</td>
    </tr>`).join('')}
  </table>`;
};

/** A soft coloured box: a short bold line plus optional detail. */
const callout = (heading, text, tone = 'info') => {
  const [strong, soft, onSoft] = toneOf(tone);
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td bgcolor="${soft}" style="background:${soft};border-left:4px solid ${strong};border-radius:8px;padding:14px 16px;font-family:${FONT};">
        <p style="margin:0;font-size:14px;font-weight:700;color:${onSoft};">${esc(heading)}</p>
        ${text ? `<p style="margin:4px 0 0;font-size:13px;line-height:1.55;color:${C.body};">${esc(text)}</p>` : ''}
      </td>
    </tr>
  </table>`;
};

/** Weekly meetings as day chips + time, one row each. */
const meetings = (slots, tone = 'info') => {
  const list = sortSlots(slots);
  const [, soft, onSoft] = toneOf(tone);
  if (!list.length) {
    return `<p style="margin:0;font-family:${FONT};font-size:14px;color:${C.muted};">No meeting times set yet.</p>`;
  }
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:1px solid ${C.line};border-radius:10px;border-collapse:separate;">
    ${list.map((s, i) => `
    <tr>
      <td style="padding:10px 14px;${i ? `border-top:1px solid ${C.line};` : ''}width:96px;">
        <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${soft};font-family:${FONT};font-size:12px;font-weight:700;color:${onSoft};">${esc(String(s.day || '').slice(0, 3).toUpperCase())}</span>
      </td>
      <td style="padding:10px 14px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT};font-size:14px;color:${C.ink};font-weight:600;">
        ${esc(fmtTime(s.startTime))} – ${esc(fmtTime(s.endTime))}
      </td>
    </tr>`).join('')}
  </table>`;
};

const sectionTitle = (text) =>
  `<p style="margin:24px 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};">${esc(text)}</p>`;

const paragraph = (html) =>
  `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">${html}</p>`;

/** The link written out, for clients that block buttons. */
const linkFallback = (href) => `
  <p style="margin:18px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">
    Button not working? Paste this into your browser:<br>
    <a href="${esc(href)}" style="color:#2563eb;word-break:break-all;">${esc(href)}</a>
  </p>`;

/* ---------------- The page ---------------- */

/**
 * @param {object} o
 * @param {string} o.subject      the email subject (also the <title>)
 * @param {string} o.preheader    one line shown after the subject in the inbox
 * @param {'info'|'success'|'warning'|'danger'|'neutral'} [o.tone]
 * @param {string} o.eyebrow      small label above the title ("Schedule published")
 * @param {string} o.title        main heading (plain text)
 * @param {string} [o.greeting]   "Hi Maria," (plain text)
 * @param {string} o.body         HTML built from the blocks above
 * @param {{label: string, url: string}} [o.cta]
 * @param {boolean} [o.showLink]  print the CTA link under the button
 * @param {string} [o.reason]     why they got it (plain text), shown in the footer
 * @param {boolean} [o.manageLink] add "Manage email settings"
 * @param {string} o.textBody     plain-text version of the body
 */
const renderEmail = (o) => {
  const tone = o.tone || 'info';
  const [strong, soft, onSoft] = toneOf(tone);
  const year = new Date().getFullYear();
  const logo = isPublicUrl
    ? `<img src="${url('/favicon.png')}" width="36" height="36" alt="CTU" style="display:block;border:0;border-radius:50%;background:#ffffff;">`
    : `<span style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:50%;background:${C.gold};color:${C.navy};font-family:${FONT};font-size:11px;font-weight:800;text-align:center;">CTU</span>`;

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${esc(o.subject || o.title)}</title>
  <style>
    @media (max-width: 620px) {
      .wrap { width: 100% !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
      .title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
  <!-- Inbox preview line -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(o.preheader || '')}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Brand bar -->
          <tr>
            <td bgcolor="${C.navy}" style="background:${C.navy};border-radius:14px 14px 0 0;padding:16px 28px;" class="pad">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">${logo}</td>
                  <td style="vertical-align:middle;font-family:${FONT};">
                    <div style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.2;">CTU Daanbantayan</div>
                    <div style="font-size:12px;color:#bfdbfe;line-height:1.3;">Smart Timetabling System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Gold rule + colour of this message -->
          <tr>
            <td style="font-size:0;line-height:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="22%" height="4" bgcolor="${C.gold}" style="background:${C.gold};font-size:0;line-height:0;">&nbsp;</td>
                  <td height="4" bgcolor="${strong}" style="background:${strong};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="${C.card}" class="pad" style="background:${C.card};padding:30px 36px 32px;border:1px solid ${C.line};border-top:0;border-radius:0 0 14px 14px;">
              ${o.eyebrow ? `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${soft};font-family:${FONT};font-size:12px;font-weight:700;color:${onSoft};">${esc(o.eyebrow)}</span>` : ''}
              <h1 class="title" style="margin:${o.eyebrow ? '14px' : '0'} 0 6px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:800;color:${C.ink};">${esc(o.title)}</h1>
              ${o.greeting ? `<p style="margin:16px 0 14px;font-family:${FONT};font-size:15px;color:${C.body};">${esc(o.greeting)}</p>` : '<div style="height:10px;line-height:10px;">&nbsp;</div>'}
              ${o.body || ''}
              ${o.cta ? `<div style="height:26px;line-height:26px;">&nbsp;</div>${button(o.cta.label, o.cta.url, tone)}${o.showLink ? linkFallback(o.cta.url) : ''}` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" class="pad" style="padding:22px 36px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">
              ${o.reason ? `<p style="margin:0 0 6px;color:${C.muted};">${esc(o.reason)}</p>` : ''}
              ${o.manageLink ? `<p style="margin:0 0 10px;"><a href="${url('/settings')}" style="color:#2563eb;text-decoration:underline;">Manage email settings</a></p>` : ''}
              <p style="margin:0;">Cebu Technological University – Daanbantayan Campus</p>
              <p style="margin:0;">This is an automated message; replies aren’t monitored. © ${year}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'CTU Daanbantayan · Smart Timetabling System',
    '',
    o.eyebrow ? `[${o.eyebrow}]` : null,
    o.title,
    '',
    o.greeting ? `${o.greeting}\n` : null,
    o.textBody || '',
    '',
    o.cta ? `${o.cta.label}: ${o.cta.url}` : null,
    '',
    o.reason || null,
    o.manageLink ? `Manage email settings: ${url('/settings')}` : null,
    'Cebu Technological University – Daanbantayan Campus',
  ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return { html, text, subject: o.subject };
};

module.exports = {
  APP_URL,
  url,
  esc,
  paragraphs,
  fmtTime,
  termLabel,
  sortSlots,
  button,
  details,
  callout,
  meetings,
  sectionTitle,
  paragraph,
  renderEmail,
  FONT,
  C,
  toneOf,
};
