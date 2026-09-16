import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import matter from 'gray-matter';

const root = path.resolve(import.meta.dirname, '..');
const source = (process.env.TISTORY_URL || 'https://whrdud727.tistory.com').replace(/\/$/, '');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const translate = !process.argv.includes('--no-translate');
const userAgent = 'Mozilla/5.0 (compatible; whrds-blog-migrator/1.0)';
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });

turndown.addRule('fencedCode', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => {
    const code = node.textContent.replace(/^\n|\n$/g, '');
    const language = node.querySelector('code')?.className?.match(/language-([\w+-]+)/)?.[1] || '';
    return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
const yamlString = (value) => JSON.stringify(String(value || ''));
const slugify = (value, fallback) => value.toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback;

async function fetchWithRetry(url, options = {}, attempts = 6) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000), headers: { 'user-agent': userAgent, ...(options.headers || {}) } });
      if (response.status === 429 && attempt < attempts) {
        const delay = 15000 * attempt;
        console.warn(`  rate limited; waiting ${delay / 1000}s (attempt ${attempt}/${attempts})`);
        await sleep(delay);
        continue;
      }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (caught) {
      error = caught;
      if (attempt < attempts) await sleep(600 * attempt);
    }
  }
  throw error;
}

async function translateText(text) {
  if (!text.trim()) return text;
  const response = await fetchWithRetry('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=UTF-8' },
    signal: AbortSignal.timeout(300000),
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'qwen3:14b',
      system: 'Translate Korean to natural English. Preserve Markdown, URLs, code, placeholders, and paragraph structure exactly. Output only the translation.',
      prompt: text,
      stream: false,
      think: false,
      keep_alive: '30m',
      options: { temperature: 0 }
    })
  }, 2);
  const data = await response.json();
  if (!data.response) throw new Error(data.error || 'local translation failed');
  return data.response.trim();
}

