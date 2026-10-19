const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || '/tmp/samsung-section-images';
const expected = [
  {
    heading: 'Complex data, clear decisions, on site',
    src: 'assets/covers/cover_ces.png',
    copy: 'Dense energy and space data compressed into a mobile decision surface. Partner, engineering, and business requirements converged through weekly CTO·VP reviews and shipped as the AI Office prototype at CES 2025.',
  },
  {
    heading: 'Design token validation',
    src: 'assets/decks/EN · 13.png',
    copy: 'A shared workflow for design-asset governance and implementation QA. I conceived a validation tool that connects design tokens, implementation rules, and the rendered interface so teams can verify changes against a common standard.',
  },
];
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '#/work/samsung', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: expected[0].heading, exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      const headings = await page.locator('main h2').allTextContents();
      check(width + ': target section order remains unchanged', headings.indexOf(expected[1].heading) === headings.indexOf(expected[0].heading) + 1, headings);
      for (const target of expected) {
        const section = page.locator('section.band').filter({ has: page.getByRole('heading', { name: target.heading, exact: true }) });
        const images = section.locator('img');
        const sources = await images.evaluateAll(images => images.map(image => decodeURIComponent(image.getAttribute('src').split('?')[0])));
        check(width + ' ' + target.heading + ': exactly the requested image', sources.length === 1 && sources[0] === target.src, sources);
        check(width + ' ' + target.heading + ': original copy preserved', await section.locator('.slide > p').first().textContent() === target.copy);
        if (sources.length === 1) {
          await images.evaluate(image => image.decode());
          const geometry = await images.evaluate(image => {
            const r = image.getBoundingClientRect(), root = image.closest('section'), title = root.querySelector('h2').getBoundingClientRect();
            return { loaded: image.naturalWidth > 0, left: r.left, right: r.right, below: r.top >= title.bottom, width: r.width, height: r.height };
          });
          check(width + ' ' + target.heading + ': image appears below heading and within viewport', geometry.loaded && geometry.below && geometry.left >= -1 && geometry.right <= width + 1 && geometry.width > 0 && geometry.height > 0, geometry);
          await images.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(out, `${width}-${target.src.includes('cover_ces') ? 'ces-photo' : 'token-slide'}.png`) });
        }
      }
      check(width + ': no runtime errors or horizontal overflow', errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors);
      await page.close();
    }
  } finally { await browser.close(); }
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../index.html'))).digest('hex');
  const failures = checks.filter(check => !check.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceHash, checks, failures }, null, 2));
  console.log(`${checks.length} checks, ${failures.length} failures`, failures);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
