// Independent contract: EN 44-2 uses its 1920px Figma master aperture and 35px corners.
const fs = require('fs');
const path = require('path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'meta-video-corners');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await (process.env.TEST_BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(url + '#/work/meta');
  const video = page.locator('video[src="assets/videos/meta-1on1-interaction.mp4"]').first();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await video.scrollIntoViewIfNeeded();
    await video.evaluate(v => new Promise(resolve => {
      if (v.readyState >= 2) return resolve();
      v.addEventListener('loadeddata', resolve, { once: true });
    }));
    await page.waitForFunction(() => {
      const v = document.querySelector('video[src="assets/videos/meta-1on1-interaction.mp4"]');
      return v && !v.paused;
    });
    const geometry = await video.evaluate(v => {
      const r = v.getBoundingClientRect(), frame = v.parentElement.getBoundingClientRect();
      const style = getComputedStyle(v);
      const radii = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map(key => {
        const parts = style[key].split(' ');
        const px = (value, dimension) => parseFloat(value) * (value.endsWith('%') ? dimension / 100 : 1);
        return [px(parts[0], r.width), px(parts[1] || parts[0], r.height)];
      });
      return {
        scale: frame.width / 1920,
        x: (r.x - frame.x) / frame.width * 1920,
        y: (r.y - frame.y) / frame.height * 1080,
        width: r.width / frame.width * 1920,
        height: r.height / frame.height * 1080,
        radii, autoplay: v.autoplay, muted: v.muted, loop: v.loop,
        inline: v.playsInline, paused: v.paused, time: v.currentTime,
        objectFit: style.objectFit, videoWidth: v.videoWidth, videoHeight: v.videoHeight,
      };
    });
    check(`${width}: aperture matches source mockup`, Math.abs(geometry.x - 451) < .2 && Math.abs(geometry.y - 78) < .2 && Math.abs(geometry.width - 432) < .2 && Math.abs(geometry.height - 934.3255615) < .2, geometry);
    check(`${width}: all corners scale from 35 source pixels`, geometry.radii.every(pair => pair.every(radius => Math.abs(radius / geometry.scale - 35) < .1)), geometry.radii.map(pair => pair.map(radius => radius / geometry.scale)));
    check(`${width}: inline muted looping playback preserved`, geometry.autoplay && geometry.muted && geometry.loop && geometry.inline && !geometry.paused && geometry.videoWidth > 0, geometry);
    await page.waitForTimeout(150);
    check(`${width}: playback advances`, await video.evaluate(v => v.currentTime) > geometry.time);
    const frame = await video.evaluateHandle(v => v.parentElement);
    await frame.asElement().screenshot({ path: path.join(out, `meta-video-${width}.png`) });
  }
  await browser.close();
  const result = { checks, failures: checks.filter(check => !check.pass) };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(check => check.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
