// Independent user-behavior contract; no product functions or state are imported.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'domino-zoom-tests');
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const selectors = { section: '[data-domino-zoom]', phone: '[data-domino-phone]', center: '[data-domino-center]', peripheral: '[data-domino-peripheral]', control: '[data-domino-playback]' };
const settle = page => page.waitForTimeout(150);
async function phase(page, progress) {
  await page.locator(selectors.section).evaluate(async (section, progress) => {
    const top = section.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + Math.max(0, section.offsetHeight - innerHeight) * progress, behavior: 'instant' });
    // Synchronize with real paint opportunities; large decoded compositions can
    // take longer than a fixed sleep to deliver scroll events in WebKit.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, progress);
  await settle(page);
}
async function media(page, retained = false) {
  return page.evaluate(({ section, retained }) => {
    const videos = retained ? window.retainedDominoVideos : [...document.querySelectorAll(section + ' video')];
    return videos.map(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState, error: video.error?.code, duration: video.duration }));
  }, { section: selectors.section, retained });
}
async function stopped(page, name, retained = false) {
  await settle(page);
  const before = await media(page, retained);
  await page.waitForTimeout(400);
  const after = await media(page, retained);
  check(name, after.length === 6 && after.every((v, i) => v.paused && Math.abs(v.time - before[i].time) < 0.04), { before, after });
}
async function moving(page, name) {
  // Real decoders and currentTime, not a stubbed play() Promise or paused flag.
  await page.waitForFunction(section => [...document.querySelectorAll(section + ' video')].every(v => v.readyState >= 2), selectors.section, { timeout: 15000 }).catch(() => {});
  const before = await media(page);
  let after = before;
  const advanced = Array(6).fill(false);
  for (let attempt = 0; attempt < 15 && !advanced.every(Boolean); attempt++) {
    await page.waitForTimeout(200);
    after = await media(page);
    after.forEach((video, i) => { if (!video.paused && !video.error && Math.abs(video.time - before[i].time) > 0.08) advanced[i] = true; });
  }
  check(name, after.length === 6 && advanced.every(Boolean) && after.every(video => !video.paused && !video.error), { before, after, advanced });
}
async function visual(page) {
  return page.evaluate(s => {
    function opacity(element) {
      let value = 1;
      for (let node = element; node && node !== document.body; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
      return value;
    }
    const center = document.querySelector(s.center).getBoundingClientRect();
    return { center: center.toJSON(), opacity: [...document.querySelectorAll(s.peripheral)].map(opacity), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  }, selectors);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright[browserName].launch({ headless: true, ...(browserName === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  const newPage = async options => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'no-preference', ...options });
    page.on('pageerror', error => errors.push(error.message));
    return page;
  };
  try {
    const page = await newPage({ recordVideo: { dir: out, size: { width: 1440, height: 960 } } });
    await page.goto(base + '#/work/domino-mvp');
    await page.locator('.pager').waitFor();
    check('Domino detail exposes its scroll-driven phone composition', await page.locator(selectors.section).count() === 1);
    if (!checks.at(-1).pass) return;
    const section = page.locator(selectors.section);
    const composition = await section.evaluate((element, s) => ({
      phones: element.querySelectorAll(s.phone).length,
      staticPhones: [...element.querySelectorAll(s.phone)].filter(phone => phone.querySelector('img') && !phone.querySelector('video')).length,
      videos: element.querySelectorAll('video').length,
      centerStatic: !!element.querySelector(s.center + ' img') && !element.querySelector(s.center + ' video'),
      videosSafe: [...element.querySelectorAll('video')].every(video => video.muted && video.loop && video.playsInline),
      localSources: [...element.querySelectorAll('video,img')].every(element => new URL(element.currentSrc || element.src, location.href).origin === location.origin)
    }), selectors);
    check('composition contains sixteen phones, ten static originals and six local muted looping inline videos', composition.phones === 16 && composition.staticPhones === 10 && composition.videos === 6 && composition.centerStatic && composition.videosSafe && composition.localSources, composition);
    await phase(page, 0);
    const start = await visual(page);
    // Final close-up contract: desktop phone exceeds 1.8 viewport heights; clipping is intentional.
    check('initial stage starts in full central close-up and hides surrounding phones', start.center.height >= 960 * 1.8 && Math.abs(start.center.x + start.center.width / 2 - 720) < 100 && start.opacity.length === 15 && start.opacity.every(value => value < 0.08), start);
    await stopped(page, 'initially hidden videos do not advance');
    await page.screenshot({ path: path.join(out, `domino-start-${browserName}.png`) });
    const trace = [];
    for (const progress of [0, 0.001, 0.179, 0.18, 0.181, 0.25, 0.419, 0.42, 0.421, 0.5, 0.559, 0.56, 0.561, 0.75, 0.819, 0.82, 0.821, 0.999, 1]) {
      await phase(page, progress);
      trace.push({ progress, ...(await visual(page)) });
      if ([0.25, 0.5, 0.75].includes(progress)) await page.screenshot({ path: path.join(out, `domino-phase-${progress}-${browserName}.png`) });
    }
    check('intermediate forward frames continuously shrink center and reveal peripherals', trace.every((frame, i) => !i || frame.center.height <= trace[i - 1].center.height + 1 && frame.opacity.every((value, j) => value >= trace[i - 1].opacity[j] - 0.01)) && trace.some(frame => frame.opacity.some(value => value > 0.05 && value < 0.95)), trace);
    const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
    check('declared phase boundaries project the same master progress into geometry and opacity', trace.every(frame => {
      const expectedHeight = trace[0].center.height + (trace.at(-1).center.height - trace[0].center.height) * smooth(frame.progress / 0.82);
      return Math.abs(frame.center.height - expectedHeight) < 2 && frame.opacity.every(value => Math.abs(value - smooth((frame.progress - 0.18) / 0.38)) < 0.01);
    }), trace);
    const reverseTrace = [];
    for (const frame of [...trace].reverse()) {
      await phase(page, frame.progress);
      const reversedFrame = await visual(page);
      reverseTrace.push({ progress: frame.progress, ...reversedFrame });
    }
    check('each reverse phase reconstructs the same geometry and alpha without stale timelines', reverseTrace.every((frame, i) => {
      const expected = trace[trace.length - 1 - i];
      return Math.abs(frame.center.height - expected.center.height) < 2 && frame.opacity.every((value, j) => Math.abs(value - expected.opacity[j]) < 0.02);
    }), reverseTrace);
    await phase(page, 0.85);
    const revealed = await visual(page);
    check('forward scroll shrinks center and reveals surrounding composition', revealed.center.height < start.center.height * 0.8 && revealed.opacity.every(value => value > 0.9) && !revealed.overflow, { start, revealed });
    // Coordinates are the updated Figma frame contract, independent of rendering code.
    const framePositions = [[4464,2952],[7415,1078],[7409,3898],[5939,5323],[2994,1890],[2994,4712],[1524,3382],[5934,2500],[4459,132],[4483,5774],[8879,2220],[8879,5042],[44,2350],[1529,562],[44,5175],[1524,6204]];
    const renderedPhones = await page.locator(selectors.phone).evaluateAll(phones => phones.map(phone => phone.getBoundingClientRect().toJSON()));
    const frameScale = revealed.center.width / 1300;
    check('fully revealed sixteen-phone arrangement fits the viewport and preserves updated Figma relative positions', renderedPhones.every(rect => rect.x >= 0 && rect.y >= 0 && rect.right <= 1441 && rect.bottom <= 961) && framePositions.every(([x,y]) => renderedPhones.some(rect => Math.abs(rect.x - revealed.center.x - (x-4464)*frameScale) < 2 && Math.abs(rect.y - revealed.center.y - (y-2952)*frameScale) < 2 && Math.abs(rect.width - 1300*frameScale) < 2 && Math.abs(rect.height - 2642*frameScale) < 2)), renderedPhones);
    await moving(page, 'revealed six videos actually progress');
    await page.screenshot({ path: path.join(out, `domino-revealed-${browserName}.png`) });
    await phase(page, 0);
    const reversed = await visual(page);
    check('reverse scroll restores center emphasis and hides surrounding phones', Math.abs(reversed.center.height - start.center.height) < 3 && reversed.opacity.every(value => value < 0.08), reversed);
    await stopped(page, 'reverse scroll pauses all hidden video timelines');
    await phase(page, 0.85);
    await moving(page, 'reveal again resumes real video playback');
    const control = page.locator(selectors.control);
    check('visible playback control has an accessible pause action', await control.count() === 1 && await control.isVisible() && /pause/i.test(await control.getAttribute('aria-label') || await control.innerText()));
    await control.click();
    await stopped(page, 'manual pause stops all video timelines');
    await phase(page, 0);
    await phase(page, 0.85);
    await stopped(page, 'manual pause survives scroll hide and reveal');
    await control.focus();
    await page.keyboard.press('Enter');
    await moving(page, 'keyboard play resumes videos');
    // Deterministically inject the browser visibility boundary; decode remains real.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await stopped(page, 'hidden-document boundary pauses all videos');
    await page.evaluate(() => {
      delete document.visibilityState;
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await moving(page, 'visible-document boundary resumes eligible videos');
    await page.locator('.pager').scrollIntoViewIfNeeded();
    await stopped(page, 'leaving the section pauses playback');
    await phase(page, 0.85);
    await moving(page, 'reentering section resumes eligible videos');
    await page.evaluate(s => { window.retainedDominoVideos = [...document.querySelectorAll(s + ' video')]; location.hash = '#/about'; }, selectors.section);
    await page.waitForFunction(s => !document.querySelector(s), selectors.section);
    await stopped(page, 'route removal pauses retained media objects without leaking playback', true);
    await page.evaluate(() => { location.hash = '#/work/domino-mvp'; });
    await section.waitFor();
    await phase(page, 0.85);
    await moving(page, 'route reentry creates a working fresh composition');
    await stopped(page, 'old route media stays paused after new composition starts', true);
    await page.close();

    for (const width of [390, 320]) {
      const mobile = await newPage({ viewport: { width, height: 844 } });
      await mobile.goto(base + '#/work/domino-mvp');
      await phase(mobile, 0);
      const mobileStart = await visual(mobile);
      check(`${width}px: initial central close-up exceeds viewport width while section clips overflow`, mobileStart.center.width >= width * 1.1 && !mobileStart.overflow, mobileStart);
      await phase(mobile, 0.85);
      const mobilePhones = await mobile.locator(selectors.phone).evaluateAll(phones => phones.map(phone => phone.getBoundingClientRect().toJSON()));
      check(`${width}px: all sixteen phones fit without horizontal page overflow`, mobilePhones.length === 16 && mobilePhones.every(rect => rect.x >= 0 && rect.y >= 0 && rect.right <= width + 1 && rect.bottom <= 845) && !(await visual(mobile)).overflow, mobilePhones);
      await mobile.locator('.deck-band .btn').scrollIntoViewIfNeeded();
      check(`${width}px: existing copy CTA remains reachable`, await mobile.locator('.deck-band .btn').isVisible());
      await mobile.locator('.pager').scrollIntoViewIfNeeded();
      check(`${width}px: existing previous/next navigation remains reachable`, await mobile.locator('.pager .prev').isVisible() && await mobile.locator('.pager .next').isVisible());
      await stopped(mobile, `${width}px: scrolling to navigation stops videos`);
      await mobile.close();
    }

    const reduced = await newPage({ reducedMotion: 'reduce' });
    await reduced.goto(base + '#/work/domino-mvp');
    await reduced.locator(selectors.section).scrollIntoViewIfNeeded();
    const reducedBefore = await visual(reduced);
    check('reduced motion displays complete static composition immediately', reducedBefore.opacity.every(value => value > 0.9) && !reducedBefore.overflow, reducedBefore);
    await stopped(reduced, 'reduced motion never autoplays videos');
    await reduced.locator(selectors.control).click();
    await moving(reduced, 'reduced motion permits explicit manual playback');
    await reduced.locator(selectors.control).click();
    await stopped(reduced, 'reduced motion manual pause works');
    await reduced.close();

    const rejected = await newPage();
    await rejected.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      window.allowVideoPlayback = false;
      HTMLMediaElement.prototype.play = function () {
        return window.allowVideoPlayback ? play.call(this) : Promise.reject(new DOMException('Autoplay denied by test', 'NotAllowedError'));
      };
    });
    await rejected.goto(base + '#/work/domino-mvp');
    await phase(rejected, 0.85);
    await stopped(rejected, 'autoplay rejection leaves videos safely paused');
    const retry = rejected.locator(selectors.control);
    check('autoplay rejection offers a visible accessible play action', await retry.isVisible() && /play/i.test(await retry.getAttribute('aria-label') || await retry.innerText()));
    await rejected.evaluate(() => { window.allowVideoPlayback = true; });
    await retry.click();
    await moving(rejected, 'user play recovers from autoplay rejection');
    await rejected.close();
    const partial = await newPage();
    await partial.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      window.allowPartialPlayback = false;
      HTMLMediaElement.prototype.play = function () {
        if (!window.allowPartialPlayback && this.dataset.src?.includes('calendar')) {
          return new Promise((resolve, reject) => { window.rejectCalendarPlayback = () => reject(new DOMException('Delayed single-video denial', 'NotAllowedError')); });
        }
        return play.call(this);
      };
    });
    await partial.goto(base + '#/work/domino-mvp');
    await phase(partial, 0.85);
    await partial.waitForFunction(() => [...document.querySelectorAll('[data-domino-zoom] video')].filter(video => !video.paused && video.currentTime > 0.1).length === 5);
    await partial.evaluate(() => rejectCalendarPlayback());
    await stopped(partial, 'late rejection of one video immediately reconciles already playing siblings');
    await partial.evaluate(() => { window.allowPartialPlayback = true; });
    await partial.locator(selectors.control).click();
    await moving(partial, 'manual retry after partial rejection starts all six videos');
    await partial.close();
    check('no uncaught browser errors', errors.length === 0, errors);
  } finally {
    await browser.close();
    const root = path.resolve(__dirname, '../..');
    const assetFiles = fs.readdirSync(path.join(root, 'assets/domino/zoom')).filter(file => /\.(png|mp4|svg)$/.test(file)).map(file => 'assets/domino/zoom/' + file);
    const hashes = Object.fromEntries(['index.html', 'domino-zoom.js', 'domino-zoom.css', 'hello-w-play/tests/domino-zoom.cjs', ...assetFiles].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
    const result = { browser: browserName, hashes, checks, failures: checks.filter(item => !item.pass) };
    fs.writeFileSync(path.join(out, `domino-zoom-${browserName}-results.json`), JSON.stringify(result, null, 2));
    console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures);
    if (result.failures.length) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