function protectMarkdown(markdown) {
  const values = [];
  const keep = (value) => {
    const token = `ZXQKEEP${String(values.length).padStart(5, '0')}QXZ`;
    values.push(value);
    return token;
  };
  let safe = markdown.replace(/```[\s\S]*?```/g, keep);
  safe = safe.replace(/`[^`\n]+`/g, keep);
  safe = safe.replace(/https?:\/\/[^\s)>]+/g, keep);
  return { safe, restore: (value) => values.reduce((result, original, index) => result.replaceAll(`ZXQKEEP${String(index).padStart(5, '0')}QXZ`, original), value) };
}

async function translateMarkdown(markdown) {
  const { safe, restore } = protectMarkdown(markdown);
  const paragraphs = safe.split(/(\n\s*\n)/);
  const chunks = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > 3200) {
      chunks.push(current);
      current = '';
    }
    if (paragraph.length > 3200) {
      if (current) chunks.push(current);
      for (let start = 0; start < paragraph.length; start += 3000) chunks.push(paragraph.slice(start, start + 3000));
    } else {
      current += paragraph;
    }
  }
  if (current) chunks.push(current);
  const translated = [];
  for (const chunk of chunks) {
    translated.push(await translateText(chunk));
    await sleep(25);
  }
  return restore(translated.join(''));
}

function extensionFrom(response, url) {
  const type = response.headers.get('content-type')?.split(';')[0].trim();
  const byType = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
  if (byType[type]) return byType[type];
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.bin';
}

async function localizeAssets($, content, postKey) {
  const imageDir = path.join(root, 'static', 'images', 'tistory', postKey);
  await fs.mkdir(imageDir, { recursive: true });
  let imageIndex = 0;
  for (const element of content.find('img').toArray()) {
    const img = $(element);
    const remote = img.attr('data-origin-url') || img.attr('data-src') || img.attr('src');
    if (!remote || remote.startsWith('data:')) continue;
    try {
      const url = new URL(remote, source).href;
      const response = await fetchWithRetry(url, { headers: { referer: source } });
      const ext = extensionFrom(response, url);
      const filename = `${String(++imageIndex).padStart(3, '0')}${ext}`;
      await fs.writeFile(path.join(imageDir, filename), Buffer.from(await response.arrayBuffer()));
      img.attr('src', `/assets/images/tistory/${postKey}/${filename}`);
      img.removeAttr('srcset data-src data-origin-url data-filename');
    } catch (error) {
      console.warn(`  image skipped: ${remote} (${error.message})`);
    }
  }
}

function cleanContent($, content) {
  content.find('script, style, noscript, iframe, ins, .adsbygoogle, .revenue_unit_wrap, .container_postbtn, .another_category').remove();
  content.find('p, div').each((_index, element) => {
    const el = $(element);
    if (/^\s*(728x90|320x100)\s*$/.test(el.text())) el.remove();
  });
  content.find('a[href]').each((_index, element) => {
    const link = $(element);
    const href = link.attr('href');
    if (href?.startsWith('/')) link.attr('href', new URL(href, source).href);
  });
}

function frontMatter({ title, description, date, key, tags, sourceUrl, category, isPrivate = false }) {
  return `---\ntitle: ${yamlString(title)}\ndescription: ${yamlString(description)}\ndate: ${yamlString(date)}\ntranslation_key: ${yamlString(key)}\ntags: ${JSON.stringify(tags)}\ncategory: ${yamlString(category)}\nsource_url: ${yamlString(sourceUrl)}\nprivate: ${isPrivate}\n---\n\n`;
}

async function migratePost(url, index, total) {
  const response = await fetchWithRetry(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content')?.trim() || $('h1').first().text().trim();
  const published = $('meta[property="article:published_time"]').attr('content') || '';
  const date = published.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const category = $('.tit_category a').first().text().trim() || $('meta[property="article:section"]').attr('content')?.trim() || '';
  const tags = [...new Set($('meta[property="article:tag"], .tag_label a').map((_i, el) => $(el).attr('content') || $(el).text().trim()).get().filter(Boolean))];
  let content = $('.contents_style').first();
  if (!content.length) content = $('.tt_article_useless_p_margin').first();
  if (!content.length) content = $('#article-view').first();
  if (!title || !content.length) throw new Error('title or article content not found');
  cleanContent($, content);
  const key = `tistory-${hash(url)}`;
  await localizeAssets($, content, key);
  let korean = turndown.turndown(content.html() || '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const description = ($('meta[property="og:description"]').attr('content') || content.text()).replace(/\s+/g, ' ').trim().slice(0, 180);
  let englishTitle = title;
  let englishDescription = description;
  let english = korean;
  if (translate) {
    englishTitle = await translateText(title);
    englishDescription = await translateText(description);
    english = await translateMarkdown(korean);
  }
  let slug = slugify(englishTitle, key);
  const candidate = path.join(root, 'content', 'ko', `${slug}.md`);
  try {
    const occupied = matter(await fs.readFile(candidate, 'utf8')).data.source_url;
    if (occupied !== url) slug = `${slug}-${key.slice(-6)}`;
  } catch {}
  const koFile = path.join(root, 'content', 'ko', `${slug}.md`);
  const enFile = path.join(root, 'content', 'en', `${slug}.md`);
  await fs.writeFile(koFile, frontMatter({ title, description, date, key, tags: tags.length ? tags : [category || '기록'], sourceUrl: url, category }) + korean);
  await fs.writeFile(enFile, frontMatter({ title: englishTitle, description: englishDescription, date, key, tags: tags.length ? tags : [category || 'Notes'], sourceUrl: url, category }) + english);
  console.log(`[${index}/${total}] ${date} ${title} -> ${slug}`);
  return { url, title, date, key, slug, ko: path.relative(root, koFile), en: path.relative(root, enFile), images: await imageIndexFor(root, key) };
}

async function imageIndexFor(base, key) {
  try { return (await fs.readdir(path.join(base, 'static', 'images', 'tistory', key))).length; } catch { return 0; }
}

async function findExistingPosts() {
  const existing = new Map();
  const koDir = path.join(root, 'content', 'ko');
  for (const filename of await fs.readdir(koDir)) {
    if (!filename.endsWith('.md')) continue;
    const parsed = matter(await fs.readFile(path.join(koDir, filename), 'utf8'));
    const url = parsed.data.source_url;
    if (!url?.startsWith(`${source}/entry/`)) continue;
    const enFile = path.join(root, 'content', 'en', filename);
    try { await fs.access(enFile); } catch { continue; }
    const slug = path.basename(filename, '.md');
    const key = parsed.data.translation_key;
    existing.set(url, {
      url, title: parsed.data.title, date: String(parsed.data.date), key, slug,
      ko: path.relative(root, path.join(koDir, filename)), en: path.relative(root, enFile),
      images: await imageIndexFor(root, key)
    });
  }
  return existing;
}

async function main() {
  const sitemap = await (await fetchWithRetry(`${source}/sitemap.xml`)).text();
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].replaceAll('&amp;', '&'))
    .filter((url) => url.startsWith(`${source}/entry/`)).slice(0, limit);
  const existing = await findExistingPosts();
  console.log(`Found ${urls.length} public posts. Translation: ${translate ? 'ko -> en' : 'disabled'}`);
  const results = [];
  const failures = [];
  for (let index = 0; index < urls.length; index += 1) {
    if (existing.has(urls[index])) {
      results.push(existing.get(urls[index]));
      console.log(`[${index + 1}/${urls.length}] existing ${existing.get(urls[index]).title}`);
      continue;
    }
    try {
      results.push(await migratePost(urls[index], index + 1, urls.length));
    } catch (error) {
      failures.push({ url: urls[index], error: error.message });
      console.error(`[${index + 1}/${urls.length}] FAILED ${urls[index]}: ${error.message}`);
    }
  }
  const manifest = { source, migratedAt: new Date().toISOString(), discovered: urls.length, migrated: results.length, failures, posts: results };
  await fs.writeFile(path.join(root, 'tistory-migration.json'), JSON.stringify(manifest, null, 2));
  console.log(`Migration finished: ${results.length}/${urls.length}, failures=${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

await main();
