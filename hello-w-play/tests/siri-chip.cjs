// Independent black-box contract, written before implementation: Siri-only Apple
// chip-section composition, real motion and lifecycle, responsive and reduced motion.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'siri-chip-tests');
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const settle = page => page.waitForTimeout(250);
const wave = page => page.locator('[data-siri-chip-wave] canvas');
async function sample(page) {
  return wave(page).evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0, black = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 20 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 40) bright++;
      if (pixels[i + 3] < 20 || Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 25) black++;
    }
    return { image: canvas.toDataURL(), draws: canvas.__testDraws || 0, bright, black, area: pixels.length / 4, width: canvas.width, height: canvas.height };
  });
}
async function movement(page, label, expected) {
  const a = await sample(page); await page.waitForTimeout(450); const b = await sample(page);
  check(label, expected ? a.image !== b.image && b.draws > a.draws : a.image === b.image && b.draws === a.draws,
    { changed: a.image !== b.image, draws: b.draws - a.draws });
}
async function show(page) {
  await page.locator('[data-siri-chip-wave]').scrollIntoViewIfNeeded(); await settle(page);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    // Observe actual drawing without coupling to the effect's scheduling internals.
    for (const method of ['clearRect', 'fillRect', 'fill', 'stroke', 'drawImage', 'putImageData']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        this.canvas.__testDraws = (this.canvas.__testDraws || 0) + 1;
        return original.apply(this, args);
      };
    }
  });
  await page.goto(base + '#/work/line'); await page.locator('main h1').waitFor(); await settle(page);
  const section = page.locator('[data-siri-chip]');
  const count = await section.count();
  check('LINE detail presents one Siri chip composition section', count === 1, count);
  check('existing Siri montage and voice story survive', await page.locator('[data-siri-hero]').count() === 1 && await page.locator('[data-siri-voice]').count() === 1);
  if (count === 1) {
    const background = await section.evaluate(root => getComputedStyle(root).backgroundColor);
    check('section preserves archived Apple background #121212', background === 'rgb(18, 18, 18)', background);
    const images = await section.locator('img').evaluateAll(nodes => nodes.map(node => node.currentSrc || node.src));
    const assets = [];
    for (const url of images) { const response = await page.request.get(url); assets.push({ url, hash: response.ok() ? hash(await response.body()) : null }); }
    check('phone uses original archived Apple image unchanged and locally', assets.some(asset => asset.hash === '6717df6493d74d05f14085857eed3b91805a6b05a3094d1eb1e6c04408941eda' && new URL(asset.url).origin === new URL(base).origin), assets);
    const copy = await section.innerText();
    check('section has visible Siri heading', /Siri/i.test(await section.locator('h2,h3').innerText()), copy);
    check('chip performance claims and Learn more CTA are absent', !/most powerful chip|A10 Fusion|Learn more/i.test(copy) && await section.getByRole('link', { name: /Learn more/i }).count() === 0, copy);
    check('Siri-only career detail remains', !/AI Speaker|CLOVA/i.test(await page.locator('main').innerText()));
    check('one canvas renders the Siri effect', await wave(page).count() === 1, await wave(page).count());
    if (await wave(page).count() === 1) {
      await show(page);
      const backing = await page.locator('[data-siri-chip-wave]').evaluate(root => getComputedStyle(root).backgroundColor);
      check('Siri effect has a black screen backing', backing === 'rgb(0, 0, 0)', backing);
      const visible = await sample(page);
      check('Siri has visible colored pixels on a predominantly black screen', visible.bright > 20 && visible.black / visible.area > .5, { ...visible, image: undefined });
      await movement(page, 'visible Siri animation changes pixels', true);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await show(page);
        const geometry = await section.evaluate(root => {
          const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; };
          return { documentWidth: document.documentElement.scrollWidth, section: rect(root), effect: rect(root.querySelector('[data-siri-chip-wave]')), text: [...root.querySelectorAll('h2,h3,p')].filter(n => n.textContent.trim()).map(rect) };
        });
        check(width + ': section, Siri, and text fit viewport', geometry.documentWidth <= width + 1 && geometry.effect.width > 20 && geometry.effect.height > 10 && [geometry.section, geometry.effect, ...geometry.text].every(r => r.left >= -1 && r.right <= width + 1), geometry);
        await page.screenshot({ path: path.join(out, 'chip-' + width + '.png') });
      }
      await page.evaluate(() => scrollTo(0, 0)); await settle(page);
      const outside = await wave(page).evaluate(node => { const r = node.getBoundingClientRect(); return r.top >= innerHeight || r.bottom <= 0; });
      check('offscreen test actually places effect outside viewport', outside);
      if (outside) await movement(page, 'offscreen Siri stops drawing', false);
      await show(page); await movement(page, 'Siri resumes when visible again', true);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      }); await settle(page);
      await movement(page, 'hidden-document event stops Siri drawing', false);
      await page.evaluate(() => {
        delete document.hidden; delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      }); await settle(page);
      await movement(page, 'visible-document event resumes Siri drawing', true);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page);
      await movement(page, 'live reduced-motion preference stops animation', false);
      check('reduced motion preserves visible Siri artwork', (await sample(page)).bright > 20);
      await page.reload(); await section.waitFor(); await show(page);
      await movement(page, 'reduced-motion page entry stays static', false);
      check('reduced-motion entry preserves visible Siri artwork', (await sample(page)).bright > 20);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await settle(page); await show(page);
      await movement(page, 'removing reduced-motion preference resumes animation', true);
      for (let cycle = 0; cycle < 2; cycle++) {
        await wave(page).evaluate(canvas => { window.__oldSiriChipCanvas = canvas; });
        await page.evaluate(() => location.hash = '#/about'); await section.waitFor({ state: 'detached' }); await settle(page);
        const before = await page.evaluate(() => window.__oldSiriChipCanvas.__testDraws);
        await page.waitForTimeout(450);
        const after = await page.evaluate(() => window.__oldSiriChipCanvas.__testDraws);
        check('route exit ' + cycle + ' leaves no drawing on detached canvas', before === after && await wave(page).count() === 0, { before, after });
        await page.evaluate(() => location.hash = '#/work/line'); await section.waitFor(); await show(page);
        check('route reentry ' + cycle + ' creates exactly one effect', await section.count() === 1 && await wave(page).count() === 1);
        await movement(page, 'route reentry ' + cycle + ' restores moving Siri', true);
      }
    }
  }
  check('browser emits no page or console errors', errors.length === 0, errors);
  await browser.close();
  const sources = ['index.html', 'siri-story.js', 'siri-story.css', 'assets/vendor/siriwave/siriwave-2.4.0.js', 'assets/line/apple-iphone7-chip-2016.jpg'].map(file => ({ file, hash: hash(fs.readFileSync(path.resolve(__dirname, '../..', file))) }));
  const result = { testHash: hash(fs.readFileSync(__filename)), sources, checks, failures: checks.filter(check => !check.pass) };
  fs.writeFileSync(path.join(out, 'siri-chip-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(check => check.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
