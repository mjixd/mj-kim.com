// Contract: keep Meta's gradient fullwidth while shrinking the four-screen
// group to 80% of its previous size, preserving center and spacing proportions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || '/tmp/meta-hero-width';
const browserName = process.env.TEST_BROWSER || 'chromium';
// Rendered artwork widths captured before the requested 20% reduction.
// The original asset's immutable pixels preserve inter-screen spacing ratios.
const baseline = [
  { width: 1440, hero: 1555.2001953125, bodyLeft: 64, bodyRight: 1376, gutter: 63.36 },
  { width: 390, hero: 421.20001220703125, bodyLeft: 0, bodyRight: 390, gutter: 20 },
  { width: 320, hero: 345.5999755859375, bodyLeft: 0, bodyRight: 320, gutter: 20 },
];
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const near = (a, b) => Math.abs(a - b) < 1;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw[browserName].launch({ headless: true, ...(browserName === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    for (const expected of baseline) {
      const page = await browser.newPage({ viewport: { width: expected.width, height: 950 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '#/work/domino-mvp', { waitUntil: 'domcontentloaded' });
      check(expected.width + ': Domino company label is exact', await page.locator('.c-hero .meta').textContent() === 'Domino App');
      await page.goto(base + '#/work/meta', { waitUntil: 'domcontentloaded' });
      const image = page.locator('main img[src="assets/meta/hero-four-screens.png"]');
      await image.waitFor();
      await image.evaluate(image => image.decode());
      await page.evaluate(() => document.fonts.ready);
      check(expected.width + ': Meta company label is exact', await page.locator('.c-hero .meta').textContent() === 'Meta Platforms, Inc.');
      const geometry = await image.evaluate(image => {
        const r = image.getBoundingClientRect(), parent = image.closest('.kv'), box = parent.getBoundingClientRect();
        const body = document.querySelector('.slide.wrap'), content = body.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, height: r.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, boxLeft: box.left, boxRight: box.right, radius: parseFloat(getComputedStyle(parent).borderRadius), background: getComputedStyle(parent).backgroundImage, bodyLeft: content.left, bodyRight: content.right, gutter: parseFloat(getComputedStyle(body).paddingLeft), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(expected.width + ': gradient artwork reaches both viewport edges', near(geometry.boxLeft, 0) && near(geometry.boxRight, expected.width) && geometry.radius === 0 && /gradient/.test(geometry.background), geometry);
      check(expected.width + ': four-screen group is 20% narrower with preserved proportions', near(geometry.width, expected.hero * .8) && near((geometry.left + geometry.right) / 2, expected.width / 2) && geometry.left + geometry.width * .09 >= 0 && geometry.right - geometry.width * .09 <= expected.width && Math.abs(geometry.width / geometry.height - geometry.naturalWidth / geometry.naturalHeight) < .005, geometry);
      check(expected.width + ': lateral background room increases', geometry.left > (expected.width - expected.hero) / 2 && geometry.right < (expected.width + expected.hero) / 2, geometry);
      check(expected.width + ': body gutters are unchanged without horizontal overflow', near(geometry.bodyLeft, expected.bodyLeft) && near(geometry.bodyRight, expected.bodyRight) && near(geometry.gutter, expected.gutter) && !geometry.overflow, geometry);
      check(expected.width + ': original hero request link remains', (await image.locator('..').getAttribute('href'))?.startsWith('mailto:mkim181@sva.edu?subject='));
      await image.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `${browserName}-${expected.width}.png`) });
      // Use the public navigation to verify that the case can be remounted.
      const next = await page.locator('.pager .next').getAttribute('href');
      await page.locator('.pager .next').click();
      await page.waitForURL(base + next);
      await page.locator('.pager .prev').click();
      await page.waitForURL(base + '#/work/meta');
      await image.waitFor();
      check(expected.width + ': route reentry preserves the label and artwork', await page.locator('.c-hero .meta').textContent() === 'Meta Platforms, Inc.' && await image.count() === 1);
      check(expected.width + ': no runtime errors', errors.length === 0, errors);
      await page.close();
    }
  } finally { await browser.close(); }
  const root = path.resolve(__dirname, '../..');
  const assetHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/meta/hero-four-screens.png'))).digest('hex');
  check('existing four-screen asset is unchanged', assetHash === 'f43c805f4c199d2ac92a1351138673ea139cdef90bfa97b04198875a126487f5', assetHash);
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'index.html'))).digest('hex');
  const failures = checks.filter(check => !check.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ browserName, sourceHash, checks, failures }, null, 2));
  console.log(`${checks.length} checks, ${failures.length} failures`, failures);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
