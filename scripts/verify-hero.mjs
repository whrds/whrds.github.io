import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '..');
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4175';
const capturePoster = process.argv.includes('--poster');
const captureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whrds-three-qa-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { captures: captureDir, errors: [], checks: [] };
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); };
const canvasPixels = page => page.locator('[data-three-stage] canvas').evaluate(canvas => {
  const sample = document.createElement('canvas'); sample.width = sample.height = 96;
  const context = sample.getContext('2d'); context.drawImage(canvas, 0, 0, 96, 96);
  return Array.from(context.getImageData(0, 0, 96, 96).data);
});
function changedFraction(before, after) {
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) + Math.abs(before[i + 3] - after[i + 3]) > 45) changed++;
  }
  return changed / (before.length / 4);
}
const pose = page => page.locator('[data-hardware]').evaluate(el => ({ rotation: +el.dataset.rotation, azimuth: +el.dataset.azimuth, polar: +el.dataset.polar }));
async function swipe(client, x, y, dx, dy, end = 'touchEnd') {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 12; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12, id: 1 }] });
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  await client.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('theme', 'light'); });
  await page.goto(origin + '/ko/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-hardware][data-state="ready"]', { timeout: 90000 });
  await page.waitForTimeout(800);
  check('reduced motion disables auto-rotation', await page.locator('[data-motion]').getAttribute('aria-pressed') === 'false');
  check('Korean headline preserved', (await page.locator('h1').textContent()) === '끄저끄적 작성 중...');
  check('all posts preserved', await page.locator('.post-card').count() === 79);
  report.renderer = await page.locator('[data-hardware]').evaluate((el) => ({ drawCalls: el.dataset.renderCalls, triangles: el.dataset.triangles, canvas: [el.querySelector('canvas').width, el.querySelector('canvas').height] }));
  await page.screenshot({ path: path.join(captureDir, 'desktop.png') });
  const assembledImage = await page.locator('[data-three-stage]').screenshot();
  if (capturePoster) {
    await page.addStyleTag({ content: '.hardware-overline,.hardware-side-label{visibility:hidden!important}' });
    await page.locator('[data-three-stage]').screenshot({ path: path.join(root, 'static/hardware-poster.png') });
    await page.locator('style').last().evaluate((el) => el.remove());
    check('poster generated from actual 3D model', true);
  }
  await page.locator('[data-explode]').click();
  await page.waitForTimeout(200);
  check('exploded view toggles', await page.locator('[data-explode]').getAttribute('aria-pressed') === 'true');
  check('exploded view changes actual rendered model', !assembledImage.equals(await page.locator('[data-three-stage]').screenshot()));
  await page.screenshot({ path: path.join(captureDir, 'exploded.png') });
  report.models = {};
  const canvasImage = () => page.locator('[data-three-stage] canvas').evaluate(canvas => canvas.toDataURL());
  const seenModels = new Set();
  for (const id of ['board', 'memory', 'firmware', 'nas']) {
    await page.locator(`button[data-model="${id}"]`).click();
    await page.waitForSelector(`[data-hardware][data-model="${id}"]`);
    await page.locator('[data-reset]').click();
    await page.waitForTimeout(250);
    const assembled = await canvasImage();
    check(`${id}: distinct rendered geometry`, !seenModels.has(assembled)); seenModels.add(assembled);
    check(`${id}: exactly one selected model`, await page.locator('[data-model][aria-pressed="true"]').count() === 1);
    const stats = await page.locator('[data-hardware]').evaluate(el => ({ calls: +el.dataset.renderCalls, triangles: +el.dataset.triangles, geometries: +el.dataset.geometries, textures: +el.dataset.textures }));
    report.models[id] = stats;
    check(`${id}: bounded scene complexity`, stats.calls < 400 && stats.triangles < 130000);
    await page.locator('[data-three-stage]').screenshot({ path: path.join(captureDir, `${id}.png`) });
    await page.locator('[data-explode]').click(); await page.waitForTimeout(250);
    check(`${id}: exploded geometry changes`, assembled !== await canvasImage());
    await page.locator('[data-three-stage]').screenshot({ path: path.join(captureDir, `${id}-exploded.png`) });
  }
  const cachedMemory = await page.locator('[data-hardware]').evaluate(el => [el.dataset.geometries, el.dataset.textures].join('/'));
  for (let round = 0; round < 3; round++) for (const id of ['memory', 'firmware', 'board', 'nas']) {
    await page.locator(`button[data-model="${id}"]`).click(); await page.waitForSelector(`[data-hardware][data-model="${id}"]`);
  }
  await page.waitForTimeout(200);
  check('repeated switching reuses GPU resources', cachedMemory === await page.locator('[data-hardware]').evaluate(el => [el.dataset.geometries, el.dataset.textures].join('/')));
  await page.locator('button[data-model="nas"]').focus(); await page.keyboard.press('Home');
  check('model picker supports keyboard navigation', await page.locator('button[data-model="board"]').evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter'); await page.waitForSelector('[data-hardware][data-model="board"]');
  await page.locator('[data-reset]').click();
  check('reset assembles model', await page.locator('[data-explode]').getAttribute('aria-pressed') === 'false');
  const canvasBounds = await page.locator('[data-three-stage] canvas').boundingBox();
  const startFrames = Number(await page.locator('[data-hardware]').getAttribute('data-frames'));
  const beforeDesktopDrag = await canvasPixels(page);
  await page.mouse.move(canvasBounds.x + canvasBounds.width / 2, canvasBounds.y + canvasBounds.height / 2);
  await page.mouse.down(); await page.mouse.move(canvasBounds.x + canvasBounds.width / 2 + 65, canvasBounds.y + canvasBounds.height / 2 + 25, { steps: 8 }); await page.mouse.up();
  check('desktop drag triggers rendering', Number(await page.locator('[data-hardware]').getAttribute('data-frames')) > startFrames);
  check('desktop dragging changes actual rendered pixels', changedFraction(beforeDesktopDrag, await canvasPixels(page)) > .02);
  await page.locator('[data-motion]').click();
  const activeFrames = Number(await page.locator('[data-hardware]').getAttribute('data-frames'));
  const desktopAutoStart = await pose(page), beforeDesktopAuto = await canvasPixels(page);
  await page.waitForTimeout(1200);
  check('explicit auto-rotate animates even when reduced motion is preferred', Number(await page.locator('[data-hardware]').getAttribute('data-frames')) > activeFrames + 2);
  check('desktop automatic rotation advances visibly', (await pose(page)).rotation - desktopAutoStart.rotation > .20 && changedFraction(beforeDesktopAuto, await canvasPixels(page)) > .02);
  check('running rotation button has a clear stop label', await page.locator('[data-motion]').textContent() === '회전 멈추기');
  await page.locator('[data-motion]').click(); await page.waitForTimeout(150);
  const stoppedAngle = (await pose(page)).rotation;
  await page.waitForTimeout(300);
  check('desktop stop button holds the angle', (await pose(page)).rotation === stoppedAngle);
  await page.locator('[data-motion]').click();
  await page.locator('.post-card').nth(5).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const offscreenFrames = await page.locator('[data-hardware]').getAttribute('data-frames');
  await page.waitForTimeout(400);
  check('offscreen rendering pauses', await page.locator('[data-hardware]').getAttribute('data-frames') === offscreenFrames);
  await page.locator('[data-reset]').click();
  await page.locator('[data-theme-toggle]').click();
  check('dark theme still works', await page.locator('html').getAttribute('data-theme') === 'dark');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  const alpha = await page.locator('[data-three-stage] canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2'); const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[3];
  });
  check('idle canvas retains model after theme change and scroll return', alpha > 0);
  await page.screenshot({ path: path.join(captureDir, 'dark.png') });
  await page.locator('.language-switch a[lang="en"]').click();
  await page.waitForSelector('[data-state="ready"]', { timeout: 90000 });
  check('English controls translated', await page.locator('[data-explode]').textContent() === 'Explode');
  await page.locator('button[data-model="firmware"]').click();
  await page.waitForSelector('[data-hardware][data-model="firmware"]');
  check('English model descriptions translated', (await page.locator('[data-model-detail]').textContent()).includes('silicon die'));
  check('English model picker labels translated', (await page.locator('button[data-model="memory"]').textContent()).includes('Memory'));
  await page.goto(origin + '/ko/categories/');
  check('category pages intact', await page.locator('.category-card').count() === 8);
  check('3D bundle absent on category pages', await page.evaluate(() => !performance.getEntriesByType('resource').some((r) => r.name.includes('hero3d.js'))));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', (error) => report.errors.push(error.message));
  await mobile.goto(origin + '/ko/', { waitUntil: 'networkidle' });
  await mobile.waitForSelector('[data-state="ready"]', { timeout: 90000 });
  check('mobile has no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: path.join(captureDir, 'mobile.png') });
  const touch = await mobile.context().newCDPSession(mobile);
  await mobile.locator('[data-three-stage]').scrollIntoViewIfNeeded();
  const touchBounds = await mobile.locator('[data-three-stage] canvas').boundingBox();
  const sx = touchBounds.x + touchBounds.width * .35, sy = touchBounds.y + touchBounds.height * .55;
  const beforeMobileDrag = await canvasPixels(mobile), beforeTouchPose = await pose(mobile), beforeTouchScroll = await mobile.evaluate(() => scrollY);
  await swipe(touch, sx, sy, 75, -40);
  await mobile.waitForTimeout(150);
  check('real mobile one-finger drag changes horizontal and vertical angles', Math.abs((await pose(mobile)).azimuth - beforeTouchPose.azimuth) > .1 && Math.abs((await pose(mobile)).polar - beforeTouchPose.polar) > .1);
  check('real mobile drag changes rendered pixels', changedFraction(beforeMobileDrag, await canvasPixels(mobile)) > .03);
  check('dragging the model does not scroll the page', Math.abs(await mobile.evaluate(() => scrollY) - beforeTouchScroll) < 2);
  await swipe(touch, sx, sy, -40, 20, 'touchCancel');
  const cancelledPose = await pose(mobile);
  await swipe(touch, sx, sy, 50, 0); await mobile.waitForTimeout(100);
  check('mobile dragging still works after a cancelled gesture', Math.abs((await pose(mobile)).azimuth - cancelledPose.azimuth) > .1);
  await mobile.locator('[data-motion]').click();
  const mobileAutoStart = await pose(mobile), beforeMobileAuto = await canvasPixels(mobile);
  await mobile.waitForTimeout(1200);
  check('mobile automatic rotation advances visibly', (await pose(mobile)).rotation - mobileAutoStart.rotation > .20 && changedFraction(beforeMobileAuto, await canvasPixels(mobile)) > .02);
  await mobile.locator('[data-motion]').click(); await mobile.waitForTimeout(150);
  const mobileStoppedAngle = (await pose(mobile)).rotation; await mobile.waitForTimeout(300);
  check('mobile stop button holds the angle', (await pose(mobile)).rotation === mobileStoppedAngle);
  await mobile.locator('[data-three-stage]').scrollIntoViewIfNeeded();
  const outsideStart = await mobile.evaluate(() => scrollY);
  await swipe(touch, 5, 630, 0, -160); await mobile.waitForTimeout(250);
  check('swiping outside the canvas still scrolls the blog', await mobile.evaluate(() => scrollY) > outsideStart + 50);
  await mobile.locator('[data-explode]').click();
  check('mobile explode button works', await mobile.locator('[data-explode]').getAttribute('aria-pressed') === 'true');
  for (const id of ['memory', 'firmware', 'nas']) {
    await mobile.locator(`button[data-model="${id}"]`).click(); await mobile.waitForSelector(`[data-hardware][data-model="${id}"]`);
    await mobile.locator('[data-explode]').click(); await mobile.waitForTimeout(200);
    check(`mobile ${id}: controls and layout work`, await mobile.locator('[data-explode]').getAttribute('aria-pressed') === 'true' && await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.locator('[data-motion]').click();
    const startingPose = await pose(mobile); await mobile.waitForTimeout(500);
    check(`mobile ${id}: auto-rotation works after changing models`, (await pose(mobile)).rotation - startingPose.rotation > .08);
    await mobile.locator('[data-motion]').click();
  }
  await mobile.locator('[data-three-stage]').screenshot({ path: path.join(captureDir, 'mobile-nas.png') });
  const fallback = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  await fallback.goto(origin + '/ko/');
  await fallback.waitForSelector('[data-state="fallback"]');
  check('WebGL failure preserves posts', await fallback.locator('.post-card').count() === 79);
  check('WebGL fallback hides model picker', !await fallback.locator('[data-model-picker]').isVisible());
  if (!capturePoster) check('fallback poster loads', await fallback.locator('.hardware-poster').evaluate((img) => img.complete && img.naturalWidth > 0));
  const saver = await browser.newPage();
  await saver.addInitScript(() => { Object.defineProperty(navigator, 'connection', { value: { saveData: true } }); });
  await saver.goto(origin + '/ko/', { waitUntil: 'networkidle' });
  check('data saver does not download 3D automatically', await saver.evaluate(() => !performance.getEntriesByType('resource').some((r) => r.name.includes('hero3d.js'))));
  await saver.locator('[data-load-three]').click();
  await saver.waitForSelector('[data-state="ready"]', { timeout: 90000 });
  check('data saver allows explicit 3D opt-in', true);
  check('no JavaScript exceptions', report.errors.length === 0);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
