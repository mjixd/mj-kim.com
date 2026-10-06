const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'hello-w-tests');
const rootUrl = new URL('../', process.env.GAME_URL || 'http://127.0.0.1:8789/hello-w-play/').href;
const checks = [], check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(rootUrl + '#/work/meta');
  const section = page.locator('section.band').filter({ has: page.getByRole('heading', { name: 'Workflow integration', exact: true }) });
  await section.scrollIntoViewIfNeeded();
  const accordion = section.locator('.solution-accordion');
  check('workflow retains four accordion entries', await accordion.isVisible() && await accordion.locator('.solution-toggle').count() === 4);
  check('workflow removes old standalone EN44 slide', await section.locator('img').evaluateAll(images => images.every(image => !/EN.*44\.png/.test(decodeURIComponent(image.src)))));
  const desktop = await accordion.evaluate(element => { const left = element.querySelector('.solution-list').getBoundingClientRect(), right = element.querySelector('.solution-visual').getBoundingClientRect(); return { text: left.width, visual: right.width, sameRow: Math.abs(left.top - right.top) < 2, ratio: left.width / (left.width + right.width) }; });
  check('desktop text and thumbnail use 25:75 available width', desktop.sameRow && Math.abs(desktop.ratio - .25) < .01, desktop);
  for (let index = 0; index < 4; index++) {
    const button = accordion.locator('.solution-toggle').nth(index);
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
    check('accordion item ' + index + ' retains exclusive matching content', await accordion.locator('.solution-toggle[aria-expanded="true"]').count() === 1 && await accordion.locator('.solution-description').nth(index).isVisible() && await accordion.locator('.solution-visual img').nth(index).isVisible());
  }
  await section.screenshot({ path: path.join(out, 'meta-workflow-desktop.png') });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const geometry = await accordion.evaluate(element => { const left = element.querySelector('.solution-list').getBoundingClientRect(), right = element.querySelector('.solution-visual').getBoundingClientRect(); return { stacked: right.top >= left.bottom, overflow: document.documentElement.scrollWidth > innerWidth, left: right.left, right: right.right }; });
    check(width + ' mobile keeps stacked layout without overflow', geometry.stacked && !geometry.overflow && geometry.left >= 0 && geometry.right <= width + 1, geometry);
    await section.screenshot({ path: path.join(out, `meta-workflow-${width}.png`) });
  }
  await browser.close();
  const result = { checks, failures: checks.filter(item => !item.pass) };
  fs.writeFileSync(path.join(out, 'meta-layout-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(item => item.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
