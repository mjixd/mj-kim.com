const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mock = require('./camera-mock.cjs');
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'hello-w-tests');
const url = process.env.GAME_URL || 'http://127.0.0.1:8789/hello-w-play/';
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const fields = [
  { key: 'mechanical', name: 'Mechanical engineering', level: 0, prompt: /force|motion|mechanic|movement/i },
  { key: 'civil', name: 'Civil engineering', level: 1, prompt: /bridge|civil|structure/i },
  { key: 'software', name: 'Software engineering', level: 2, prompt: /software|sequence|loop|code|program/i },
];
const digest = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [], requests = [], badAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('response', response => { if (response.status() >= 400) badAssets.push({ url: response.url(), status: response.status() }); });
  await page.addInitScript(mock);
  await page.goto(url);
  check('fresh load keeps game controls behind explicit start', !(await page.locator('[data-direction="E"]').isVisible()));
  check('entry offers all three engineering fields', (await Promise.all(fields.map(field => page.getByRole('button', { name: field.name, exact: true }).isVisible()))).every(Boolean));
  check('entry offers explicit Start exploring', await page.getByRole('button', { name: 'Start exploring', exact: true }).isVisible());
  check('entry does not request camera', await page.evaluate(() => cameraTest.calls === 0));
  await page.screenshot({ path: path.join(out, 'onboarding-initial.png'), fullPage: true });

  // The four checks above are independently runnable on the pre-feature page.
  if (await page.locator('#field-selection').isVisible()) {
    const photo = await page.locator('#field-selection').evaluate(element => {
      const images = [...element.querySelectorAll('img')].filter(image => image.complete && image.naturalWidth >= 600);
      const backgrounds = [element, ...element.querySelectorAll('*')].flatMap(node => [null, '::before', '::after'].map(pseudo => getComputedStyle(node, pseudo).backgroundImage)).filter(value => /url\(/.test(value));
      return { images: images.map(image => ({ src: image.currentSrc, width: image.naturalWidth })), backgrounds };
    });
    check('entry contains a loaded space photograph', photo.images.length > 0 || photo.backgrounds.length > 0, photo);
    await page.keyboard.press('ArrowRight');
    check('entry keyboard cannot move hidden game', await page.locator('#board').getAttribute('data-steps') === '0');

    for (const field of fields) {
      await page.getByRole('button', { name: field.name, exact: true }).click();
      check(field.key + ' selection is exclusive and game remains gated', await page.locator('[data-field][aria-pressed="true"]').count() === 1 && await page.locator(`[data-field="${field.key}"]`).getAttribute('aria-pressed') === 'true' && !await page.locator('#board').isVisible());
      await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
      check(field.key + ' starts its relevant fresh challenge', await page.locator('#board').isVisible() && await page.locator(`[data-level="${field.level}"]`).getAttribute('aria-pressed') === 'true' && await page.locator('#board').getAttribute('data-position') === '0,4' && await page.locator('#board').getAttribute('data-steps') === '0' && !await page.locator('#field-selection').isVisible());
      check(field.key + ' remains visibly identified in game', (await page.locator('#game-content').innerText()).toLowerCase().includes(field.name.toLowerCase()));
      await page.locator('#open-mentor').click();
      check(field.key + ' mentor prompt carries selected context', field.prompt.test(await page.locator('#question').inputValue()));
      await page.locator('#close-mentor').click();
      await page.locator('#change-field').click();
      check(field.key + ' can return to selection', await page.locator('#field-selection').isVisible() && !await page.locator('#board').isVisible());
    }

    await page.locator('[data-field="software"]').click();
    await page.locator('#start-exploring').click();
    for (const direction of ['E', 'N', 'E', 'N']) await page.locator(`[data-direction="${direction}"]`).click();
    await page.locator('#run').click();
    await page.waitForFunction(() => document.querySelector('#board').dataset.steps === '1');
    await page.locator('#camera-toggle').click();
    await page.locator('#change-field').click();
    const frozen = await page.locator('#board').getAttribute('data-position');
    await page.keyboard.press('ArrowRight');
    check('returning to selection disables hidden game keyboard input', await page.locator('#board').getAttribute('data-position') === frozen);
    await page.evaluate(() => cameraTest.pending.shift().resolve());
    await page.waitForTimeout(850);
    check('changing field cancels queued program while selection is visible', await page.locator('#field-selection').isVisible() && await page.locator('#board').getAttribute('data-position') === frozen);
    check('changing field invalidates late camera permission', await page.evaluate(() => cameraTest.tracks.every(track => track.stopped > 0) && !document.querySelector('#camera').srcObject));
    await page.locator('[data-field="mechanical"]').click();
    await page.locator('#start-exploring').click();
    await page.locator('#camera-toggle').click();
    await page.evaluate(() => cameraTest.pending.shift().resolve());
    await page.waitForTimeout(50);
    check('camera fixture becomes active only after explicit request', await page.evaluate(() => !!document.querySelector('#camera').srcObject));
    await page.locator('#change-field').click();
    check('changing field closes active camera', await page.evaluate(() => cameraTest.tracks.every(track => track.stopped > 0) && !document.querySelector('#camera').srcObject));

    const model = page.locator('#model-view');
    await model.scrollIntoViewIfNeeded();
    const canvas = model.locator('canvas');
    check('entry renders a real canvas scene', await canvas.count() > 0 && await canvas.isVisible());
    if (await canvas.count()) {
      await page.waitForTimeout(150);
      const capture = () => canvas.screenshot();
      // GPU compositing can change a few pixels by one channel value while idle.
      // Count substantive pixel changes, using the browser's own PNG decoder.
      const changedFraction = async (before, after) => page.evaluate(async ([first, second]) => {
        async function pixels(encoded) {
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const surface = new OffscreenCanvas(bitmap.width, bitmap.height), context = surface.getContext('2d');
          context.drawImage(bitmap, 0, 0);
          return { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
        }
        const a = await pixels(first), b = await pixels(second);
        if (a.width !== b.width || a.height !== b.height) return 1;
        let changed = 0;
        for (let index = 0; index < a.data.length; index += 4) {
          if ([0, 1, 2].some(channel => Math.abs(a.data[index + channel] - b.data[index + channel]) > 2)) changed++;
        }
        return changed / (a.width * a.height);
      }, [before.toString('base64'), after.toString('base64')]);
      const initialBuffer = await canvas.screenshot();
      fs.writeFileSync(path.join(out, 'model-idle-before.png'), initialBuffer);
      const initial = initialBuffer;
      await page.waitForTimeout(350);
      const idleBuffer = await canvas.screenshot();
      fs.writeFileSync(path.join(out, 'model-idle-after.png'), idleBuffer);
      const idleChange = await changedFraction(initial, idleBuffer);
      check('reduced motion disables idle rotation', idleChange === 0, { changedFraction: idleChange });
      await page.locator('#rotate-right').click();
      await page.waitForTimeout(100);
      check('rotation button visibly manipulates 3D object', await changedFraction(initial, await capture()) > .005);
      await page.locator('#reset-view').click();
      await page.waitForTimeout(100);
      const reset = await capture();
      await model.focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      check('keyboard visibly manipulates 3D object', await changedFraction(reset, await capture()) > .005);
      const beforeDrag = await capture(), box = await model.boundingBox();
      await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(100);
      check('pointer drag visibly manipulates 3D object', await changedFraction(beforeDrag, await capture()) > .005);
    }

    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, controls: [...document.querySelectorAll('[data-field],#start-exploring,#rotate-left,#rotate-right,#reset-view')].map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }; }) }));
      check(width + ' entry fits width with usable controls', !geometry.overflow && geometry.controls.every(control => control.left >= 0 && control.right <= width + 1 && control.width >= 24 && control.height >= 24), geometry);
      await page.screenshot({ path: path.join(out, `onboarding-${width}.png`), fullPage: true });
    }

    await canvas.evaluate(element => element.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => document.querySelector('#model-view').dataset.rendering === 'fallback');
    check('losing an active WebGL context gives a visible fallback', await page.locator('#model-status').isVisible() && /unavailable/i.test(await page.locator('#model-status').innerText()));
    await page.locator('[data-field="software"]').click();
    await page.locator('#start-exploring').click();
    await page.locator('#change-field').click();
    await page.locator('[data-field="civil"]').click();
    await page.locator('#start-exploring').click();
    check('context loss keeps selection and game reentry usable', await page.locator('#board').isVisible() && await page.locator('[data-level="1"]').getAttribute('aria-pressed') === 'true');

    const touch = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await touch.addInitScript(mock);
    await touch.goto(url);
    const session = await touch.context().newCDPSession(touch);
    const modelBox = await touch.locator('#model-view').boundingBox();
    const x = Math.min(350, modelBox.x + modelBox.width / 2), y = Math.min(600, modelBox.y + modelBox.height / 2);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 30 }] });
      await touch.waitForTimeout(20);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.waitForTimeout(200);
    check('vertical touch gesture on model still scrolls page', await touch.evaluate(() => scrollY > 20));
    await touch.close();

    const fallback = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await fallback.addInitScript(mock);
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
    });
    await fallback.goto(url);
    check('WebGL unavailable shows a visible explanation', await fallback.locator('#model-status').isVisible() && /unavailable|not available|3D|preview|support/i.test(await fallback.locator('#model-status').innerText()));
    await fallback.locator('[data-field="civil"]').click();
    await fallback.locator('#start-exploring').click();
    check('WebGL fallback still allows field selection and game entry', await fallback.locator('#board').isVisible() && await fallback.locator('[data-level="1"]').getAttribute('aria-pressed') === 'true' && await fallback.evaluate(() => cameraTest.calls === 0));
    await fallback.close();
  }
  check('entry assets load successfully', badAssets.length === 0, badAssets);
  check('entry and game use only local read requests', requests.every(request => request.method === 'GET' && new URL(request.url).origin === new URL(url).origin), requests.filter(request => request.method !== 'GET' || new URL(request.url).origin !== new URL(url).origin));
  check('entry and game produce no browser errors', errors.length === 0, errors);
  await browser.close();
  const hashes = {};
  for (const file of fs.readdirSync(path.join(__dirname, '..')).filter(file => /\.(js|html|css)$/.test(file))) hashes[file] = digest(fs.readFileSync(path.join(__dirname, '..', file)));
  const result = { checks, hashes, failures: checks.filter(item => !item.pass) };
  fs.writeFileSync(path.join(out, 'onboarding-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(item => item.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
