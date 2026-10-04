import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { load } from 'cheerio';
import { viewCount, counterNotice } from './site-features.mjs';

// Serve the built files through Playwright routes. All counters are fixtures;
// this regression check never sends visits to the live analytics service.
const docs = path.resolve(import.meta.dirname, '../docs');
const captures = await fs.mkdtemp(path.join(os.tmpdir(), 'whrds-tools-qa-'));
const origin = 'https://whrds.github.io';
const article = '/posts/chrome-m152-externalstring-race/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', hasTouch: true });
const report = { captures, checks: [], requests: [], errors: [] };
let unavailable = false;
let pageCount = 41;
let siteCount = 405;
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); };
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
await context.addInitScript(() => {
  window.addEventListener('keydown', event => {
    window.__lastKey = event;
  }, true);
});
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === 'https://busuanzi.9420.ltd') {
    const headers = await request.allHeaders();
    report.requests.push({ method: request.method(), headers });
    if (unavailable) return route.abort('failed');
    if (request.method() === 'POST') { pageCount++; siteCount++; }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': origin }, body: JSON.stringify({ success: true, data: { page_pv: pageCount, site_pv: siteCount } }) });
  }
  if (![origin, 'https://preview.invalid'].includes(url.origin)) return route.abort('blockedbyclient');
  const file = path.resolve(docs, '.' + decodeURIComponent(url.pathname), ...(url.pathname.endsWith('/') ? ['index.html'] : []));
  if (!file.startsWith(docs + path.sep)) return route.abort('blockedbyclient');
  try {
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(file)];
    // Add counter markup only to intercepted fixture HTML while the deployed
    // configuration is disabled. The matching API above is always mocked.
    if (type === 'text/html' && url.pathname.includes('/posts/')) {
      const $ = load(await fs.readFile(file, 'utf8'));
      if (!$('body').attr('data-view-endpoint')) {
        const lang = $('html').attr('lang');
        $('body').attr('data-view-endpoint', 'https://busuanzi.9420.ltd/api').attr('data-view-page', origin + article);
        $('.article-meta').append(viewCount(lang));
        $('.footer-tools').prepend(viewCount(lang, 'site'));
        $('.site-footer').after(counterNotice(lang));
      }
      return route.fulfill({ status: 200, contentType: type, body: $.html() });
    }
    await route.fulfill({ status: 200, path: file, ...(type ? { contentType: type } : {}) });
  } catch { await route.fulfill({ status: 404, body: 'Not found' }); }
});
const watch = page => page.on('pageerror', error => report.errors.push(error.message));
const waitCounts = page => page.waitForFunction(() => /^\d/.test(document.querySelector('[data-view-kind="page"] [data-view-value]')?.textContent || ''));
const cancelled = (page, selector, type) => page.locator(selector).first().evaluate((node, type) => !node.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })), type);
try {
  const page = await context.newPage();
  watch(page);
  await page.goto(origin + '/ko' + article + '?campaign=private#top');
  await waitCounts(page);
  check('first visible visit increments and displays a real response', await page.locator('[data-view-kind="page"] [data-view-value]').textContent() === '42');
  check('site total is displayed', await page.locator('[data-view-kind="site"] [data-view-value]').textContent() === '406');
  check('counter sends only the shared URL without query, fragment, cookies or referrer', report.requests[0].method === 'POST' && report.requests[0].headers['x-bsz-referer'] === origin + article && !report.requests[0].headers.cookie && !report.requests[0].headers.referer);
  check('article text cannot be selected normally', await page.locator('.prose').evaluate(el => getComputedStyle(el).userSelect) === 'none');
  for (const selector of ['.prose img', '.prose pre', '.prose p', '.article-header']) {
    check(selector + ' context menu is cancelled', await cancelled(page, selector, 'contextmenu'));
  }
  check('image dragging is cancelled', await cancelled(page, '.prose img', 'dragstart'));
  check('image middle click is cancelled', await cancelled(page, '.image-zoom', 'auxclick'));
  check('images use buttons instead of original-file links', await page.locator('.prose .image-zoom').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.tagName === 'BUTTON' && !node.hasAttribute('href'))));
  check('copying a selection spanning article text is cancelled', await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('.prose'));
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const allowed = document.body.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() }));
    selection.removeAllRanges();
    return !allowed;
  }));
  for (const key of ['F12', 'Control+Shift+I', 'Control+Shift+J', 'Control+Shift+C', 'Control+Shift+K', 'Meta+Alt+I', 'Control+u', 'Control+s', 'Control+p', 'Control+a']) {
    await page.keyboard.press(key);
    check(key + ' is cancelled when delivered to the page', await page.evaluate(() => window.__lastKey?.defaultPrevented));
  }
  for (const key of ['Control+f', 'Control+-', 'Tab', 'Escape']) {
    await page.keyboard.press(key);
    check(key + ' remains available', !(await page.evaluate(() => window.__lastKey?.defaultPrevented)));
  }
  await page.locator('.header-tools [data-subscribe-open]').click();
  await page.locator('[data-feed-language="en"]').click();
  await page.locator('[data-copy-feed]').click();
  check('RSS copy button still writes the selected language URL', await page.evaluate(() => navigator.clipboard.readText()) === origin + '/en/feed.xml');
  await page.locator('#feed-url').focus();
  await page.keyboard.press('Control+a');
  check('RSS input supports select all', !(await page.evaluate(() => window.__lastKey?.defaultPrevented)));
  check('RSS input copy is not intercepted', !(await cancelled(page, '#feed-url', 'copy')));
  await page.keyboard.press('Escape');
  check('Escape closes the RSS dialog', !(await page.locator('#subscribe-dialog').evaluate(el => el.open)));
  await page.locator('.image-zoom').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-lightbox-image]').naturalWidth > 0);
  check('keyboard activation opens the image viewer', await page.locator('#image-lightbox').evaluate(el => el.open));
  await page.locator('[data-image-scale]').click();
  check('additional image enlargement still works', await page.locator('#image-lightbox').getAttribute('data-zoomed') === 'true');
  await page.keyboard.press('Escape');
  check('Escape closes the image viewer', !(await page.locator('#image-lightbox').evaluate(el => el.open)));
  await page.emulateMedia({ media: 'print' });
  check('browser printing shows a notice without article content', await page.locator('.print-notice').isVisible() && !(await page.locator('.prose').isVisible()));
  await page.emulateMedia({ media: 'screen' });
  await page.reload();
  await waitCounts(page);
  check('same-tab reload reads without incrementing', report.requests.at(-1).method === 'GET' && pageCount === 42);
  await page.goto(origin + '/en' + article);
  await waitCounts(page);
  check('switching language preserves the counter and 30-minute window', report.requests.at(-1).method === 'GET' && pageCount === 42);
  await page.screenshot({ path: path.join(captures, 'desktop-en.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/ko' + article);
  await waitCounts(page);
  check('mobile article has no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(captures, 'mobile-ko.png') });
  await page.locator('.image-zoom').first().tap();
  check('mobile image tap opens the viewer', await page.locator('#image-lightbox').evaluate(el => el.open));
  await page.screenshot({ path: path.join(captures, 'mobile-image.png') });
  await page.locator('#image-lightbox [data-dialog-close]').click();
  const failure = await context.newPage();
  watch(failure);
  unavailable = true;
  await failure.goto(origin + '/ko' + article);
  await failure.waitForFunction(() => document.querySelector('[data-view-kind="page"]').title.includes('잠시'));
  check('counter failure displays unavailable instead of fabricated zero', await failure.locator('[data-view-kind="page"] [data-view-value]').textContent() === '—');
  unavailable = false;
  await failure.reload();
  await waitCounts(failure);
  check('failed visits can be retried on reload', report.requests.at(-1).method === 'POST');
  const beforePreview = report.requests.length;
  await failure.goto('https://preview.invalid/ko' + article);
  await failure.waitForFunction(() => document.querySelector('[data-view-kind="page"]').title.includes('미리보기'));
  check('preview origins never contact the counter', report.requests.length === beforePreview);
  await failure.goto(origin + '/404.html');
  check('404 pages never contact the counter or show a misleading count', report.requests.length === beforePreview && await failure.locator('[data-view-kind]').count() === 0);
  check('no JavaScript exceptions', report.errors.length === 0);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
