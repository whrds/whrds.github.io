import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { build as bundle } from 'esbuild';
import { highlightMarkdownCode } from './syntax-highlighting.mjs';

const root = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'docs');
const siteUrl = (process.env.SITE_URL || 'https://whrds.github.io').replace(/\/$/, '');
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, highlight: highlightMarkdownCode });
let assetVersion = '';

const copy = {
  ko: {
    siteDescription: '보안 연구, 리버스 엔지니어링, 퍼징과 펌웨어 분석에 관한 기록.',
    navNotes: '글', navCategories: '카테고리', navAbout: '소개', eyebrow: 'Security research notes',
    headline: '끄저끄적 작성 중...',
    intro: '취약점 연구, 리버스 엔지니어링, 퍼징과 펌웨어 분석 과정에서 얻은 생각과 시행착오를 기록합니다.',
    latest: '최근 글', articles: '개의 글', profileTitle: 'ZZoMb1E',
    profile: [
      '2024 · Incognito CTF — 1st',
      '2025 · HOLYSHIELD CTF — 3rd',
      '2026 · Synology Hall of Fame',
      '2026 · DEF CON 34 CTF Finalist — 7th, Jinddabi’s',
      '2026 · QNAP 취약점 제보'
    ],
    topics: '관심 분야', categories: '카테고리', allCategories: '전체 카테고리', back: '모든 글 보기', readIn: '이 글을 영어로 읽기',
    footer: '관찰하고, 검증하고, 기록합니다.', minRead: '분 읽기', notFound: '페이지를 찾을 수 없습니다', home: '홈으로 이동'
  },
  en: {
    siteDescription: 'Notes on security research, reverse engineering, fuzzing, and firmware analysis.',
    navNotes: 'Notes', navCategories: 'Categories', navAbout: 'About', eyebrow: 'Security research notes',
    headline: 'Writing things down...',
    intro: 'Notes on the ideas, experiments, and mistakes behind vulnerability research, reverse engineering, fuzzing, and firmware analysis.',
    latest: 'Latest notes', articles: 'articles', profileTitle: 'ZZoMb1E',
    profile: [
      '2024 · Incognito CTF — 1st',
      '2025 · HOLYSHIELD CTF — 3rd',
      '2026 · Synology Hall of Fame',
      '2026 · DEF CON 34 CTF Finalist — 7th, Jinddabi’s',
      '2026 · QNAP vulnerability report'
    ],
    topics: 'Focus areas', categories: 'Categories', allCategories: 'All categories', back: 'View all notes', readIn: 'Read this post in Korean',
    footer: 'Observe, verify, document.', minRead: 'min read', notFound: 'Page not found', home: 'Go home'
  }
};

const topics = {
  ko: ['취약점 연구', '리버스 엔지니어링', '퍼징', '펌웨어'],
  en: ['Vulnerability Research', 'Reverse Engineering', 'Fuzzing', 'Firmware']
};

const categoryInfo = {
  'V8': { slug: 'v8', ko: 'V8', en: 'V8' },
  'STUDY/PWNABLE_AMD64': { slug: 'pwnable-amd64', ko: 'STUDY / PWNABLE_AMD64', en: 'STUDY / PWNABLE_AMD64' },
  'STUDY/CVE && Fuzzing': { slug: 'cve-fuzzing', ko: 'STUDY / CVE && Fuzzing', en: 'STUDY / CVE && Fuzzing' },
  'STUDY/KERNEL': { slug: 'kernel', ko: 'STUDY / KERNEL', en: 'STUDY / KERNEL' },
  'STUDY/FirmWare 분석(시도)': { slug: 'firmware', ko: 'STUDY / FirmWare 분석(시도)', en: 'STUDY / Firmware Analysis' },
  'STUDY/PWNABLE_AArch64': { slug: 'pwnable-aarch64', ko: 'STUDY / PWNABLE_AArch64', en: 'STUDY / PWNABLE_AArch64' },
  'Write Up/CTF': { slug: 'ctf-writeups', ko: 'Write Up / CTF', en: 'Write-ups / CTF' },
  'STUDY/Android': { slug: 'android', ko: 'STUDY / Android', en: 'STUDY / Android' },
  '공부하기 싫다': { slug: 'misc', ko: '공부하기 싫다', en: 'Miscellaneous' }
};

