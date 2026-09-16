import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const root = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'docs');
const siteUrl = (process.env.SITE_URL || 'https://whrds.github.io').replace(/\/$/, '');
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const copy = {
  ko: {
    siteDescription: '보안 연구, 리버스 엔지니어링, 퍼징과 펌웨어 분석에 관한 기록.',
    navNotes: '글', navAbout: '소개', eyebrow: 'Security research notes',
    headline: '끄저끄적 작성 중...',
    intro: '취약점 연구, 리버스 엔지니어링, 퍼징과 펌웨어 분석 과정에서 얻은 생각과 시행착오를 기록합니다.',
    latest: '최근 글', articles: '개의 글', profileTitle: 'whrds',
    profile: '보안과 시스템을 탐구하고, 재현 가능한 과정으로 기록합니다.',
    topics: '관심 분야', back: '모든 글 보기', readIn: '이 글을 영어로 읽기',
    footer: '관찰하고, 검증하고, 기록합니다.', minRead: '분 읽기', notFound: '페이지를 찾을 수 없습니다', home: '홈으로 이동'
  },
  en: {
    siteDescription: 'Notes on security research, reverse engineering, fuzzing, and firmware analysis.',
    navNotes: 'Notes', navAbout: 'About', eyebrow: 'Security research notes',
    headline: 'Writing things down...',
    intro: 'Notes on the ideas, experiments, and mistakes behind vulnerability research, reverse engineering, fuzzing, and firmware analysis.',
    latest: 'Latest notes', articles: 'articles', profileTitle: 'whrds',
    profile: 'Exploring security and systems, then documenting the process so it can be reproduced.',
    topics: 'Focus areas', back: 'View all notes', readIn: 'Read this post in Korean',
    footer: 'Observe, verify, document.', minRead: 'min read', notFound: 'Page not found', home: 'Go home'
  }
};

const topics = {
  ko: ['취약점 연구', '리버스 엔지니어링', '퍼징', '펌웨어'],
  en: ['Vulnerability Research', 'Reverse Engineering', 'Fuzzing', 'Firmware']
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const words = (text) => text.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_>`\[\]()-]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
const readingTime = (text, lang) => Math.max(1, Math.ceil(words(text) / (lang === 'ko' ? 350 : 220)));
const formatDate = (date, lang) => new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: lang === 'ko' ? 'long' : 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const routeFor = (item) => item.data.page ? `/${item.lang}/about/` : `/${item.lang}/posts/${item.slug}/`;
const absolute = (route) => `${siteUrl}${route}`;

async function readContent(lang) {
  const dir = path.join(contentDir, lang);
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith('.md'));
  return Promise.all(files.map(async (file) => {
    const source = await fs.readFile(path.join(dir, file), 'utf8');
    const parsed = matter(source);
    return { lang, slug: path.basename(file, '.md'), data: parsed.data, body: parsed.content, html: md.render(parsed.content) };
  }));
}

function header(lang, alternate, active = 'notes') {
  const t = copy[lang];
  const other = lang === 'ko' ? 'en' : 'ko';
  const otherUrl = alternate || `/${other}/`;
  return `<header class="site-header"><div class="shell header-inner">
    <a class="brand" href="/${lang}/" aria-label="whrds.log home"><span class="brand-mark">W_</span><span class="brand-text">whrds.log</span></a>
    <nav class="main-nav" aria-label="${lang === 'ko' ? '주 메뉴' : 'Main navigation'}">
      <a href="/${lang}/"${active === 'notes' ? ' aria-current="page"' : ''}>${t.navNotes}</a>
      <a href="/${lang}/about/"${active === 'about' ? ' aria-current="page"' : ''}>${t.navAbout}</a>
    </nav>
    <div class="header-tools">
      <div class="language-switch" aria-label="Language">
        <a href="${lang === 'ko' ? '#' : otherUrl}" class="${lang === 'ko' ? 'active' : ''}" lang="ko"${lang === 'ko' ? ' aria-current="true"' : ''}>KO</a>
        <a href="${lang === 'en' ? '#' : otherUrl}" class="${lang === 'en' ? 'active' : ''}" lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
      </div>
      <button class="icon-button" type="button" data-theme-toggle aria-label="Use dark theme">◐</button>
    </div>
  </div></header>`;
}

function layout({ lang, title, description, route, alternate, body, active = 'notes', type = 'website', date }) {
  const t = copy[lang];
  const pageTitle = title ? `${escapeHtml(title)} · whrds.log` : 'whrds.log';
  const canonical = absolute(route);
  const altLang = lang === 'ko' ? 'en' : 'ko';
  const altRoute = alternate || `/${altLang}/`;
  const jsonLd = type === 'article' ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, description, datePublished: date, inLanguage: lang, url: canonical, author: { '@type': 'Person', name: 'whrds' } })}</script>` : '';
  return `<!doctype html>
<html lang="${lang}" data-theme="light"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title><meta name="description" content="${escapeHtml(description || t.siteDescription)}">
  <meta name="theme-color" content="#f7f7f3"><link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${lang}" href="${canonical}"><link rel="alternate" hreflang="${altLang}" href="${absolute(altRoute)}">
  <meta property="og:type" content="${type}"><meta property="og:title" content="${pageTitle}"><meta property="og:description" content="${escapeHtml(description || t.siteDescription)}"><meta property="og:url" content="${canonical}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css">
  <script>try{const t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;else if(matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.dataset.theme='dark'}catch(e){}</script>
  ${jsonLd}
</head><body>
  <a class="skip-link" href="#main">${lang === 'ko' ? '본문으로 건너뛰기' : 'Skip to content'}</a>
  ${header(lang, altRoute, active)}
  <main id="main">${body}</main>
  <footer class="site-footer"><div class="shell footer-inner"><span>© ${new Date().getUTCFullYear()} whrds</span><span>${t.footer}</span><a href="/${lang}/feed.xml">RSS</a></div></footer>
  <script src="/assets/app.js" defer></script>
</body></html>`;
}

