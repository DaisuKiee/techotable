/**
 * Small, safe Markdown renderer for AI replies: escapes HTML first, only
 * allows web / in-app / mail links. Returns an HTML string.
 */

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Only web, in-app and mail links. A model-written [x](javascript:...) used
// to be rendered as a live link.
const safeHref = (url) => (/^(https?:\/\/|\/|#|mailto:)/i.test(url) ? url : null);

const inline = (raw) => {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const href = safeHref(url.replace(/&amp;/g, '&'));
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
  });
  return s;
};

/**
 * Block-level markdown: paragraphs, headings, bullet and numbered lists, code
 * fences. The old renderer turned every newline into <br/> and emitted bare
 * <li> elements with no list around them, so lists rendered with stray gaps
 * and numbered lists didn't render at all.
 */
export const renderMarkdown = (text) => {
  if (!text) return '';
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [], start }
  let code = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br/>')}</p>`);
    para = [];
  };
  const flushList = () => {
    // Numbered lists keep the number the text used, so "1. ... (bullets) 2. ..."
    // reads 1, 2 instead of restarting at 1 after each run of bullets
    const start = list && list.type === 'ol' && list.start > 1 ? ` start="${list.start}"` : '';
    if (list) out.push(`<${list.type}${start}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line.trim())) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^```/.test(line.trim())) { flushPara(); flushList(); code = []; continue; }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.+)$/);

    if (h) { flushPara(); flushList(); out.push(`<h4>${inline(h[2])}</h4>`); }
    else if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [], start: ol ? parseInt(ol[1], 10) : 1 };
      list.items.push(ul ? ul[1] : ol[2]);
    } else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  if (code) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushPara();
  flushList();
  return out.join('');
};

export default renderMarkdown;