const categoryMeta = (name) => categoryInfo[name] || { slug: encodeURIComponent(name || 'uncategorized'), ko: name || '미분류', en: name || 'Uncategorized' };
const categoryRoute = (lang, name) => `/${lang}/categories/${categoryMeta(name).slug}/`;
const categoryLabel = (lang, name) => categoryMeta(name)[lang];
const categoriesFor = (posts) => Object.keys(categoryInfo).filter((name) => posts.some((post) => post.data.category === name));

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
    let html = md.render(parsed.content);
    if (parsed.data.concept_demo === 'm152-lifetime' && file === 'chrome-m152-externalstring-race.md') {
      const marker = md.render('<!--DEMO-->').trim();
      if (!html.includes(marker)) throw new Error('Missing conceptual demo marker');
      const demoTitle = lang === 'ko' ? '객체 수명 개념 데모' : 'Object lifetime concept demo';
      html = html.replace(marker, `<div class="concept-demo-embed"><iframe data-concept-demo src="/assets/research/chrome-m152-externalstring-race/m152-lifetime-demo.html#${lang}" title="${demoTitle}" loading="lazy" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div>`);
    }
    return { lang, slug: path.basename(file, '.md'), data: parsed.data, body: parsed.content, html };
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
      <a href="/${lang}/categories/"${active === 'categories' ? ' aria-current="page"' : ''}>${t.navCategories}</a>
      <a href="/${lang}/about/"${active === 'about' ? ' aria-current="page"' : ''}>${t.navAbout}</a>
    </nav>
    <div class="header-tools">
      <div class="language-switch" aria-label="Language">
        <a href="${lang === 'ko' ? '#' : otherUrl}" class="${lang === 'ko' ? 'active' : ''}" lang="ko"${lang === 'ko' ? ' aria-current="true"' : ''}>KO</a>
        <a href="${lang === 'en' ? '#' : otherUrl}" class="${lang === 'en' ? 'active' : ''}" lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
      </div>
      <button class="icon-button" type="button" data-theme-toggle aria-label="${lang === 'ko' ? '밝은 테마로 전환' : 'Use light theme'}">☀</button>
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
<html lang="${lang}" data-theme="dark"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${pageTitle}</title><meta name="description" content="${escapeHtml(description || t.siteDescription)}">
  <meta name="theme-color" content="#101215"><link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${lang}" href="${canonical}"><link rel="alternate" hreflang="${altLang}" href="${absolute(altRoute)}">
  <meta property="og:type" content="${type}"><meta property="og:title" content="${pageTitle}"><meta property="og:description" content="${escapeHtml(description || t.siteDescription)}"><meta property="og:url" content="${canonical}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css?v=${assetVersion}">
  <script>try{if(localStorage.getItem('theme')==='light'){document.documentElement.dataset.theme='light';document.querySelector('meta[name="theme-color"]').content='#edf0f3'}}catch(e){}</script>
${jsonLd}
</head><body>
  <a class="skip-link" href="#main">${lang === 'ko' ? '본문으로 건너뛰기' : 'Skip to content'}</a>
  ${header(lang, altRoute, active)}
  <main id="main">${body}</main>
  <footer class="site-footer"><div class="shell footer-inner"><span class="footer-brand">ZZoMb1E <span>© ${new Date().getUTCFullYear()} whrds.log</span></span><span>${t.footer}</span><a href="/${lang}/feed.xml">RSS ↗</a></div></footer>
  <script src="/assets/app.js?v=${assetVersion}" defer></script>