function homePage(lang, posts) {
  const t = copy[lang];
  const cards = posts.map((post) => `<a class="post-card" href="${routeFor(post)}">
    <div class="post-card-top"><time datetime="${escapeHtml(post.data.date)}">${formatDate(post.data.date, lang)}</time><span>${readingTime(post.body, lang)} ${t.minRead}</span></div>
    <h3>${escapeHtml(post.data.title)}</h3><p>${escapeHtml(post.data.description)}</p>
    <div class="tags">${(post.data.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
  </a>`).join('');
  const body = `<section class="hero"><div class="shell"><p class="eyebrow">${t.eyebrow}</p><h1>${t.headline}</h1><p class="hero-copy">${t.intro}</p><div class="hero-meta">${topics[lang].map((x) => `<span class="pill">${x}</span>`).join('')}</div></div></section>
  <div class="shell content-grid"><section><div class="section-head"><h2>${t.latest}</h2><span>${posts.length} ${t.articles}</span></div><div class="post-list">${cards}</div></section>
  <aside class="sidebar"><div class="sidebar-section"><p class="sidebar-label">Profile</p><div class="profile-card"><strong>${t.profileTitle}</strong><p>${t.profile}</p></div></div><div class="sidebar-section"><p class="sidebar-label">${t.topics}</p><div class="topic-list">${topics[lang].map((x) => `<span>${x}</span>`).join('')}</div></div></aside></div>`;
  return layout({ lang, description: t.siteDescription, route: `/${lang}/`, alternate: `/${lang === 'ko' ? 'en' : 'ko'}/`, body });
}

function articlePage(item, translation) {
  const { lang, data, body, html } = item;
  const t = copy[lang];
  const route = routeFor(item);
  const alternate = translation ? routeFor(translation) : `/${lang === 'ko' ? 'en' : 'ko'}/`;
  const inner = `<article class="article-wrap"><header class="article-header"><p class="eyebrow">${data.page ? t.navAbout : t.eyebrow}</p><h1>${escapeHtml(data.title)}</h1><p class="article-description">${escapeHtml(data.description)}</p>${data.page ? '' : `<div class="article-meta"><time datetime="${escapeHtml(data.date)}">${formatDate(data.date, lang)}</time><span>·</span><span>${readingTime(body, lang)} ${t.minRead}</span></div>`}</header><div class="prose">${html}</div><div class="article-end"><a href="/${lang}/">← ${t.back}</a>${translation ? `<a href="${alternate}" hreflang="${translation.lang}">${t.readIn} →</a>` : ''}</div></article>`;
  return layout({ lang, title: data.title, description: data.description, route, alternate, body: inner, active: data.page ? 'about' : 'notes', type: data.page ? 'website' : 'article', date: data.date });
}

async function writeRoute(route, html) {
  const relative = route.replace(/^\//, '');
  const file = route.endsWith('/') ? path.join(outDir, relative, 'index.html') : path.join(outDir, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

function feed(lang, posts) {
  const t = copy[lang];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>whrds.log</title><link>${absolute(`/${lang}/`)}</link><description>${escapeHtml(t.siteDescription)}</description><language>${lang}</language>${posts.map((post) => `<item><title>${escapeHtml(post.data.title)}</title><link>${absolute(routeFor(post))}</link><guid>${absolute(routeFor(post))}</guid><pubDate>${new Date(`${post.data.date}T00:00:00Z`).toUTCString()}</pubDate><description>${escapeHtml(post.data.description)}</description></item>`).join('')}</channel></rss>`;
}

async function build() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.cp(path.join(root, 'static'), path.join(outDir, 'assets'), { recursive: true });
  const all = [...await readContent('ko'), ...await readContent('en')];
  const translations = new Map(all.map((item) => [`${item.lang}:${item.data.translation_key}`, item]));
  for (const lang of ['ko', 'en']) {
    const posts = all.filter((item) => item.lang === lang && !item.data.page).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
    await writeRoute(`/${lang}/`, homePage(lang, posts));
    await writeRoute(`/${lang}/feed.xml`, feed(lang, posts));
  }
  for (const item of all) {
    const otherLang = item.lang === 'ko' ? 'en' : 'ko';
    const translation = translations.get(`${otherLang}:${item.data.translation_key}`);
    await writeRoute(routeFor(item), articlePage(item, translation));
  }
  await fs.writeFile(path.join(outDir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><script>const l=(navigator.language||"ko").toLowerCase().startsWith("ko")?"ko":"en";location.replace(`/${l}/`)</script><noscript><meta http-equiv="refresh" content="0;url=/ko/"></noscript></head></html>');
  await fs.writeFile(path.join(outDir, '404.html'), layout({ lang: 'ko', title: '404', description: copy.ko.notFound, route: '/404.html', alternate: '/en/', body: `<section class="not-found"><div><strong>404</strong><h1>${copy.ko.notFound}</h1><p>The page may have moved or no longer exists.</p><a href="/ko/">${copy.ko.home}</a></div></section>` }));
  await fs.writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  const routes = ['/', '/ko/', '/en/', ...all.map(routeFor)];
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${absolute(route)}</loc></url>`).join('')}</urlset>`);
  await fs.writeFile(path.join(outDir, '.nojekyll'), '');
  console.log(`Built ${all.length} content pages in docs/`);
}

await build();

