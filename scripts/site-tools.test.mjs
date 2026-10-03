import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { VIEW_WINDOW_MS, shouldCountView, feedLinks, requestViewCounts } from '../static/site-tools.js';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFile(path.join(root, file), 'utf8');

test('repeat views use a bounded 30-minute window, including corrupt or future timestamps', () => {
  const now = 2_000_000_000_000;
  assert.equal(shouldCountView(null, now), true);
  assert.equal(shouldCountView('invalid', now), true);
  assert.equal(shouldCountView(now, now), false);
  assert.equal(shouldCountView(now - VIEW_WINDOW_MS + 1, now), false);
  assert.equal(shouldCountView(now - VIEW_WINDOW_MS, now), true);
  assert.equal(shouldCountView(now + 60_000, now), true);
});

test('both subscription languages produce the correct escaped reader link', () => {
  for (const language of ['ko', 'en']) {
    const { feed, reader } = feedLinks('https://whrds.github.io', language);
    assert.equal(feed, 'https://whrds.github.io/' + language + '/feed.xml');
    assert.equal(new URL(reader).searchParams.get('add_feed'), feed);
  }
  assert.throws(() => feedLinks('javascript:alert(1)', 'ko'));
  assert.throws(() => feedLinks('https://whrds.github.io', '../private'));
});

test('counter contract strips URL details and credentials; no real network is used', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: { page_pv: 12, site_pv: 104 } }) };
  };
  for (const increment of [true, false]) {
    const result = await requestViewCounts({ endpoint: 'https://counter.invalid/api', pageUrl: 'https://whrds.github.io/posts/example/?private-query=test#fragment', increment, fetcher });
    assert.deepEqual(result, { page: 12, site: 104 });
  }
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.deepEqual(calls[0].options.headers, { 'x-bsz-referer': 'https://whrds.github.io/posts/example/' });
});

test('invalid counters and network failures never become fabricated zeros', async () => {
  const input = { endpoint: 'https://counter.invalid/api', pageUrl: 'https://whrds.github.io/posts/example/', increment: true };
  for (const value of [-1, 1.5, '5', null, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(requestViewCounts({ ...input, fetcher: async () => ({ ok: true, json: async () => ({ success: true, data: { page_pv: value, site_pv: 10 } }) }) }));
  }
  await assert.rejects(requestViewCounts({ ...input, fetcher: async () => ({ ok: false }) }));
  await assert.rejects(requestViewCounts({ ...input, fetcher: async () => { throw new Error('offline'); } }));
  await assert.rejects(requestViewCounts({ ...input, endpoint: 'http://counter.invalid/api', fetcher: async () => { throw new Error('must not be called'); } }));
});

test('external counters remain disabled and generated pages expose working RSS controls', async () => {
  const settings = JSON.parse(await read('site-features.json'));
  assert.equal(settings.views.enabled, false);
  assert.equal(settings.views.endpoint, null);
  for (const language of ['ko', 'en']) {
    const routes = [
      'docs/' + language + '/index.html',
      'docs/' + language + '/categories/v8/index.html',
      'docs/' + language + '/posts/chrome-m152-externalstring-race/index.html'
    ];
    const rawFeed = await read('docs/' + language + '/feed.xml');
    assert.doesNotMatch(rawFeed, /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u, 'RSS must use only valid XML 1.0 characters');
    const feed = load(rawFeed, { xml: true });
    assert.ok(feed('rss channel item').length > 0);
    assert.equal(feed('rss channel language').text(), language);
    for (const route of routes) {
      const $ = load(await read(route));
      assert.equal($('link[type="application/rss+xml"]').attr('href'), '/' + language + '/feed.xml');
      assert.equal($('[data-view-endpoint]').length, 0);
      assert.equal($('[data-view-kind]').length, 0);
      assert.equal($('#subscribe-dialog').length, 1);
      assert.equal($('#image-lightbox').length, 1);
      assert.equal($('#subscribe-dialog[open], #image-lightbox[open]').length, 0);
      assert.equal($('#feed-url').val(), 'https://whrds.github.io/' + language + '/feed.xml');
      assert.equal(new URL($('[data-reader-link]').attr('href')).searchParams.get('add_feed'), $('#feed-url').val());
      assert.ok($('[data-subscribe-open]').length >= 2);
      assert.equal($('script[src*="site-tools.js"]').attr('type'), 'module');
      assert.ok($('script[src]').toArray().every(node => $(node).attr('src').startsWith('/assets/')));
    }
    const article = load(await read(routes[2]));
    assert.equal(article('.subscribe-card').length, 1);
    assert.equal(article('.prose img').length, 9);
    assert.equal(article('.prose a').toArray().filter(node => /확대해서 보기|View at full size/.test(article(node).text())).length, 0);
  }
});
