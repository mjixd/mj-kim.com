// Independent browser contract: reversible Samsung scroll story, static accessible
// fallback, bounded media lifetime, and preservation of existing portfolio facts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-story-' + engine);
const selector = '[data-samsung-story]';
const checks = [], errors = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = Object.fromEntries(['index.html', 'samsung-story.js', 'samsung-story.css', 'hello-w-play/tests/samsung-story.cjs'].map(file => {
  const location = path.resolve(__dirname, '../..', file);
  return [file, fs.existsSync(location) ? hash(fs.readFileSync(location)) : null];
}));
const check = (name, pass, actual) => checks.push({ name, pass: Boolean(pass), actual });
async function settle(page) { await page.waitForTimeout(220); }
async function enter(page) {
  await page.goto(base + '#/work/samsung');
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
}
async function phase(page, progress) {
  await page.locator(selector).evaluate((root, progress) => scrollTo({
    top: scrollY + root.getBoundingClientRect().top + Math.max(0, root.offsetHeight - innerHeight) * progress,
    behavior: 'instant',
  }), progress);
  await settle(page);
}
async function state(page) {
  return page.locator(selector).evaluate(root => {
    const opacity = node => { let value = 1; for (let el = node; el; el = el.parentElement) { const css = getComputedStyle(el); if (css.display === 'none' || css.visibility === 'hidden') return 0; value *= Number(css.opacity); } return value; };
    const images = [...root.querySelectorAll('img')].map(image => ({ src: image.getAttribute('src'), width: image.naturalWidth, alpha: opacity(image) }));
    return {
      y: scrollY, height: root.offsetHeight, viewport: innerHeight,
      sticky: getComputedStyle(root.querySelector('.samsung-story__stage')).position,
      images,
      videos: [...root.querySelectorAll('video')].map(video => ({ src: video.getAttribute('src'), currentSrc: video.currentSrc, time: video.currentTime, duration: video.duration, ready: video.readyState, network: video.networkState, error: video.error?.code || null, paused: video.paused, alpha: opacity(video) })),
      composition: [...root.querySelectorAll('img,video,h2,h3,p')].map(node => ({ tag: node.tagName, alpha: opacity(node), transform: getComputedStyle(node).transform })),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}
function sameComposition(a, b) {
  return JSON.stringify(a.composition) === JSON.stringify(b.composition);
}
async function copyLayout(page, label) {
  const copy = await page.locator(selector).evaluate(root => [...root.querySelectorAll('h2,h3,p,a')].filter(node => node.textContent.trim()).map(node => {
    const r = node.getBoundingClientRect(), css = getComputedStyle(node);
    return { text: node.textContent.trim(), left: r.left, right: r.right, width: r.width, size: parseFloat(css.fontSize), color: css.color, display: css.display, visibility: css.visibility };
  }));
  const width = page.viewportSize().width;
  check(label + ': copy stays within the viewport', copy.length >= 2 && copy.every(item => item.left >= -1 && item.right <= width + 1 && item.width > 0 && item.size >= 11 && item.display !== 'none' && item.visibility !== 'hidden'), copy);
  check(label + ': page has no horizontal overflow', !(await state(page)).overflow);
  const images = await page.locator(selector + ' img').evaluateAll(images => images.map(image => {
    const frame = image.parentElement.getBoundingClientRect(), rect = image.getBoundingClientRect();
    return { frame: { width: frame.width, height: frame.height }, image: { width: rect.width, height: rect.height } };
  }));
  check(label + ': interface image fits its visual frame', images.length > 0 && images.every(({ frame, image }) => image.width <= frame.width + 1 && image.height <= frame.height + 1), images);
}
async function staticChecks(browser, options, label) {
  const page = await browser.newPage(options), media = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.resourceType() === 'media' || /\.(?:mp4|webm)(?:\?|$)/i.test(request.url())) media.push(request.url()); });
  await enter(page);
  await phase(page, .5);
  const before = await state(page);
  await phase(page, 1);
  const after = await state(page);
  check(label + ': static layout has no sticky runway', before.sticky !== 'sticky' && before.height < before.viewport * 1.7, before);
  check(label + ': no video source or media request', before.videos.every(video => !video.src && !video.currentSrc) && media.length === 0, { videos: before.videos, media });
  check(label + ': actual AI Office image is visible', before.images.some(image => /EN.*15/.test(decodeURIComponent(image.src || '')) && image.width > 0 && image.alpha > .9), before.images);
  check(label + ': scrolling does not animate the composition', sameComposition(before, after), { before: before.composition, after: after.composition });
  await copyLayout(page, label);
  await page.screenshot({ path: path.join(out, label + '.png') });
  await page.close();
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    page.on('pageerror', error => errors.push(error.message));
    await enter(page);
    const count = await page.locator(selector).count();
    check('Samsung route exposes one new scroll story', count === 1, count);
    // An absent feature on the executable old page is a behavioral RED. Avoid
    // treating missing-element exceptions as evidence for dependent scenarios.
    if (count === 1) {
      const main = await page.locator('main').innerText();
      check('existing Samsung role, governance, and delivery facts remain', ['B2B AI Agent & AI Office', 'Business and product challenge', 'Define the automation boundary', 'From one-off fixes to shared updates', 'Complex data, clear decisions, on site', 'CES 2025'].every(text => main.replace(/\s+/g, ' ').includes(text)), main);
      const order = await page.locator(selector).evaluate(root => [...document.querySelectorAll('main h2,main h3')].filter(node => node.textContent.includes('Complex data, clear decisions, on site')).some(node => Boolean(node.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING)));
      check('story follows the existing delivery block', order);
      const links = await page.locator(selector + ' a').evaluateAll(links => links.map(link => ({ text: link.textContent, href: link.href })));
      check('reference is credited to the official Samsung source', links.some(link => new URL(link.href).hostname.endsWith('samsung.com')), links);
      const initial = await state(page);
      check('distant story does not load video on route entry', initial.videos.every(video => !video.src && !video.currentSrc), initial.videos);
      await page.locator(selector + ' video').evaluate(video => {
        window.__samsungSeekEvents = 0;
        video.addEventListener('seeked', () => window.__samsungSeekEvents++);
      });
      await phase(page, 0);
      try { await page.waitForFunction(selector => [...document.querySelectorAll(selector + ' video')].some(video => video.readyState >= 2 && video.duration > 0), selector, { timeout: 12000 }); } catch {}
      const start = await state(page);
      check('desktop has a sticky stage and one usable decoder', start.sticky === 'sticky' && start.videos.length === 1 && start.videos[0].ready >= 2 && !start.videos[0].error, start);
      await page.screenshot({ path: path.join(out, 'desktop-start.png') });
      await phase(page, .3); const middle = await state(page);
      const settledSeeks = await page.evaluate(() => window.__samsungSeekEvents);
      await settle(page);
      const idleSeeks = await page.evaluate(() => window.__samsungSeekEvents - 0);
      check('stationary scroll does not keep reseeking the same frame', idleSeeks - settledSeeks <= 2, { settledSeeks, idleSeeks });
      await page.screenshot({ path: path.join(out, 'desktop-middle.png') });
      await phase(page, 1); const end = await state(page);
      check('forward scroll scrubs video without autoplay', middle.videos[0]?.time > start.videos[0]?.time + .15 && middle.videos.every(video => video.paused), { start: start.videos, middle: middle.videos });
      check('ending exposes the actual AI Office visual', end.images.some(image => /EN.*15/.test(decodeURIComponent(image.src || '')) && image.width > 0 && image.alpha > .9), end.images);
      check('scroll changes visible composition', !sameComposition(start, end), { start: start.composition, end: end.composition });
      await phase(page, .3); const reversed = await state(page);
      check('reverse scroll restores composition and media time', sameComposition(middle, reversed) && Math.abs(middle.videos[0].time - reversed.videos[0].time) < .12, { middle, reversed });
      // An interrupted seek must reconcile to the latest native scroll position.
      for (const p of [.8, .1, .5, .22]) await page.locator(selector).evaluate((root, p) => scrollTo(0, scrollY + root.getBoundingClientRect().top + (root.offsetHeight - innerHeight) * p), p);
      await settle(page); await settle(page);
      const interrupted = await state(page);
      await phase(page, .22); const stable = await state(page);
      check('rapid reversal converges to the latest scroll location', sameComposition(interrupted, stable) && Math.abs(interrupted.videos[0].time - stable.videos[0].time) < .12, { interrupted, stable });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await phase(page, 1);
        await copyLayout(page, theme);
        await page.screenshot({ path: path.join(out, 'desktop-' + theme + '.png') });
      }
      await phase(page, .3);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page);
      const reduced = await state(page);
      check('live reduced-motion preference releases media and sticky positioning', reduced.sticky !== 'sticky' && reduced.videos.every(video => !video.src && video.ready === 0 && video.network === 0), reduced);
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await phase(page, .3);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      }); await settle(page);
      check('hidden document releases video resources', (await state(page)).videos.every(video => !video.src && video.ready === 0 && video.network === 0));
      await page.evaluate(() => {
        delete document.hidden; delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      }); await settle(page);
      await page.evaluate(() => scrollTo(0, 0)); await settle(page);
      check('scrolling far away releases video resources', (await state(page)).videos.every(video => !video.src && video.ready === 0 && video.network === 0));
      for (let visit = 0; visit < 2; visit++) {
        await phase(page, .4);
        await page.locator(selector).evaluate(root => { window.__oldSamsungStory = root; window.__oldSamsungVideos = [...root.querySelectorAll('video')]; location.hash = '#/about'; });
        await page.locator(selector).waitFor({ state: 'detached' }); await settle(page);
        const retired = await page.evaluate(() => window.__oldSamsungVideos.map(video => ({ connected: video.isConnected, src: video.getAttribute('src'), currentSrc: video.currentSrc, paused: video.paused, ready: video.readyState, network: video.networkState })));
        check('route exit ' + visit + ' releases detached video', retired.every(video => !video.connected && !video.src && video.ready === 0 && video.network === 0 && video.paused), retired);
        const before = await page.evaluate(() => window.__oldSamsungStory.outerHTML);
        await page.evaluate(() => { scrollTo(0, 400); window.__oldSamsungVideos.forEach(video => video.dispatchEvent(new Event('seeked'))); }); await settle(page);
        check('route exit ' + visit + ' ignores late media completion', before === await page.evaluate(() => window.__oldSamsungStory.outerHTML));
        await enter(page);
        check('route reentry ' + visit + ' has exactly one story', await page.locator(selector).count() === 1);
      }
      await page.close();
      for (const width of [320, 390, 820]) await staticChecks(browser, { viewport: { width, height: 844 }, reducedMotion: 'no-preference' }, 'mobile-' + width);
      await staticChecks(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, 'reduced-motion');
      await staticChecks(browser, { viewport: { width: 1440, height: 699 }, reducedMotion: 'no-preference' }, 'short-desktop');
      const failed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await failed.route(/\.(mp4|webm)(\?|$)/, route => route.abort());
      await enter(failed); await phase(failed, .25); await failed.waitForTimeout(700);
      const fallback = await state(failed);
      check('media failure retains a decoded visible image', fallback.images.some(image => image.width > 0 && image.alpha > .9), fallback);
      await copyLayout(failed, 'media-error');
      await failed.screenshot({ path: path.join(out, 'media-error.png') });
      await failed.close();
    }
    check('scenarios produce no uncaught browser errors', errors.length === 0, errors);
  } finally { await browser.close(); }
  const failures = checks.filter(check => !check.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, sources, checks, failures }, null, 2));
  console.log(`${checks.length} checks, ${failures.length} failures`, failures.map(check => check.name));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
