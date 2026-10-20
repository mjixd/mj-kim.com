const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'case-copy-tests');
const email = 'mkim181@sva.edu';
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const settle = page => page.waitForTimeout(70);
const feedback = page => page.locator('[role="status"], [role="alert"]').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0').map(node => node.textContent).join(' '));
const success = text => text.includes(email) && /copied/i.test(text) && !/couldn.t|cannot|unable|failed|not copied/i.test(text);
const usefulFailure = text => !success(text) && text.includes(email) && /copy|select|manual/i.test(text);
async function mockClipboard(page) {
  await page.addInitScript(() => {
    window.copyProbe = { mode: 'resolve', calls: [], pending: [] };
    const clipboard = { writeText(value) {
      const probe = window.copyProbe;
      probe.calls.push(value);
      if (probe.mode === 'reject') return Promise.reject(new Error('Clipboard denied'));
      if (probe.mode === 'pending') return new Promise((resolve, reject) => probe.pending.push({ resolve, reject }));
      return Promise.resolve();
    } };
    window.setCopyMode = mode => {
      window.copyProbe.mode = mode;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'unavailable' ? undefined : clipboard });
    };
    window.setCopyMode('resolve');
  });
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright[browserName].launch({ headless: true, ...(browserName === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await mockClipboard(page);
    await page.goto(base);
    const routes = await page.locator('a[href^="#/work/"]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href')))]);
    check(`${width}: all project routes discovered`, routes.length >= 4, routes);
    await page.goto(base + '#/about');
    const aboutLinks = await page.locator('a[href^="mailto:"]').evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute('href'), text: node.textContent })));
    check(`${width}: About contact links display and target new email`, aboutLinks.length >= 2 && aboutLinks.every(link => link.href.startsWith('mailto:' + email) && link.text.includes(email)), aboutLinks);
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator('.pager').waitFor();
      const geometry = await page.evaluate(() => {
        const pager = document.querySelector('.pager .wrap');
        const style = getComputedStyle(pager);
        const footer = document.querySelector('footer .wrap');
        const box = footer.getBoundingClientRect();
        const children = [...footer.children].map(node => node.getBoundingClientRect());
        const contentTop = Math.min(...children.map(rect => rect.top));
        const contentBottom = Math.max(...children.map(rect => rect.bottom));
        return { top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom), footerCenterOffset: (contentTop + contentBottom - box.top - box.bottom) / 2, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(`${width} ${route}: pager adds 80px to each original 28px edge`, geometry.top === 108 && geometry.bottom === 108, geometry);
      check(`${width} ${route}: footer text vertically centered without overflow`, Math.abs(geometry.footerCenterOffset) <= 1 && !geometry.overflow, geometry);
      const controls = page.locator('.deck-band .btn, .deck-strip .thumb');
      check(`${width} ${route}: exactly four accessible copy controls including +N`, await controls.count() === 4 && await page.locator('.deck-strip .more').innerText().then(text => /\+\d+/.test(text)));
      const mailto = await page.locator('a[href^="mailto:"]').evaluateAll(nodes => nodes.filter(node => !node.closest('.deck-band')).map(node => node.getAttribute('href')));
      check(`${width} ${route}: other mailto links retained`, mailto.includes('mailto:' + email) && mailto.every(href => href.startsWith('mailto:' + email)) && mailto.some(href => new URL(href).searchParams.get('subject')?.startsWith('Case study request: ')), mailto);
      for (let index = 0; index < await controls.count(); index++) {
        const before = await page.evaluate(() => copyProbe.calls.length);
        await controls.nth(index).click();
        await settle(page);
        const calls = await page.evaluate(() => copyProbe.calls);
        const message = await feedback(page);
        check(`${width} ${route}: control ${index} copies exact email and announces English success`, calls.length === before + 1 && calls.at(-1) === email && success(message) && !/[가-힣]/.test(message) && new URL(page.url()).hash === route, { calls: calls.slice(before), message });
      }
    }
    // Native keyboard activation, repeat use, and real router transitions.
    await page.goto(base + '#/work/meta');
    const controls = page.locator('.deck-band .btn, .deck-strip .thumb');
    for (const [index, key] of [[0, 'Enter'], [3, 'Space'], [0, 'Space']]) {
      const before = await page.evaluate(() => copyProbe.calls.length);
      await controls.nth(index).focus();
      await page.keyboard.press(key);
      await settle(page);
      check(`${width}: control ${index} accepts keyboard ${key}`, await page.evaluate(() => copyProbe.calls.length) === before + 1 && success(await feedback(page)));
    }
    const nextRoute = await page.locator('.pager .next').getAttribute('href');
    await page.locator('.pager .next').click();
    await page.waitForURL(base + nextRoute);
    await page.locator('.deck-band .btn').click();
    await settle(page);
    check(`${width}: next navigation retains copy action`, success(await feedback(page)));
    await page.locator('.pager .prev').click();
    await page.waitForURL(base + '#/work/meta');
    await page.locator('.deck-strip .more').click();
    await settle(page);
    check(`${width}: previous navigation and repeat +N retain copy action`, success(await feedback(page)));
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `case-footer-${browserName}-${width}.png`) });
    check(`${width}: no uncaught page errors`, errors.length === 0, errors);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await mockClipboard(page);
  for (const mode of ['pending', 'reject', 'unavailable']) {
    await page.goto(base + '#/work/meta');
    await page.evaluate(mode => setCopyMode(mode), mode);
    await page.locator('.deck-band .btn').click();
    await settle(page);
    let message = await feedback(page);
    check(`${mode}: no false success`, !success(message), message);
    if (mode === 'pending') {
      check('pending: write has actually started', await page.evaluate(() => copyProbe.pending.length) === 1);
      await page.evaluate(() => copyProbe.pending[0]?.resolve());
      await settle(page);
      message = await feedback(page);
      check('pending: success appears after write resolves', success(message), message);
    } else {
      check(`${mode}: failure offers exact email and useful recovery`, usefulFailure(message), message);
      await page.evaluate(() => setCopyMode('resolve'));
      await page.locator('.deck-strip .more').click();
      await settle(page);
      check(`${mode}: retry can succeed`, success(await feedback(page)));
    }
  }
  // Two unresolved writes must not let an older result replace a newer failure.
  await page.goto(base + '#/work/meta');
  await page.evaluate(() => { copyProbe.pending = []; setCopyMode('pending'); });
  await page.locator('.deck-band .btn').click();
  await page.locator('.deck-strip .more').click();
  check('overlapping writes: both requests started', await page.evaluate(() => copyProbe.pending.length) === 2);
  await page.evaluate(() => copyProbe.pending[1]?.reject(new Error('Denied')));
  await settle(page);
  await page.evaluate(() => copyProbe.pending[0]?.resolve());
  await settle(page);
  check('overlapping writes: newer failure remains after older success', usefulFailure(await feedback(page)), await feedback(page));
  await page.locator('.pager .next').click();
  await page.evaluate(() => setCopyMode('resolve'));
  await page.locator('.deck-band .btn').click();
  await settle(page);
  check('failure followed by route navigation: new copy succeeds', success(await feedback(page)));
  if (browserName === 'chromium') {
    const nativeContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
    const nativePage = await nativeContext.newPage();
    await nativePage.goto(base);
    const nativeRoutes = await nativePage.locator('a[href^="#/work/"]').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href')))]);
    for (const route of nativeRoutes) {
      await nativePage.goto(base + route);
      const controls = nativePage.locator('.deck-band .btn, .deck-strip .thumb');
      for (let index = 0; index < await controls.count(); index++) {
        await nativePage.evaluate(() => navigator.clipboard.writeText('clipboard sentinel'));
        await controls.nth(index).click();
        await settle(nativePage);
        const copied = await nativePage.evaluate(() => navigator.clipboard.readText());
        check('native clipboard ' + route + ' control ' + index, copied === email && success(await feedback(nativePage)), copied);
      }
    }
    await nativeContext.close();
  }
  await browser.close();
  const result = { browser: browserName, sourceHash: crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../index.html'))).digest('hex'), checks, failures: checks.filter(item => !item.pass) };
  fs.writeFileSync(path.join(out, 'case-copy-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures);
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
