import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const root = path.resolve(import.meta.dirname, '..');
const source = 'https://whrdud727.tistory.com/entry/';
const manifest = JSON.parse(await fs.readFile(path.join(root, 'tistory-migration.json'), 'utf8'));
const errors = [];

async function readPosts(lang) {
  const dir = path.join(root, 'content', lang);
  const posts = [];
  for (const filename of await fs.readdir(dir)) {
    if (!filename.endsWith('.md')) continue;
    const raw = await fs.readFile(path.join(dir, filename), 'utf8');
    const parsed = matter(raw);
    if (parsed.data.source_url?.startsWith(source)) posts.push({ filename, raw, ...parsed.data });
  }
  return posts;
}

const ko = await readPosts('ko');
const en = await readPosts('en');
const enByKey = new Map(en.map((post) => [post.translation_key, post]));
const sourceUrls = new Set();
for (const post of ko) {
  if (sourceUrls.has(post.source_url)) errors.push(`duplicate source URL: ${post.source_url}`);
  sourceUrls.add(post.source_url);
  const pair = enByKey.get(post.translation_key);
  if (!pair) errors.push(`missing English pair: ${post.filename}`);
  if (pair && pair.source_url !== post.source_url) errors.push(`source mismatch: ${post.filename}`);
  for (const match of post.raw.matchAll(/\/assets\/(images\/[^\s)"']+)/g)) {
    try { await fs.access(path.join(root, 'static', match[1])); }
    catch { errors.push(`missing image: ${match[1]}`); }
  }
}

if (manifest.discovered !== 79 || manifest.migrated !== 79 || manifest.failures.length) {
  errors.push(`manifest mismatch: ${manifest.migrated}/${manifest.discovered}, failures=${manifest.failures.length}`);
}
if (ko.length !== 79 || en.length !== 79) errors.push(`post count mismatch: ko=${ko.length}, en=${en.length}`);
if (sourceUrls.size !== 79) errors.push(`unique source count mismatch: ${sourceUrls.size}`);
if (enByKey.size !== 79) errors.push(`unique translation key mismatch: ${enByKey.size}`);

console.log(`Validated public migration: ko=${ko.length}, en=${en.length}, sources=${sourceUrls.size}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Validation passed.');