</body></html>`;
}

function postCards(lang, posts) {
  const t = copy[lang];
  return posts.map((post, index) => {
    const extraTags = (post.data.tags || []).filter((tag) => tag !== post.data.category);
    return `<article class="post-card"><span class="post-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="post-card-top"><a class="post-category" href="${categoryRoute(lang, post.data.category)}">${escapeHtml(categoryLabel(lang, post.data.category))}</a><span><time datetime="${escapeHtml(post.data.date)}">${formatDate(post.data.date, lang)}</time> · ${readingTime(post.body, lang)} ${t.minRead}</span></div>
      <h3><a href="${routeFor(post)}">${escapeHtml(post.data.title)}</a></h3><p>${escapeHtml(post.data.description)}</p>
      ${extraTags.length ? `<div class="tags">${extraTags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    </article>`;
  }).join('');
}

function categoryLinks(lang, posts) {
  return categoriesFor(posts).map((name) => {
    const count = posts.filter((post) => post.data.category === name).length;
    return `<a href="${categoryRoute(lang, name)}"><span>${escapeHtml(categoryLabel(lang, name))}</span><strong>${count}</strong></a>`;
  }).join('');
}

function mascot(lang, variant = 'profile') {
  const ko = lang === 'ko';
  return `<div class="mascot mascot--${variant}" data-mascot data-mascot-motion="off" data-animate="off"><div class="mascot-stage"><span class="mascot-shadow" aria-hidden="true"></span><img class="mascot-art" src="/assets/zzombie-mascot-v1.webp" width="384" height="384" alt="${ko ? '노트북 앞에서 손을 흔드는 초록색 좀비 마스코트 ZZoMb1E' : 'ZZoMb1E, a friendly green zombie mascot waving behind a laptop'}" loading="${variant === 'profile' ? 'lazy' : 'eager'}" decoding="async"><button class="mascot-toggle" type="button" data-mascot-toggle aria-label="${ko ? '마스코트 움직임 켜기' : 'Animate mascot'}" aria-pressed="false" hidden><span data-mascot-icon aria-hidden="true">▶</span></button></div></div>`;
}

