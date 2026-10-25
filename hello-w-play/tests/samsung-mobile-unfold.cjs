// Independent behavioral contract for mobile unfolding and unchanged desktop gates.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'chromium';
// Serve media with HTTP Range support so browser seeking is exercised.
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || '/tmp/samsung-mobile-unfold';
const checks = [], errors = [], selector = '[data-samsung-story]';
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
async function state(page) {
  return page.locator(selector).evaluate(root => {
    const image = root.querySelector('.samsung-story__interface'), video = root.querySelector('video');
    const r = image.getBoundingClientRect(), fit = Math.min(r.width / image.naturalWidth, r.height / image.naturalHeight);
    const h = root.querySelector('h2').getBoundingClientRect();
    return { sticky: getComputedStyle(root.firstElementChild).position, runway: root.offsetHeight, stageHeight: root.firstElementChild.offsetHeight, stageTop: root.firstElementChild.getBoundingClientRect().top,
      imageAlpha: +getComputedStyle(image).opacity, videoAlpha: +getComputedStyle(video).opacity,
      ready: video.readyState, time: video.currentTime, src: video.getAttribute('src'), decoded: image.naturalWidth > 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      device: { left: r.x + (r.width - image.naturalWidth * fit) / 2, right: r.x + (r.width + image.naturalWidth * fit) / 2,
        top: r.y + (r.height - image.naturalHeight * fit) / 2, bottom: r.y + (r.height + image.naturalHeight * fit) / 2 },
      headingBottom: h.bottom, height: innerHeight, width: innerWidth };
  });
}
async function visibleVideoGap(page) {
  return page.locator(selector).evaluate(root => {
    const video = root.querySelector('video'), box = video.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let first = -1;
    for (let y = 0; y < canvas.height && first < 0; y++) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 160) dark++;
      }
      if (dark > canvas.width * .02) first = y;
    }
    const css = getComputedStyle(video), fit = css.objectFit === 'cover' ? Math.max(box.width / canvas.width, box.height / canvas.height) : Math.min(box.width / canvas.width, box.height / canvas.height);
    const offset = (box.height - canvas.height * fit) * parseFloat(css.objectPosition.split(' ')[1]) / 100;
    const contentTop = box.top + offset + first * fit, headingBottom = root.querySelector('h2').getBoundingClientRect().bottom;
    return { gap: contentTop - headingBottom, contentTop, headingBottom, first, time: video.currentTime };
  });
}
async function visibleOverviewGap(page) {
  return page.locator(selector).evaluate(root => {
    const final = root.querySelector('.samsung-story__interface');
    const image = +getComputedStyle(final).opacity >= .99 ? final : root.querySelector('video');
    const nativeWidth = image.videoWidth || image.naturalWidth, nativeHeight = image.videoHeight || image.naturalHeight, box = image.getBoundingClientRect();
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = Math.round(400 * nativeHeight / nativeWidth);
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let last = -1;
    for (let y = canvas.height - 1; y >= 0 && last < 0; y--) {
      let dark = 0;
      for (let x = 0; x < canvas.width; x++) { const i = (y * canvas.width + x) * 4; if (pixels[i + 3] > 128 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 160) dark++; }
      if (dark > canvas.width * .02) last = y;
    }
    const fit = Math.min(box.width / nativeWidth, box.height / nativeHeight);
    const positionY = parseFloat(getComputedStyle(image).objectPosition.split(' ')[1]) / 100;
    const deviceBottom = box.top + (box.height - nativeHeight * fit) * positionY + (last + 1) / canvas.height * nativeHeight * fit;
    const paragraph = document.querySelector('.samsung-story__overview p').getBoundingClientRect();
    const overviewTop = paragraph.top;
    return { gap: overviewTop - deviceBottom, deviceBottom, overviewTop, overviewBottom: paragraph.bottom, viewportHeight: innerHeight, last };
  });
}
async function phase(page, value) {
  await page.locator(selector).evaluate((root, value) => scrollTo({ top: scrollY + root.getBoundingClientRect().top + (root.offsetHeight - (innerWidth <= 820 ? root.firstElementChild.offsetHeight : innerHeight)) * value, behavior: 'instant' }), value);
  await page.waitForTimeout(350); return state(page);
}
async function enter(browser, width, height, reducedMotion = 'no-preference', fail = false) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
  page.on('pageerror', error => errors.push(error.message));
  if (fail) await page.route('**/assets/samsung/unfold-ai-workspace.mp4*', route => route.abort());
  await page.goto(base + '#/work/samsung'); await page.locator(selector).waitFor();
  await page.evaluate(() => document.fonts.ready); return page;
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const executablePath = process.env[engine.toUpperCase() + '_EXECUTABLE'];
  const browser = await pw[engine].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const [width, height] of [[320,568], [390,844], [820,699], [821,700], [1440,900]]) {
      const page = await enter(browser, width, height), label = width + 'x' + height;
      let start = await phase(page, 0);
      if (start.src) { await page.waitForFunction(s => document.querySelector(s + ' video').readyState >= 2, selector); start = await phase(page, 0); }
      if (width === 390) {
        const gap = await visibleVideoGap(page);
        check('390x844: title to visible opening device gap is at most 80px', gap.first >= 0 && gap.gap >= 0 && gap.gap <= 80, gap);
        await page.screenshot({ path: path.join(out, '390x844-opening.png') });
      }
      const middle = await phase(page, .4), end = await phase(page, 1), reverse = await phase(page, .4);
      check(label + ': scroll runway and sticky stage', start.sticky === 'sticky' && start.runway - start.stageHeight >= height * (width <= 820 ? 1.4 : 2) - 2 && Math.abs(middle.stageTop) <= 1, start);
      check(label + ': unfolding advances visible decoded video', start.imageAlpha < .01 && middle.videoAlpha > .99 && middle.ready >= 2 && middle.time > start.time + .5, { start, middle });
      check(label + ': endpoint is decoded final UI within viewport', end.decoded && end.imageAlpha > .99 && !end.overflow && end.device.left >= 7 && end.device.right <= width - 7 && end.device.top >= end.headingBottom && end.device.bottom <= height + 1, end);
      if (width === 390) {
        await phase(page, 1);
        const gap = await visibleOverviewGap(page);
        check('390x844: final device to overview gap is at most 100px', gap.last >= 0 && gap.gap >= 0 && gap.gap <= 100, gap);
        await page.screenshot({ path: path.join(out, '390x844-exit.png') });
        for (const progress of [0, .4, .8, 1]) {
          await phase(page, progress);
          const overview = await visibleOverviewGap(page);
          check('390x844: overview follows visible device during phase ' + progress, overview.last >= 0 && overview.gap >= 0 && overview.gap <= 160 && overview.overviewTop >= 0 && overview.overviewBottom <= overview.viewportHeight, overview);
          await page.screenshot({ path: path.join(out, '390x844-overview-' + progress + '.png') });
        }
        await phase(page, .4);
      }
      check(label + ': reversing scroll restores intermediate video', reverse.videoAlpha > .99 && reverse.imageAlpha < .01 && Math.abs(reverse.time - middle.time) < .1, { middle, reverse });
      if (width === 390) {
        await page.locator(selector + ' video').evaluate(v => { window.__storyVideo = v; window.__storyLoads = 0; v.addEventListener('loadstart', () => window.__storyLoads++); });
        await page.evaluate(() => { window.__heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight'); Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 }); dispatchEvent(new Event('resize')); });
        await page.waitForTimeout(200);
        const toolbar = await state(page);
        check('toolbar height change preserves scroll progress', Math.abs(toolbar.time - middle.time) < .1 && toolbar.src === middle.src, { toolbar, middle });
        await page.evaluate(() => { Object.defineProperty(window, 'innerHeight', window.__heightDescriptor); });
        await page.setViewportSize({ width, height: 650 }); await page.waitForTimeout(350);
        const resized = await state(page), lifetime = await page.locator(selector + ' video').evaluate(v => ({ same: v === window.__storyVideo, loads: window.__storyLoads }));
        check('portrait height change retains video source and progress', lifetime.same && lifetime.loads === 0 && resized.src === middle.src && resized.ready >= 2 && resized.time > .5, { resized, lifetime, middle });
      }
      await phase(page, 1); await page.screenshot({ path: path.join(out, label + '.png') });
      if (width <= 820) {
        await page.locator('.samsung-story__overview p').last().evaluate(p => p.scrollIntoView({ block: 'end', behavior: 'instant' }));
        const copy = await page.locator('.samsung-story__overview p').last().evaluate(p => { const r = p.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: innerHeight }; });
        check(label + ': full overview copy is reachable after unfolding', copy.top >= 0 && copy.bottom <= copy.height + 1, copy);
      }
      if (width === 390) {
        await page.locator('.samsung-story__overview').evaluate(node => { window.__overview = node; window.__overviewText = node.textContent; });
        for (const [nextWidth, reducedMotion, remount] of [[1440, 'no-preference', false], [390, 'no-preference', false], [390, 'reduce', false], [390, 'no-preference', true], [390, 'no-preference', true]]) {
          await page.setViewportSize({ width: nextWidth, height: 900 });
          await page.emulateMedia({ reducedMotion });
          if (remount) await page.evaluate(() => SamsungStory.mount());
          await page.waitForTimeout(150);
          const overview = await page.evaluate(() => { const nodes = [...document.querySelectorAll('.samsung-story__overview')]; return { count: nodes.length, same: nodes[0] === window.__overview, text: nodes[0]?.textContent === window.__overviewText, outside: !document.querySelector('[data-samsung-story]').contains(nodes[0]) }; });
          check('overview survives width/motion/remount ' + [nextWidth, reducedMotion, remount].join('/'), overview.count === 1 && overview.same && overview.text && (nextWidth <= 820 || overview.outside), overview);
        }
      }
      await page.close();
    }
    for (const [width, height, reduced, fail, label] of [[390,844,'reduce',false,'mobile-reduced'], [1440,900,'reduce',false,'desktop-reduced'], [821,699,'no-preference',false,'short-desktop'], [390,844,'no-preference',true,'mobile-media-error']]) {
      const page = await enter(browser, width, height, reduced, fail);
      const before = await phase(page, .4); await page.waitForTimeout(500); const after = await phase(page, .8);
      check(label + ': final readable image fallback', after.decoded && after.imageAlpha > .99 && !after.overflow, after);
      if (!fail) check(label + ': static without video loading', before.sticky !== 'sticky' && !before.src && !after.src, { before, after });
      await page.close();
    }
    check('no uncaught browser errors', errors.length === 0, errors);
  } finally { await browser.close(); }
  const hashes = Object.fromEntries(['samsung-story.js','samsung-story.css','hello-w-play/tests/samsung-mobile-unfold.cjs'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', f))).digest('hex')]));
  const failures = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, hashes, checks, failures }, null, 2));
  console.log(checks.length + ' checks, ' + failures.length + ' failures', failures.map(c => c.name));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
