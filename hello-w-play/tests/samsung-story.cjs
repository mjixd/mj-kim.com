// Independent browser contract: reversible Samsung scroll story, static accessible
// fallback, bounded media lifetime, and preservation of existing portfolio facts.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-story-' + engine);
const selector = '[data-samsung-story]';
const workspaceSelector = '[data-samsung-workspace]';
const checks = [], errors = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = Object.fromEntries(['index.html', 'samsung-story.js', 'samsung-story.css', 'assets/samsung/fold-two.png', 'assets/samsung/fold-three.png', 'assets/samsung/fold-start.png', 'assets/samsung/unfold.mp4', 'assets/samsung/unfold-ai-workspace.mp4', 'assets/samsung/ai-agent-open-4x.png', 'hello-w-play/tests/samsung-story.cjs'].map(file => {
  const location = path.resolve(__dirname, '../..', file);
  return [file, fs.existsSync(location) ? hash(fs.readFileSync(location)) : null];
}));
const check = (name, pass, actual, gate = 'rendered-e2e') => checks.push({ name, pass: Boolean(pass), actual, gate });
function deterministicMotionChecks() {
  const handlers = new Map(), videoHandlers = new Map(), properties = {}, frames = [];
  const attrs = new Map(); let progress = 0, observerCallback, motionCallback;
  const video = {
    duration: 176 / 30, currentTime: 0, seeking: false, readyState: 2,
    set src(value) { attrs.set('src', value); },
    hasAttribute: name => attrs.has(name), removeAttribute: name => attrs.delete(name),
    load() {}, pause() {},
    addEventListener: (name, fn) => videoHandlers.set(name, fn),
    removeEventListener: name => videoHandlers.delete(name),
  };
  const visual = { getBoundingClientRect: () => ({ width: context.innerWidth, height: context.innerHeight - 80 }) };
  const root = {
    offsetHeight: 3400, getBoundingClientRect: () => ({ top: -(3400 - context.innerHeight) * progress }),
    style: { setProperty: (key, value) => properties[key] = String(value) },
    classList: { toggle() {} }, querySelector: name => name === 'video' ? video : visual,
  };
  const media = { matches: false, addEventListener: (_, fn) => motionCallback = fn, removeEventListener() {} };
  const context = {
    innerWidth: 1440, innerHeight: 900,
    matchMedia: () => media,
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
    IntersectionObserver: class { constructor(fn) { observerCallback = fn; } observe() { observerCallback([{ isIntersecting: true }]); } disconnect() {} },
    document: { hidden: false, querySelectorAll: name => name === '[data-samsung-story]' ? [root] : [], addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) },
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name),
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../samsung-story.js'), 'utf8'), context);
  const flush = () => { while (frames.length) frames.shift()(); };
  const sample = p => { progress = p; handlers.get('scroll')(); flush(); return { properties: { ...properties }, time: video.currentTime }; };
  context.SamsungStory.mount(); videoHandlers.get('loadeddata')();
  const points = [0, .000001, .759999, .76, .760001, .8, .839999, .84, .840001, .91, .979999, .98, .980001, .999999, 1];
  const forward = points.map(p => ({ p, state: sample(p) }));
  const reverse = forward.slice().reverse().map(item => { const current = sample(item.p); return { progress: item.p, same: JSON.stringify(item.state.properties) === JSON.stringify(current.properties), timeDelta: Math.abs(item.state.time - current.time) }; });
  check('deterministic phase boundary and reverse reconciliation', reverse.every(item => item.same && item.timeDelta < 1 / 30), reverse, 'unit');
  const visible = forward.map(({ p, state }) => ({ progress: p, coverage: 1 - (1 - Number(state.properties['--hardware-opacity'])) * (1 - Number(state.properties['--interface-opacity'])) }));
  check('deterministic phase boundaries retain an opaque visual', visible.every(item => item.coverage >= .999), visible, 'unit');
  const queued = [.95, .12, .65, .22];
  for (const p of queued) { progress = p; handlers.get('scroll')(); }
  flush(); const interrupted = { properties: { ...properties }, time: video.currentTime };
  check('deterministic queued interruption uses latest input', JSON.stringify(interrupted) === JSON.stringify(sample(.22)), interrupted, 'unit');
  media.matches = true; motionCallback();
  check('deterministic reduced motion releases media and reveals endpoint', !attrs.has('src') && properties['--interface-opacity'] === '1' && properties['--interface-scale'] === '1', { ...properties }, 'unit');
  media.matches = false; motionCallback(); videoHandlers.get('loadeddata')();
  const restored = sample(.22);
  check('deterministic reduced-motion reentry restores prior input', JSON.stringify(restored) === JSON.stringify(interrupted), restored, 'unit');
  context.SamsungStory.cleanup();
  check('deterministic cleanup retires event handlers and media', !attrs.has('src') && handlers.size === 0 && videoHandlers.size === 0, { handlers: [...handlers.keys()], videoHandlers: [...videoHandlers.keys()] }, 'unit');
}
async function settle(page) { await page.waitForTimeout(220); }
async function whiteIntro(page, label) {
  const background = await page.locator('.c-hero').evaluate(node => {
    for (let element = node; element; element = element.parentElement) {
      const color = getComputedStyle(element).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    }
    return 'transparent';
  });
  check(label + ': Samsung text hero background is pure white', background === 'rgb(255, 255, 255)', background);
}
async function aiEndpoint(page, label) {
  const endpoint = await page.locator(selector + ' .samsung-story__interface').evaluate(image => {
    const rect = image.getBoundingClientRect();
    const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    return { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight,
      displayedWidth: image.naturalWidth * fit, ratio: image.naturalWidth / image.naturalHeight,
      density: 1 / fit, transform: getComputedStyle(image).transform };
  });
  check(label + ': final UI device preserves the straight-on Figma aspect ratio', Math.abs(endpoint.ratio - 974 / 747) < .002, endpoint);
  check(label + ': final UI has enough source pixels for a 2x display', endpoint.density >= 1.99, endpoint);
  check(label + ': final UI has no CSS rotation or perspective', endpoint.transform === 'none' || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(endpoint.transform), endpoint);
}
async function startingHardware(page) {
  const bounds = await page.locator(selector + ' video').evaluate(video => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bottom = -1, top = canvas.height;
    for (let y = 0; y < canvas.height; y++) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 160) dark++;
      }
      if (dark > canvas.width * .02) { top = Math.min(top, y); bottom = y; }
    }
    const rect = video.getBoundingClientRect(), css = getComputedStyle(video);
    const fit = css.objectFit === 'cover' ? Math.max(rect.width / canvas.width, rect.height / canvas.height) : Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const positionY = parseFloat(css.objectPosition.split(' ')[1]) / 100;
    const offsetY = (rect.height - canvas.height * fit) * positionY;
    return { top: rect.top + offsetY + top * fit, bottom: rect.top + offsetY + bottom * fit,
      gap: innerHeight - (rect.top + offsetY + bottom * fit), density: 1 / fit,
      width: canvas.width, height: canvas.height, objectPosition: css.objectPosition };
  });
  check('opening hardware reaches the visual viewport bottom', bounds.gap <= 24 && bounds.bottom > 0, bounds);
  check('opening video supplies at least two source pixels per displayed pixel', bounds.density >= 1.99, bounds);
  return bounds;
}
async function enter(page) {
  await page.goto(base + '#/work/samsung');
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
}
async function phase(page, progress, rootSelector = selector) {
  await page.locator(rootSelector).evaluate((root, progress) => scrollTo({
    top: scrollY + root.getBoundingClientRect().top + Math.max(0, root.offsetHeight - innerHeight) * progress,
    behavior: 'instant',
  }), progress);
  await settle(page);
}
async function state(page, rootSelector = selector) {
  return page.locator(rootSelector).evaluate(root => {
    const opacity = node => { let value = 1; for (let el = node; el; el = el.parentElement) { const css = getComputedStyle(el); if (css.display === 'none' || css.visibility === 'hidden') return 0; value *= Number(css.opacity); } return value; };
    const images = [...root.querySelectorAll('img')].map(image => ({ src: image.getAttribute('src'), alt: image.alt, width: image.naturalWidth, alpha: opacity(image) }));
    return {
      y: scrollY, height: root.offsetHeight, viewport: innerHeight,
      sticky: getComputedStyle(root.querySelector('.samsung-story__stage, [data-samsung-stage]') || root.firstElementChild).position,
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
async function copyLayout(page, label, rootSelector = selector) {
  const copy = await page.locator(rootSelector).evaluate(root => [...root.querySelectorAll('h2,h3,p,a')].filter(node => node.textContent.trim()).map(node => {
    const r = node.getBoundingClientRect(), css = getComputedStyle(node);
    return { text: node.textContent.trim(), left: r.left, right: r.right, width: r.width, size: parseFloat(css.fontSize), color: css.color, display: css.display, visibility: css.visibility };
  }));
  const width = page.viewportSize().width;
  check(label + ': copy stays within the viewport', (rootSelector === selector || copy.length >= 2) && copy.every(item => item.left >= -1 && item.right <= width + 1 && item.width > 0 && item.size >= 11 && item.display !== 'none' && item.visibility !== 'hidden'), copy);
  check(label + ': page has no horizontal overflow', !(await state(page, rootSelector)).overflow);
  const images = await page.locator(rootSelector + ' img').evaluateAll(images => images.map(image => {
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
  await whiteIntro(page, label);
  await phase(page, .5);
  const before = await state(page);
  await phase(page, 1);
  const after = await state(page);
  await aiEndpoint(page, label);
  check(label + ': static layout has no sticky runway', before.sticky !== 'sticky' && before.height < before.viewport * 1.7, before);
  check(label + ': no video source or media request', before.videos.every(video => !video.src && !video.currentSrc) && media.length === 0, { videos: before.videos, media });
  check(label + ': Fold8 AI Agent master is visible', before.images.some(image => /AI Agent/i.test(image.alt) && image.width > 0 && image.alpha > .9), before.images);
  check(label + ': scrolling does not animate the composition', sameComposition(before, after), { before: before.composition, after: after.composition });
  await copyLayout(page, label);
  await page.screenshot({ path: path.join(out, label + '-hero.png') });
  // Later workspace cards have their own independent contract suite.
  await page.screenshot({ path: path.join(out, label + '.png') });
  await page.close();
}


(async () => {
  fs.mkdirSync(out, { recursive: true });
  deterministicMotionChecks();
  const executablePath = process.env[engine.toUpperCase() + '_EXECUTABLE'];
  const browser = await playwright[engine].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
    page.on('pageerror', error => errors.push(error.message));
    await enter(page);
    const count = await page.locator(selector).count();
    check('Samsung route exposes one new scroll story', count === 1, count);
    // An absent feature on the executable old page is a behavioral RED. Avoid
    // treating missing-element exceptions as evidence for dependent scenarios.
    if (count === 1) {
      const main = await page.locator('main').innerText();
      check('existing Samsung role, governance, and delivery facts remain', ['B2B AI Agent & Mobile AI Office', 'Business and product challenge', 'Define the automation boundary', 'From one-off fixes to shared updates', 'Complex data, clear decisions, on site', 'CES 2025'].every(text => main.replace(/\s+/g, ' ').includes(text)), main);
      const order = await page.locator(selector).evaluate(root => {
        const intro = document.querySelector('.c-hero');
        const heading = [...document.querySelectorAll('main h2')].find(node => node.textContent.trim() === 'From monitoring to on-site control.');
        const sentence = [...document.querySelectorAll('main p')].find(node => node.textContent.trim() === 'Connected devices and visitor workflows, together in one workspace.');
        const follows = (a, b) => Boolean(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) && !a.contains(b);
        return { introFirst: root.closest('main').firstElementChild === intro, introBeforeStory: follows(intro, root), headingAfterStory: follows(root, heading), sentenceAfterStory: follows(root, sentence), heroVisuals: document.querySelectorAll('.c-hero .kv,.c-hero .carousel').length };
      });
      check('original case introduction precedes unfolding', order.introFirst && order.introBeforeStory, order);
      const intro = (await page.locator('.c-hero').innerText()).replace(/\s+/g, ' ');
      check('case title is exactly the requested mobile AI title', (await page.locator('main h1').innerText()).trim() === 'B2B AI Agent & Mobile AI Office');
      check('original case meta, lead, and role remain', ['SAMSUNG · 2024', 'Samsung’s B2B AI platform spans SmartThings Pro.AI and Digital Twin AI. I led the AI Office experience and the mobile transition, and conceived a governance system that turns design tokens and implementation rules into machine-readable checks against live code.', 'Role · AI product strategy, B2B experience, token asset governance, cross-functional leadership · 2024 – present'].every(text => intro.includes(text)), intro);
      check('workspace heading and description follow unfolding', order.headingAfterStory && order.sentenceAfterStory, order);
      check('removed hero labels are no longer visible', !/Samsung · B2B mobile experience/i.test(main) && !main.includes('Hardware imagery: Samsung Galaxy Z Fold8 · SmartThings interface adaptation: Minjung Kim'));
      check('intro has no redundant slide before the scroll story', order.heroVisuals === 0, order);
      await page.screenshot({ path: path.join(out, 'desktop-intro.png') });
      await whiteIntro(page, 'desktop');
      const initial = await state(page);
      check('top story has exactly one hardware element', initial.videos.length === 1, initial.videos);
      await page.locator(selector + ' video').evaluate(video => {
        window.__samsungSeekEvents = 0;
        video.addEventListener('seeked', () => window.__samsungSeekEvents++);
      });
      await phase(page, 0);
      try { await page.waitForFunction(selector => [...document.querySelectorAll(selector + ' video')].some(video => video.readyState >= 2 && video.duration > 0), selector, { timeout: 12000 }); } catch {}
      const start = await state(page);
      check('desktop has a sticky stage and one usable decoder', start.sticky === 'sticky' && start.videos.length === 1 && start.videos[0].ready >= 2 && !start.videos[0].error, start);
      await page.screenshot({ path: path.join(out, 'desktop-start.png') });
      if (start.videos[0]?.ready >= 2) await startingHardware(page);
      await phase(page, .3); const middle = await state(page);
      const settledSeeks = await page.evaluate(() => window.__samsungSeekEvents);
      await settle(page);
      const idleSeeks = await page.evaluate(() => window.__samsungSeekEvents - 0);
      check('stationary scroll does not keep reseeking the same frame', idleSeeks - settledSeeks <= 2, { settledSeeks, idleSeeks });
      await page.screenshot({ path: path.join(out, 'desktop-middle.png') });
      await phase(page, 1); const end = await state(page);
      check('forward scroll scrubs video without autoplay', middle.videos[0]?.time > start.videos[0]?.time + .15 && middle.videos.every(video => video.paused), { start: start.videos, middle: middle.videos });
      check('ending exposes the Fold8 AI Agent master', end.images.some(image => /AI Agent/i.test(image.alt) && image.width > 0 && image.alpha > .9), end.images);
      await aiEndpoint(page, 'desktop');
      if (process.env.FOCUSED_HERO_ONLY === '1') {
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, sources, checks, failures: checks.filter(item => !item.pass) }, null, 2));
        console.log(JSON.stringify(checks.filter(item => !item.pass), null, 2));
        process.exitCode = checks.some(item => !item.pass) ? 1 : 0;
        return;
      }
      check('scroll changes visible composition', !sameComposition(start, end), { start: start.composition, end: end.composition });
      // The same black display must not flash gray when the still replaces video.
      // Inverse opacity fades alone expose the white stage at their midpoint.
      const handoff = [];
      for (const progress of [.759, .76, .78, .80, .82, .84, .841]) {
        await phase(page, progress);
        const sample = await state(page);
        const videoAlpha = sample.videos[0]?.alpha || 0;
        const imageAlpha = sample.images.find(image => /AI Agent/i.test(image.alt))?.alpha || 0;
        handoff.push({ progress, coverage: 1 - (1 - videoAlpha) * (1 - imageAlpha) });
        await page.screenshot({ path: path.join(out, 'handoff-' + progress + '.png') });
      }
      check('video-to-still handoff does not expose the stage through the display', handoff.every(sample => sample.coverage > .99), handoff);
      // Sample the agreed unfold/reveal/enlarge boundaries from both directions.
      // This detects interrupted reconciliation without reproducing easing math.
      const boundaryProgress = [0, .001, .759, .76, .761, .839, .84, .841, .979, .98, .981, .999, 1];
      const boundaryStates = [];
      for (const progress of boundaryProgress) {
        await phase(page, progress); boundaryStates.push({ progress, state: await state(page) });
      }
      const boundaryReversals = [];
      for (const previous of boundaryStates.slice().reverse()) {
        await phase(page, previous.progress); const current = await state(page);
        boundaryReversals.push({ progress: previous.progress, same: sameComposition(previous.state, current), timeDelta: Math.abs(previous.state.videos[0].time - current.videos[0].time) });
      }
      check('phase boundaries and endpoints reconcile identically in reverse', boundaryReversals.every(sample => sample.same && sample.timeDelta < .12), boundaryReversals);
      for (const progress of [.45, .56, .59, .63, .68, .73, .76, .90, .98]) {
        await phase(page, progress);
        await page.screenshot({ path: path.join(out, 'motion-' + progress + '.png') });
      }
      await phase(page, .3); const reversed = await state(page);
      check('reverse scroll restores composition and media time', sameComposition(middle, reversed) && Math.abs(middle.videos[0].time - reversed.videos[0].time) < .12, { middle, reversed });
      // An interrupted seek must reconcile to the latest native scroll position.
      for (const p of [.8, .1, .5, .22]) await page.locator(selector).evaluate((root, p) => scrollTo(0, scrollY + root.getBoundingClientRect().top + (root.offsetHeight - innerHeight) * p), p);
      await settle(page); await settle(page);
      const interrupted = await state(page);
      await phase(page, .22); const stable = await state(page);
      check('rapid reversal converges to the latest scroll location', sameComposition(interrupted, stable) && Math.abs(interrupted.videos[0].time - stable.videos[0].time) < .12, { interrupted, stable });
      await page.setViewportSize({ width: 1024, height: 768 });
      await phase(page, .45); const resizedMiddle = await state(page);
      await phase(page, 1); await aiEndpoint(page, 'resized-desktop');
      await phase(page, .45); const resizedReverse = await state(page);
      check('resized desktop reverses to the same frame', sameComposition(resizedMiddle, resizedReverse) && Math.abs(resizedMiddle.videos[0].time - resizedReverse.videos[0].time) < .12, { resizedMiddle, resizedReverse });
      await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
      const narrow = await state(page);
      check('desktop-to-mobile resize releases video and sticky stage', narrow.sticky !== 'sticky' && narrow.videos.every(video => !video.src && video.ready === 0), narrow);
      await phase(page, 1); await aiEndpoint(page, 'resized-mobile');
      await page.setViewportSize({ width: 1440, height: 900 }); await phase(page, .3); await settle(page);
      const restoredDesktop = await state(page);
      check('mobile-to-desktop resize restores motion without duplicate media', restoredDesktop.sticky === 'sticky' && restoredDesktop.videos.length === 1 && restoredDesktop.videos[0].ready >= 2, restoredDesktop);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        await phase(page, 1);
        await whiteIntro(page, theme);
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
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await settle(page);
      check('scrolling far away releases video resources', (await state(page)).videos.every(video => !video.src && video.ready === 0 && video.network === 0));
      for (let visit = 0; visit < 2; visit++) {
        await phase(page, .4);
        await page.locator(selector).evaluate(root => { window.__oldSamsungStory = root; window.__oldSamsungWorkspace = document.querySelector('[data-samsung-workspace]'); window.__oldSamsungVideos = [...root.querySelectorAll('video')]; location.hash = '#/about'; });
        await page.locator(selector).waitFor({ state: 'detached' }); await settle(page);
        const retired = await page.evaluate(() => window.__oldSamsungVideos.map(video => ({ connected: video.isConnected, src: video.getAttribute('src'), currentSrc: video.currentSrc, paused: video.paused, ready: video.readyState, network: video.networkState })));
        check('route exit ' + visit + ' releases detached video', retired.every(video => !video.connected && !video.src && video.ready === 0 && video.network === 0 && video.paused), retired);
        const before = await page.evaluate(() => [window.__oldSamsungStory.outerHTML, window.__oldSamsungWorkspace?.outerHTML]);
        await page.evaluate(() => { scrollTo(0, 400); window.__oldSamsungVideos.forEach(video => video.dispatchEvent(new Event('seeked'))); }); await settle(page);
        check('route exit ' + visit + ' ignores late media completion', JSON.stringify(before) === JSON.stringify(await page.evaluate(() => [window.__oldSamsungStory.outerHTML, window.__oldSamsungWorkspace?.outerHTML])));
        await enter(page);
        check('route reentry ' + visit + ' has exactly one story', await page.locator(selector).count() === 1);
        check('route reentry ' + visit + ' has exactly one workspace', await page.locator(workspaceSelector).count() === 1);
        check('route reentry ' + visit + ' returns to the opening', await page.evaluate(() => scrollY < 2));
      }
      await page.close();
      for (const width of [320, 390, 820]) await staticChecks(browser, { viewport: { width, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' }, 'mobile-' + width);
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
