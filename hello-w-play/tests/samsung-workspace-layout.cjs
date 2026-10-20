const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-workspace-layout');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 800 },
      { width: 1920, height: 1200 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(base + '#/work/samsung');
      const root = page.locator('[data-samsung-workspace]');
      await root.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const mobile = viewport.width <= 820;
      for (const progress of mobile ? [1] : [0, 0.5, 1]) {
        await root.evaluate((r, p) => scrollTo({ top: scrollY + r.getBoundingClientRect().top +
          Math.max(0, r.offsetHeight - innerHeight) * p, behavior: 'instant' }), progress);
        if (mobile) {
          // Mobile plays once when visible; measure the settled device, not an incoming card.
          await page.waitForFunction(() => [...document.querySelectorAll('[data-samsung-screen]')]
            .every(e => getComputedStyle(e).opacity === '1'), null, { timeout: 10000 });
          // The device fit finishes after the last pane has docked.
          await page.waitForTimeout(1000);
        } else await page.waitForTimeout(100);
        const geometry = await root.evaluate(r => {
          const box = selector => r.querySelector(selector).getBoundingClientRect();
          const copy = box('.samsung-story__copy'), device = box('.samsung-workspace__device');
          const stage = box('[data-samsung-stage]');
          const overview = document.querySelector('[aria-label="SmartThings Pro Mobile overview"]');
          const hero = document.querySelector('[data-samsung-story]');
          return {
            centerErrors: [copy, device].map(b => b.x + b.width / 2 - innerWidth / 2),
            gap: device.top - copy.bottom,
            topGap: copy.top - stage.top, bottomGap: stage.bottom - device.bottom,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            overviewAfterHero: hero.nextElementSibling === overview && overview.nextElementSibling === r,
            overviewText: overview.textContent.replace(/\s+/g, ' ').trim(),
          };
        });
        results.push({ viewport, progress, ...geometry });
        assert(geometry.centerErrors.every(e => Math.abs(e) <= 2), 'copy and device are horizontally centered');
        assert(Math.abs(geometry.gap - (mobile ? 12 : 16)) <= 2, 'actual copy-to-device gap remains compact');
        assert(Math.abs(geometry.topGap - geometry.bottomGap) <= 2, 'actual content has balanced vertical margins');
        assert(!geometry.overflow, 'page has no horizontal overflow');
        assert(geometry.overviewAfterHero, 'overview follows hero and precedes workspace');
        assert(geometry.overviewText.startsWith('Connected devices and visitor workflows, together in one workspace. Samsung’s SmartThings Pro Mobile connects'), 'overview retains connected-devices copy and Samsung attribution');
      }
      await page.screenshot({ path: path.join(out, `workspace-${viewport.width}.png`) });
      await page.close();
    }
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
  console.log(`PASS: ${results.length} layout states across four viewports`);
})().catch(error => { console.error(error); process.exitCode = 1; });