function homePage(lang, posts) {
  const t = copy[lang];
  const ko = lang === 'ko';
  const body = `<section class="hero hero-hardware"><div class="shell hero-topline" aria-hidden="true"><span>FIELD NOTES / ZZoMb1E</span><span>REVERSE ENGINEERING &amp; SYSTEMS</span></div><div class="shell hero-grid"><div class="hero-editorial"><p class="eyebrow">${t.eyebrow}</p><h1>${t.headline}</h1><p class="hero-copy">${t.intro}</p><div class="hero-meta">${topics[lang].map((x) => `<span class="pill">${x}</span>`).join('')}</div><div class="hero-actions"><a class="hero-primary" href="#notes">${ko ? '기록 살펴보기' : 'Explore the notes'} <span aria-hidden="true">↗</span></a><a class="hero-secondary" href="/${lang}/categories/">${t.allCategories} <span aria-hidden="true">→</span></a></div><p class="hero-footnote">ZZoMb1E <span aria-hidden="true">/</span> BREAK THINGS. UNDERSTAND MORE.</p></div>
  <figure class="hardware" data-hardware data-state="poster" aria-label="${ko ? '기판, 메모리, 펌웨어, NAS 인터랙티브 3D 컬렉션' : 'Interactive hardware collection: board, memory, firmware and NAS'}">
    <div class="hardware-stage" data-three-stage>
      <img class="hardware-poster" src="/assets/hardware-poster.png" alt="${ko ? '녹색 회로기판 위의 ZZoMb1E 금속 칩' : 'ZZoMb1E metal chip on a green circuit board'}" width="1000" height="1000" fetchpriority="high">
      <div class="hardware-overline" aria-hidden="true"><span data-model-number>FIELD OBJECT / 001</span><span class="hardware-live">REAL-TIME 3D</span></div>
      <div class="hardware-side-label" aria-hidden="true">SILICON · COPPER · CURIOSITY</div>
      <button class="hardware-load" data-load-three type="button">${ko ? '3D 모델 보기' : 'View in 3D'}</button>
    </div>
    <div class="hardware-models" data-model-picker role="group" aria-label="${ko ? '3D 모델 선택' : 'Select a 3D model'}" hidden>
      ${[['board', ko ? '기판' : 'Board'], ['memory', ko ? '메모리' : 'Memory'], ['firmware', ko ? '펌웨어' : 'Firmware'], ['nas', 'NAS']].map(([id, label], i) => `<button type="button" data-model="${id}" aria-pressed="${i === 0}"><span class="hardware-model-index" aria-hidden="true">0${i + 1}</span><span>${label}</span><span class="hardware-model-dot" aria-hidden="true"></span></button>`).join('')}
    </div>
    <figcaption class="hardware-caption">
      <div class="hardware-description"><strong data-model-title>UNDER THE SURFACE.</strong><p class="hardware-detail" data-model-detail>${ko ? '적층 기판 · 도금 비아 · 디버그 헤더' : 'Layered PCB · plated vias · debug header'}</p><p data-three-hint>${ko ? '드래그해서 다른 각도로 살펴보세요.' : 'Drag to inspect from another angle.'}</p></div>
      <div class="hardware-controls" data-three-controls hidden><button type="button" data-explode aria-pressed="false">${ko ? '구조 펼치기' : 'Explode'}</button><button type="button" data-motion aria-pressed="false">${ko ? '자동 회전' : 'Auto-rotate'}</button><button type="button" data-reset>${ko ? '초기화' : 'Reset'}</button></div>
    </figcaption><span class="sr-only" data-three-status role="status" aria-live="polite"></span>
  </figure></div><div class="shell archive-ledger"><div><strong>${String(posts.length).padStart(2, '0')}</strong><span>${ko ? '개의 기록' : 'FIELD NOTES'}</span></div><div><strong>${String(categoriesFor(posts).length).padStart(2, '0')}</strong><span>${ko ? '개 카테고리' : 'CATEGORIES'}</span></div><div><strong>KO / EN</strong><span>${ko ? '두 언어로 기록' : 'TWO LANGUAGES'}</span></div><p>OBSERVE. VERIFY. DOCUMENT.</p></div></section>
  <div class="shell content-grid" id="notes"><section><div class="section-head"><h2>${t.latest}</h2><span>${posts.length} ${t.articles}</span></div><div class="post-list">${postCards(lang, posts)}</div></section>
  <aside class="sidebar"><div class="sidebar-section"><p class="sidebar-label">${ko ? '연구자 프로필' : 'RESEARCHER PROFILE'}</p><div class="profile-card">${mascot(lang)}<strong>${t.profileTitle}</strong><p class="profile-caption">SECURITY RESEARCHER / FIELD NOTES</p><ul>${t.profile.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div></div><div class="sidebar-section"><p class="sidebar-label">${t.categories}</p><nav class="category-list">${categoryLinks(lang, posts)}</nav><a class="all-categories" href="/${lang}/categories/">${t.allCategories} →</a></div></aside></div>`;
  return layout({ lang, description: t.siteDescription, route: `/${lang}/`, alternate: `/${lang === 'ko' ? 'en' : 'ko'}/`, body });
}

function categoryIndexPage(lang, posts) {
  const t = copy[lang];
  const cards = categoriesFor(posts).map((name) => {
    const count = posts.filter((post) => post.data.category === name).length;
    return `<a class="category-card" href="${categoryRoute(lang, name)}"><span>${escapeHtml(categoryLabel(lang, name))}</span><strong>${count}</strong><small>${t.articles}</small></a>`;
  }).join('');
  const body = `<section class="category-page shell"><p class="eyebrow">${t.navCategories}</p><div class="category-page-head"><h1>${t.allCategories}</h1><span>${posts.length} ${t.articles}</span></div><div class="category-grid">${cards}</div></section>`;
  return layout({ lang, title: t.navCategories, description: t.siteDescription, route: `/${lang}/categories/`, alternate: `/${lang === 'ko' ? 'en' : 'ko'}/categories/`, body, active: 'categories' });
}

