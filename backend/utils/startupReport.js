/**
 * The startup summary printed once the server is listening and the
 * database / solver / AI / email checks have finished.
 */
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const c = {
  bold: paint('1'),
  dim: paint('2'),
  green: paint('32'),
  yellow: paint('33'),
  red: paint('31'),
  cyan: paint('36'),
};

const MARK = {
  ok: c.green('✓'),
  warn: c.yellow('!'),
  fail: c.red('✗'),
  info: c.dim('·'),
};

/** Count the routes Express actually has, grouped by mount path. */
const countRoutes = (app) => {
  const groups = new Set();
  let total = 0;
  const stack = (app._router && app._router.stack) || [];

  for (const layer of stack) {
    if (layer.route) {
      total += Object.keys(layer.route.methods).length;
      groups.add('/');
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const mount = (layer.regexp && layer.regexp.source.match(/\^\\\/api\\\/([\w-]+)/)) || [];
      let count = 0;
      for (const inner of layer.handle.stack) {
        if (inner.route) count += Object.keys(inner.route.methods).filter((m) => m !== '_all').length;
      }
      if (count) {
        total += count;
        groups.add(mount[1] || '?');
      }
    }
  }
  return { total, groups: groups.size };
};

const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);

const printStartupReport = ({ app, port, startedAt, db, solver, ai, email }) => {
  const env = process.env.NODE_ENV || 'development';
  const { version } = require('../package.json');
  const routes = countRoutes(app);
  const base = `http://localhost:${port}/api`;
  const rows = [];
  const row = (mark, label, text, note) => rows.push(
    `  ${mark} ${c.bold(label.padEnd(9))} ${text}${note ? `  ${c.dim(note)}` : ''}`
  );

  row(MARK.ok, 'Server', c.cyan(base), `ready in ${ms(Date.now() - startedAt)}`);

  if (db.ok) row(MARK.ok, 'Database', `${db.name} on ${db.host}`, `connected in ${ms(db.ms)}`);
  else row(MARK.fail, 'Database', c.red(db.error), db.hint);

  if (solver.available) row(MARK.ok, 'Solver', `OR-Tools ${solver.ortoolsVersion}`, `${solver.python} · built-in solver as fallback`);
  else row(MARK.warn, 'Solver', 'Built-in solver only', solver.error);

  if (ai.keys) row(MARK.ok, 'AI', `Gemini · ${ai.keys} API key${ai.keys === 1 ? '' : 's'}`);
  else row(MARK.warn, 'AI', 'Not configured', 'set GEMINI_API_KEY_1 to enable B-LO and AI insights');

  if (email.consoleMode) row(MARK.warn, 'Email', 'Console mode', 'emails are printed here, not sent');
  else if (email.user) row(MARK.ok, 'Email', `${email.service} as ${email.user}`);
  else row(MARK.warn, 'Email', 'Not configured', 'set EMAIL_USER and EMAIL_PASSWORD');

  row(MARK.info, 'Routes', `${routes.total} endpoints in ${routes.groups} groups`);
  row(MARK.info, 'Health', c.cyan(`${base}/health`));

  const title = `${c.bold('CoTE Timetabling API')} ${c.dim(`v${version} · ${env} · node ${process.version}`)}`;
  const line = c.dim('─'.repeat(64));
  console.log(`\n  ${title}\n  ${line}\n${rows.join('\n')}\n  ${line}`);
  console.log(c.dim(`  Press Ctrl+C to stop${env === 'development' ? ' · type rs to restart' : ''}\n`));
};

module.exports = { printStartupReport, countRoutes, c };
