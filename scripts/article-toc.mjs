const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function headingText(inline) {
  return (inline?.children || []).map((token) => {
    if (['text', 'code_inline', 'image'].includes(token.type)) return token.content;
    return ['softbreak', 'hardbreak'].includes(token.type) ? ' ' : '';
  }).join('').replace(/\s+/gu, ' ').trim();
}

// Generate anchors from Markdown tokens so fenced code never becomes navigation.
export function renderArticleContent(markdown, source) {
  const environment = {};
  const tokens = markdown.parse(source, environment);
  const usedIds = new Set(tokens.map((token) => token.attrGet('id')).filter(Boolean));
  const headings = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const text = headingText(tokens[index + 1]);
    if (!text) continue;
    const slug = text.normalize('NFKC').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'heading';
    const base = `section-${slug}`;
    let id = token.attrGet('id');
    if (!id) {
      id = base;
      for (let suffix = 2; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
      usedIds.add(id);
      token.attrSet('id', id);
    }
    token.attrSet('tabindex', '-1');
    headings.push({ id, text, level: Number(token.tag.slice(1)) });
  }
  return { html: markdown.renderer.render(tokens, markdown.options, environment), headings };
}

export function renderArticleToc(headings, lang) {
  const label = lang === 'ko' ? '이 글의 목차' : 'ON THIS PAGE';
  const start = lang === 'ko' ? '글 처음' : 'Overview';
  const levels = [...new Set(headings.map((heading) => heading.level))].sort();
  const entries = [{ id: 'article-start', text: start, depth: 0 }, ...headings.map((heading) => ({
    ...heading, depth: Math.min(levels.indexOf(heading.level), 2)
  }))];
  const links = entries.map(({ id, text, depth }) =>
    `<li class="article-toc-level-${depth}"><a href="#${encodeURIComponent(id)}" data-toc-link>${escapeHtml(text)}</a></li>`).join('');
  return `<aside class="article-toc"><details data-article-toc><summary>${label}<span class="article-toc-chevron" aria-hidden="true"></span></summary><nav class="article-toc-nav" aria-label="${label}"><ol>${links}</ol></nav></details></aside>`;
}
