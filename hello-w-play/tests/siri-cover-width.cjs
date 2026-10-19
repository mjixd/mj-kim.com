const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || '/tmp/siri-cover-width';
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
// Rendered before this change: canvas filled the cover at both widths.
const baseline = [{ width: 1440, height: 617.140625 }, { width: 390, height: 219.375 }];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const before of baseline) {
      const page = await browser.newPage({ viewport: { width: before.width, height: 950 }, reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '#/', { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('[data-siri-cover] canvas');
      await canvas.waitFor({ state: 'attached' });
      await canvas.scrollIntoViewIfNeeded();
      const geometry = await canvas.evaluate(canvas => {
        const wave = canvas.getBoundingClientRect(), cover = canvas.closest('.siri-cover').getBoundingClientRect();
        return { width: wave.width, height: wave.height, centerX: wave.x + wave.width / 2, centerY: wave.y + wave.height / 2, coverWidth: cover.width, coverHeight: cover.height, coverCenterX: cover.x + cover.width / 2, coverCenterY: cover.y + cover.height / 2 };
      });
      check(before.width + ': waveform width is 85% of baseline', Math.abs(geometry.width - before.width * .85) < .1, geometry);
      check(before.width + ': waveform height and center are unchanged', Math.abs(geometry.height - before.height) < .1 && Math.abs(geometry.centerX - geometry.coverCenterX) < .1 && Math.abs(geometry.centerY - geometry.coverCenterY) < .1, geometry);
      check(before.width + ': cover size is unchanged', geometry.coverWidth === before.width && Math.abs(geometry.coverHeight - before.height) < .1, geometry);
      await page.waitForTimeout(150);
      const first = await canvas.evaluate(canvas => canvas.toDataURL());
      await page.waitForTimeout(300);
      check(before.width + ': waveform still animates actual pixels', first !== await canvas.evaluate(canvas => canvas.toDataURL()));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      const frozen = await canvas.evaluate(canvas => canvas.toDataURL());
      await page.waitForTimeout(150);
      check(before.width + ': reduced motion still freezes animation', frozen === await canvas.evaluate(canvas => canvas.toDataURL()));
      check(before.width + ': no runtime errors or horizontal overflow', errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors);
      await page.locator('.siri-cover').screenshot({ path: path.join(out, `${before.width}.png`) });
      await page.close();
    }
  } finally { await browser.close(); }
  const cssHash = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../siri-story.css'))).digest('hex');
  const failures = checks.filter(check => !check.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ cssHash, checks, failures }, null, 2));
  console.log(`${checks.length} checks, ${failures.length} failures`, failures);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