function categoryPage(lang, name, posts) {
  const t = copy[lang];
  const label = categoryLabel(lang, name);
  const route = categoryRoute(lang, name);
  const body = `<section class="category-page shell"><a class="category-back" href="/${lang}/categories/">← ${t.allCategories}</a><div class="category-page-head"><h1>${escapeHtml(label)}</h1><span>${posts.length} ${t.articles}</span></div><div class="post-list">${postCards(lang, posts)}</div></section>`;
  return layout({ lang, title: label, description: `${label} · ${posts.length} ${t.articles}`, route, alternate: categoryRoute(lang === 'ko' ? 'en' : 'ko', name), body, active: 'categories' });
}

function articlePage(item, translation) {
  const { lang, data, body, html } = item;
  const t = copy[lang];
  const route = routeFor(item);
  const alternate = translation ? routeFor(translation) : `/${lang === 'ko' ? 'en' : 'ko'}/`;
  const inner = `<article class="article-wrap${data.page ? ' about-page' : ''}"><header class="article-header${data.page ? ' about-heading' : ''}"><div class="article-heading-copy"><p class="eyebrow">${data.page ? t.navAbout : t.eyebrow}</p><h1>${escapeHtml(data.title)}</h1><p class="article-description">${escapeHtml(data.description)}</p>${data.page ? '' : `<div class="article-meta"><a class="post-category" href="${categoryRoute(lang, data.category)}">${escapeHtml(categoryLabel(lang, data.category))}</a><span>·</span><time datetime="${escapeHtml(data.date)}">${formatDate(data.date, lang)}</time><span>·</span><span>${readingTime(body, lang)} ${t.minRead}</span></div>`}</div>${data.page ? mascot(lang, 'about') : ''}</header><div class="prose">${html}</div><div class="article-end"><a href="/${lang}/">← ${t.back}</a>${translation ? `<a href="${alternate}" hreflang="${translation.lang}">${t.readIn} →</a>` : ''}</div></article>`;
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
  await bundle({ entryPoints: [path.join(root, 'frontend/hero3d.js')], outfile: path.join(outDir, 'assets/hero3d.js'), bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'eof' });
  await fs.copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(outDir, 'assets/three-LICENSE.txt'));
  const versionHash = createHash('sha256');
  for (const name of ['hero3d.js', 'app.js', 'styles.css']) versionHash.update(await fs.readFile(path.join(outDir, 'assets', name)));
  assetVersion = versionHash.digest('hex').slice(0, 12);
  const all = [...await readContent('ko'), ...await readContent('en')];
  const translations = new Map(all.map((item) => [`${item.lang}:${item.data.translation_key}`, item]));
  for (const lang of ['ko', 'en']) {
    const posts = all.filter((item) => item.lang === lang && !item.data.page).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
    await writeRoute(`/${lang}/`, homePage(lang, posts));
    await writeRoute(`/${lang}/categories/`, categoryIndexPage(lang, posts));
    for (const name of categoriesFor(posts)) {
      await writeRoute(categoryRoute(lang, name), categoryPage(lang, name, posts.filter((post) => post.data.category === name)));
    }
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
  const categoryRoutes = ['ko', 'en'].flatMap((lang) => {
    const posts = all.filter((item) => item.lang === lang && !item.data.page);
    return [`/${lang}/categories/`, ...categoriesFor(posts).map((name) => categoryRoute(lang, name))];
  });
  const routes = ['/', '/ko/', '/en/', ...categoryRoutes, ...all.map(routeFor)];
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${absolute(route)}</loc></url>`).join('')}</urlset>`);
  await fs.writeFile(path.join(outDir, '.nojekyll'), '');
  console.log(`Built ${all.length} content pages in docs/`);
}

await build();
