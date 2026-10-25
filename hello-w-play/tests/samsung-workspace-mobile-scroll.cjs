// Independent user contract: scroll owns mobile arrivals; idle time does not.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8794/';
const out = process.env.TEST_OUTPUT || '/tmp/samsung-workspace-mobile-scroll';
const selector = '[data-samsung-workspace]', checks = [], errors = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
async function state(page) {
  return page.locator(selector).evaluate(root => {
    const stage = root.querySelector('[data-samsung-stage]'), visual = root.querySelector('.samsung-workspace__visual');
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    return {
      panes: [...root.querySelectorAll('[data-samsung-screen]')].map(node => ({ id: node.dataset.samsungScreen, opacity: +getComputedStyle(node).opacity, transform: node.style.transform, width: node.style.width, rect: rect(node) })),
      previews: [...root.querySelectorAll('[data-samsung-preview]')].map(node => ({ opacity: +getComputedStyle(node).opacity, transform: node.style.transform })),
      canvas: root.querySelector('.samsung-workspace__canvas').style.transform,
      stage: rect(stage), visual: rect(visual), device: rect(root.querySelector('.samsung-workspace__device')),
      copy: rect(root.querySelector('.samsung-story__copy')), heading: rect(root.querySelector('h2')),
      paddingBottom: parseFloat(getComputedStyle(stage).paddingBottom), sticky: getComputedStyle(stage).position, stickyTop: parseFloat(getComputedStyle(stage).top) || 0,
      rootHeight: root.offsetHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      width: innerWidth, height: innerHeight,
    };
  });
}
const visible = s => s.panes.filter(p => p.opacity > .9).map(p => p.id);
const composition = s => JSON.stringify({ panes: s.panes.map(({ rect, ...p }) => p), previews: s.previews, canvas: s.canvas });
async function phase(page, p) {
  await page.locator(selector).evaluate((root, p) => {
    const stage = root.querySelector('[data-samsung-stage]');
    const travel = Math.max(0, root.offsetHeight - (innerWidth <= 820 ? stage.offsetHeight : innerHeight));
    scrollTo({ top: scrollY + root.getBoundingClientRect().top - (innerWidth <= 820 ? parseFloat(getComputedStyle(stage).top) || 0 : 0) + travel * p, behavior: 'instant' });
  }, p);
  await page.waitForTimeout(120); return state(page);
}
async function enter(browser, width, height, reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/work/samsung', { waitUntil: 'domcontentloaded' });
  await page.locator(selector).waitFor(); await page.evaluate(() => document.fonts.ready);
  return page;
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const executablePath = process.env[engine.toUpperCase() + '_EXECUTABLE'];
  const browser = await pw[engine].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const [width, height] of [[390,844], [320,568], [820,500], [1440,900]]) {
      const page = await enter(browser, width, height), label = width + 'x' + height;
      const opening = await phase(page, 0);
      if (width === 390) {
        await page.waitForTimeout(4700);
        const idle = await state(page);
        check(label + ': idle time cannot advance composition', composition(opening) === composition(idle), { opening, idle });
      }
      const phases = [];
      for (const p of [.28, .60, 1, .60, .28]) phases.push(await phase(page, p));
      check(label + ': forward and reverse reveal control then visitor then AI', JSON.stringify(phases.map(visible)) === JSON.stringify([['control'], ['control','visitor'], ['control','visitor','ai'], ['control','visitor'], ['control']]), phases);
      check(label + ': reverse restores pane geometry', composition(phases[0]) === composition(phases[4]) && composition(phases[1]) === composition(phases[3]), phases);
      check(label + ': sticky scroll has positive travel', opening.sticky === 'sticky' && opening.rootHeight > opening.stage.height + 100 && Math.abs(phases[0].stage.y - phases[0].stickyTop) <= 1, opening);
      if (width <= 820) {
        const end = phases[2];
        check(label + ': compact copy and device fit horizontally', !end.overflow && end.copy.x >= 0 && end.copy.right <= width + 1 && end.device.x >= 0 && end.device.right <= width + 1 && end.visual.y - end.copy.bottom >= 0 && end.visual.y - end.copy.bottom <= 40 && end.paddingBottom <= 40, end);
        await phase(page, 1);
        await page.locator(selector + ' .samsung-workspace__device').evaluate(node => node.scrollIntoView({ block: 'end', behavior: 'instant' }));
        const reached = await state(page);
        check(label + ': device remains reachable after sticky exit', reached.device.bottom <= height + 1 && reached.device.bottom > 0 && reached.device.y >= -1, reached);
      }
      if (width === 390) {
        const before = await phase(page, .60);
        await page.evaluate(() => { window.__workspaceHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight'); Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 }); dispatchEvent(new Event('resize')); });
        await page.waitForTimeout(120);
        const after = await state(page);
        check('toolbar height change preserves scroll composition', composition(before) === composition(after), { before, after });
        await page.evaluate(() => Object.defineProperty(window, 'innerHeight', window.__workspaceHeight));
      }
      await phase(page, 1); await page.screenshot({ path: path.join(out, label + '.png') }); await page.close();
    }
    for (const width of [390,1440]) {
      const page = await enter(browser, width, 900, 'reduce');
      const before = await phase(page, .2); await page.waitForTimeout(500); const after = await phase(page, .8);
      check(width + ': reduced motion shows static final panes', visible(before).join(',') === 'control,visitor,ai' && before.previews.every(p => p.opacity < .01) && composition(before) === composition(after) && before.sticky !== 'sticky', { before, after });
      await page.close();
    }
    check('no uncaught browser errors', errors.length === 0, errors);
  } finally { await browser.close(); }
  const hashes = Object.fromEntries(['samsung-workspace.js','samsung-workspace.css','hello-w-play/tests/samsung-workspace-mobile-scroll.cjs'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', f))).digest('hex')]));
  const failures = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, hashes, checks, failures }, null, 2));
  console.log(checks.length + ' checks, ' + failures.length + ' failures', failures.map(c => c.name));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
