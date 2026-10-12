const fs = require('fs'), path = require('path'), crypto = require('crypto');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browserType = require(process.env.PLAYWRIGHT_MODULE || 'playwright')[engine];
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'hello-w-tests');
const root = new URL('../', process.env.GAME_URL || 'http://127.0.0.1:8789/hello-w-play/').href;
const checks = [], check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const clear = filter => filter === 'none' || /^blur\(0(?:px)?\)$/.test(filter);
const blur = filter => Number(filter.match(/blur\(([\d.]+)px\)/)?.[1] || 0);

async function collectHero(page) {
  await page.evaluate(() => {
    window.heroFrames = [];
    const start = performance.now();
    function sample(now) {
      const host = document.querySelector('#morph');
      window.heroFrames.push({ t: now - start, filter: getComputedStyle(host).filter,
        font: parseFloat(getComputedStyle(document.querySelector('.hero h1')).fontSize),
        slots: [...host.querySelectorAll('.slot')].map(slot => [...slot.querySelectorAll('.l')].map(layer => {
          const style = getComputedStyle(layer);
          return { text: layer.textContent, opacity: Number(style.opacity), filter: style.filter };
        })) });
      if (now - start < 6500) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.clock.runFor(6550);
  return page.evaluate(() => window.heroFrames);
}
function runs(samples, predicate) {
  const result = [];
  for (const frame of samples) {
    if (predicate(frame)) {
      if (!result.length || result[result.length - 1].closed) result.push({ frames: [], closed: false });
      result[result.length - 1].frames.push(frame);
    } else if (result.length) result[result.length - 1].closed = true;
  }
  return result.map(run => ({ ...run, duration: run.frames.at(-1).t - run.frames[0].t + 16 }));
}
function verifyHero(name, frames, reduced) {
  const settled = frame => frame.slots.every(([current, next]) => current.opacity === 1 && next.opacity === 0 && !next.text);
  const holds = runs(frames, settled);
  check(name + ' entry and two loop pauses stay fully sharp', holds.length >= (reduced ? 1 : 3) && holds.every(run => run.frames.every(frame => clear(frame.filter) && frame.slots.flat().every(layer => clear(layer.filter)))), holds.map(run => ({ duration: run.duration, filters: [...new Set(run.frames.map(frame => frame.filter))] })));
  if (reduced) {
    check(name + ' reduced motion never blurs or crossfades', frames.every(frame => clear(frame.filter) && frame.slots.flat().every(layer => clear(layer.filter) && [0, 1].includes(layer.opacity))));
    return;
  }
  check(name + ' each complete loop leaves a readable pause', holds.slice(0, 3).length === 3 && holds.slice(0, 3).every(run => run.duration >= 700), holds.map(run => run.duration));
  const entry = runs(frames, frame => frame.slots[0][0].opacity > 0 && frame.slots[0][0].opacity < 1 && !frame.slots[0][1].text)[0];
  check(name + ' entry retains approximately 1100ms melt', entry && entry.duration >= 1000 && entry.duration <= 1150, entry?.duration);
  for (const slotIndex of [0, 1]) {
    const transitions = runs(frames, frame => !!frame.slots[slotIndex][1].text).slice(0, 2);
    check(name + ' slot ' + slotIndex + ' retains two approximately 620ms transitions', transitions.length === 2 && transitions.every(run => run.duration >= 570 && run.duration <= 660), transitions.map(run => run.duration));
    const midpoints = transitions.map(run => run.frames[Math.floor(run.frames.length / 2)]);
    check(name + ' slot ' + slotIndex + ' preserves visible midpoint blur intensity and composition', midpoints.length === 2 && midpoints.every(frame => {
      const k = Math.max(3, frame.font * 0.145);
      return frame.filter.includes('url(') && frame.slots[slotIndex].every(layer => blur(layer.filter) >= k * 0.75 && blur(layer.filter) <= k * 1.3 && layer.opacity > 0.6 && layer.opacity < 0.85);
    }), midpoints.map(frame => ({ t: frame.t, font: frame.font, filter: frame.filter, layers: frame.slots[slotIndex] })));
  }
}

// Place a saturated surface underneath the real header, then sample rendered
// pixels. This catches an absent/reversed/too-short fade even when CSS says gradient.
async function verifyHeader(page, name) {
  await page.evaluate(() => scrollTo(0, 400));
  await page.clock.runFor(400);
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector('#nav'), brand = document.querySelector('.brand'), links = document.querySelector('.links');
    const style = getComputedStyle(nav), footer = getComputedStyle(document.querySelector('footer'));
    const targets = [...links.querySelectorAll('a,button')].map(el => {
      const box = el.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { label: el.getAttribute('aria-label') || el.textContent, reachable: hit === el || el.contains(hit), bottom: box.bottom };
    });
    return { nav: nav.getBoundingClientRect().toJSON(), brand: brand.getBoundingClientRect().toJSON(), links: links.getBoundingClientRect().toJSON(), targets,
      border: style.borderBottomWidth, shadow: style.boxShadow, footerBorder: footer.borderTopWidth,
      background: getComputedStyle(document.body).backgroundColor };
  });
  check(name + ' scrolled header and footer have no divider', parseFloat(geometry.border) === 0 && geometry.shadow === 'none' && parseFloat(geometry.footerBorder) === 0, geometry);
  check(name + ' navigation stays separated and clickable', geometry.brand.right + 8 <= geometry.links.left && geometry.targets.every(target => target.reachable), geometry);
  await page.screenshot({ path: path.join(out, name.replaceAll(' ', '-') + '-header-scrolled.png') });
  await page.evaluate(() => {
    const surface = document.createElement('div'); surface.id = 'header-fade-test-surface';
    surface.style.cssText = 'position:fixed;inset:0;z-index:19;background:rgb(255,0,255);pointer-events:none';
    document.body.appendChild(surface);
  });
  const image = await page.screenshot({ path: path.join(out, name.replaceAll(' ', '-') + '-fade.png'), clip: { x: 2, y: 0, width: 3, height: 160 } });
  const pixels = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
    return Array.from({ length: 160 }, (_, y) => [...context.getImageData(1, y, 1, 1).data].slice(0, 3));
  }, 'data:image/png;base64,' + image.toString('base64'));
  await page.locator('#header-fade-test-surface').evaluate(el => el.remove());
  const bg = geometry.background.match(/\d+/g).map(Number);
  const alpha = pixels.map(pixel => pixel[1] / bg[1]);
  const textBottom = Math.ceil(geometry.brand.bottom - 3), opaque = alpha.slice(0, textBottom);
  const firstClear = alpha.findIndex((a, i) => i >= textBottom && a < 0.05);
  const fading = alpha.slice(textBottom, firstClear + 1);
  check(name + ' theme background fully backs navigation text', opaque.every(a => a >= 0.95), { textBottom, min: Math.min(...opaque), top: pixels[0], bg });
  check(name + ' background fades vertically to transparent below the text', firstClear > textBottom + 10 && firstClear < 160 && fading.some(a => a > 0.15 && a < 0.85) && fading.every((a, i) => i === 0 || a <= fading[i - 1] + 0.06), { textBottom, firstClear, alpha: alpha.filter((_, i) => i % 8 === 0) });
  // A real click also verifies that decoration does not intercept the theme button.
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('#themeBtn').click();
  check(name + ' theme button receives clicks through the fade', (await page.locator('html').getAttribute('data-theme')) !== before);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await browserType.launch({ headless: true, ...(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  for (const test of [{ width: 390, theme: 'light' }, { width: 390, theme: 'dark' }, { width: 1280, theme: 'light' }, { width: 390, theme: 'dark', reduced: true }]) {
    const name = `${test.width} ${test.theme}${test.reduced ? ' reduced' : ''}`;
    const page = await browser.newPage({ viewport: { width: test.width, height: 844 }, isMobile: test.width < 640, reducedMotion: test.reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(theme => localStorage.setItem('theme', theme), test.theme);
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.goto(root + '#/'); await page.evaluate(() => document.fonts.ready);
    verifyHero(name, await collectHero(page), test.reduced);
    await page.screenshot({ path: path.join(out, name.replaceAll(' ', '-') + '-hero-settled.png') });
    await verifyHeader(page, name);
    await page.close();
  }
  check('browser lifecycle has no errors', errors.length === 0, errors);
  await browser.close();
  const result = { sourceHash: crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../index.html'))).digest('hex'), checks, failures: checks.filter(check => !check.pass) };
  fs.writeFileSync(path.join(out, 'hero-crisp-header-fade-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(check => check.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
