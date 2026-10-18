// Independent behavior contract: archived Apple hardware/background, original LINE
// scope, reversible scroll composition, responsive layout, and motion preferences.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'siri-story-tests');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hardwareHash = '56d9a31c698f5cad896d6a617cfa6b39c454bcafe5c26b75c53d75e1c1e948fe';
const roomHash = '2f53cd87bb70194f8d6bccc92765c99ef427ae98534254819d1746303a53e696';
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const settle = page => page.waitForTimeout(200);
async function enter(page) {
  await page.goto(base + '#/work/line');
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
}
async function assetUrls(locator) {
  return locator.evaluate(root => [...new Set([root, ...root.querySelectorAll('*')].flatMap(node => {
    const urls = [...getComputedStyle(node).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]);
    if (node.tagName === 'IMG') urls.push(node.currentSrc || node.src);
    return urls;
  }))]);
}
async function assetChecks(page, locator, expectedHash, label) {
  const urls = await assetUrls(locator), assets = [];
  for (const url of urls) {
    const response = await page.request.get(url);
    assets.push({ url, status: response.status(), hash: response.ok() ? hash(await response.body()) : null });
  }
  check(label + ' preserves the exact archived image locally', assets.some(asset => asset.hash === expectedHash && new URL(asset.url).origin === new URL(base).origin), assets);
}
async function snapshot(page) {
  return page.locator('[data-siri-hero]').evaluate(root => ({
    y: scrollY,
    transforms: [...root.querySelectorAll('.siri-device')].map(node => getComputedStyle(node).transform),
    opacity: [...root.querySelectorAll('.siri-device')].map(node => +getComputedStyle(node).opacity),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
}
async function sweep(page) {
  const bounds = await page.locator('[data-siri-hero]').evaluate(root => ({ top: root.getBoundingClientRect().top + scrollY, height: root.offsetHeight, vh: innerHeight }));
  const samples = [];
  for (let i = 0; i <= 6; i++) {
    const y = Math.max(0, bounds.top - bounds.vh * .35 + i / 6 * Math.max(bounds.height - bounds.vh * .15, bounds.vh));
    await page.evaluate(y => scrollTo(0, y), y);
    await settle(page);
    samples.push(await snapshot(page));
  }
  return samples;
}
function hasMotion(samples) {
  return samples[0].transforms.some((_, i) => new Set(samples.map(sample => sample.transforms[i])).size > 1);
}
async function layoutChecks(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await settle(page);
  const geometry = await page.locator('[data-siri-hero]').evaluate(root => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; };
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, devices: [...root.querySelectorAll('.siri-device')].map(rect) };
  });
  check(width + ': montage renders without horizontal page overflow', geometry.documentWidth <= width + 1 && geometry.devices.every(device => device.width > 50 && device.height > 100), geometry);
  const voice = page.locator('[data-siri-voice]');
  await voice.scrollIntoViewIfNeeded();
  const copy = await voice.evaluate(root => [...root.querySelectorAll('h1,h2,h3,p')].filter(node => node.textContent.trim()).map(node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return { text: node.textContent, supporting: node.matches('.siri-source,.siri-voice-caption'), left: rect.left, right: rect.right, width: rect.width, height: rect.height, size: parseFloat(style.fontSize), visible: style.visibility !== 'hidden' && style.display !== 'none' && +style.opacity > .9 };
  }));
  check(width + ': voice copy is readable DOM text inside viewport', copy.length >= 2 && copy.every(item => item.visible && item.left >= -1 && item.right <= width + 1 && item.width > 0 && item.height > 0 && item.size >= (item.supporting ? 11 : 14)), copy);
  await voice.evaluate(root => scrollTo(0, root.getBoundingClientRect().top + scrollY)); await settle(page);
  await page.screenshot({ path: path.join(out, 'voice-' + width + '.png') });
  await page.locator('[data-siri-hero]').evaluate(root => scrollTo(0, root.getBoundingClientRect().top + scrollY)); await settle(page);
  await page.screenshot({ path: path.join(out, 'hero-' + width + '.png') });
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await enter(page);
  const hero = page.locator('[data-siri-hero]'), voice = page.locator('[data-siri-voice]');
  const heroCount = await hero.count(), voiceCount = await voice.count();
  check('LINE detail exposes the device montage', heroCount === 1, heroCount);
  check('LINE detail exposes the Siri voice background story', voiceCount === 1, voiceCount);
  // Missing sections are observable behavior failures on the running old page.
  // Stop dependent checks cleanly so RED is not a missing-symbol exception.
  if (heroCount === 1 && voiceCount === 1) {
    check('montage has request, review, and sent devices', await hero.locator('.siri-device').count() >= 3, await hero.locator('.siri-device').count());
    await assetChecks(page, hero, hardwareHash, 'Hero');
    const heroAssets = await assetUrls(hero);
    const expectedScreens = ['request','review','sent'].map(state => 'assets/line/siri-final-' + state + '.png');
    check('hero uses all three supplied final LINE screens locally', expectedScreens.every(file => heroAssets.some(url => new URL(url).origin === new URL(base).origin && new URL(url).pathname.endsWith('/' + file))), heroAssets);
    await assetChecks(page, voice, roomHash, 'Voice background');
    const screens = await hero.locator('.siri-device').evaluateAll(devices => devices.map(device => ({
      text: device.textContent,
      labels: [device, ...device.querySelectorAll('[aria-label],img')].map(node => node.getAttribute('aria-label') || node.alt || '').join(' '),
    })));
    const screenEvidence = screens.map(screen => screen.text + ' ' + screen.labels).join(' ');
    check('montage presents request, review, and sent messaging states', /request|send a LINE|send.*message/i.test(screenEvidence) && /review|confirm|cancel/i.test(screenEvidence) && /sent/i.test(screenEvidence), screens);
    const heroCopy = await hero.innerText(), voiceCopy = await voice.innerText(), mainCopy = await page.locator('main').innerText();
    check('hero has no temporary reconstruction claims', !/reconstruct|provisional|pending original/i.test(heroCopy), heroCopy);
    check('voice copy describes LINE messaging without inherited HomeKit claims', /LINE/.test(voiceCopy) && /message|messaging|send|recipient/i.test(voiceCopy) && !/HomeKit|on\/off switch|turn (?:on|off).*light|unlock.*door/i.test(voiceCopy), voiceCopy);
    check('Siri career facts remain without AI Speaker work', /2016/.test(mainCopy) && /private.*lab/i.test(mainCopy) && !/AI Speaker|CLOVA|2017|(?:5|five)[\s-]*months?/i.test(mainCopy), mainCopy);
    const requests = await page.locator('a[href^="mailto:"]').evaluateAll(links => links.map(link => link.textContent + ' ' + link.getAttribute('aria-label')));
    check('full case request remains available', requests.some(label => /request|full/i.test(label)), requests);
    const images = await hero.locator('img').evaluateAll(async images => Promise.all(images.map(async image => { try { await image.decode(); } catch {} return { src: image.src, width: image.naturalWidth, height: image.naturalHeight }; })));
    check('all montage images decode', images.length > 0 && images.every(image => image.width > 0 && image.height > 0), images);
    const forward = await sweep(page);
    check('real scroll changes device composition', hasMotion(forward), forward);
    check('layers use different scroll movement', forward.some(sample => new Set(sample.transforms).size > 1) && forward[0].transforms.filter((_, i) => new Set(forward.map(sample => sample.transforms[i])).size > 1).length >= 2, forward);
    const target = forward[2];
    await page.evaluate(y => scrollTo(0, y), target.y); await settle(page);
    check('reverse scroll restores the same composition', JSON.stringify((await snapshot(page)).transforms) === JSON.stringify(target.transforms), { expected: target, actual: await snapshot(page) });
    await layoutChecks(page, 390);
    await layoutChecks(page, 320);
    await layoutChecks(page, 1440);
    check('desktop motion survives mobile resize', hasMotion(await sweep(page)));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await settle(page);
    const reduced = await sweep(page);
    check('live reduced-motion change makes scroll composition static', !hasMotion(reduced), reduced);
    await enter(page);
    check('reduced-motion entry is static', !hasMotion(await sweep(page)));
    await layoutChecks(page, 390);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(page);
    check('motion returns after preference change', hasMotion(await sweep(page)));
    for (let cycle = 0; cycle < 2; cycle++) {
      await hero.evaluate(root => { window.__siriTestDetached = [...root.querySelectorAll('.siri-device')]; });
      await page.evaluate(() => location.hash = '#/about');
      await hero.waitFor({ state: 'detached' });
      await settle(page);
      const detachedBefore = await page.evaluate(() => window.__siriTestDetached.map(node => node.getAttribute('style')));
      await page.evaluate(() => scrollTo(0, 500));
      await page.setViewportSize({ width: cycle ? 1440 : 1280, height: 900 });
      await settle(page);
      const detachedAfter = await page.evaluate(() => window.__siriTestDetached.map(node => node.getAttribute('style')));
      check('route exit ' + cycle + ' stops detached device updates', JSON.stringify(detachedBefore) === JSON.stringify(detachedAfter), { before: detachedBefore, after: detachedAfter });
      await page.evaluate(() => delete window.__siriTestDetached);
      await page.evaluate(() => location.hash = '#/work/line');
      await hero.waitFor(); await settle(page);
      check('route reentry ' + cycle + ' restores one working montage', await hero.count() === 1 && hasMotion(await sweep(page)));
    }
  }
  check('scroll, resize, preference changes, and navigation produce no browser errors', errors.length === 0, errors);
  await browser.close();
  const sources = ['index.html', 'siri-story.js', 'siri-story.css'].map(file => {
    const location = path.resolve(__dirname, '../..', file);
    return { file, hash: fs.existsSync(location) ? hash(fs.readFileSync(location)) : null };
  });
  const result = { testHash: hash(fs.readFileSync(__filename)), sources, checks, failures: checks.filter(check => !check.pass) };
  fs.writeFileSync(path.join(out, 'siri-story-results.json'), JSON.stringify(result, null, 2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`, result.failures.map(check => check.name));
  if (result.failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exit(1); });
