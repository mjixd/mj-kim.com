// Independent acceptance written before the Siri keyvisual implementation.
// Artistic polish and source-text fidelity remain visual-review oracles.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || '/tmp/siri-keyvisual-tests';
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({name, pass: !!pass, actual});
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pause = page => page.waitForTimeout(250);
async function pixels(canvas) { return canvas.evaluate(c => ({ image: c.toDataURL(), draws: c.__testDraws || 0 })); }
async function movement(page, canvas, label, expected) {
  const before = await pixels(canvas); await page.waitForTimeout(450); const after = await pixels(canvas);
  check(label, expected ? before.image !== after.image && after.draws > before.draws : before.image === after.image && after.draws === before.draws, {changed: before.image !== after.image, draws: after.draws - before.draws});
}
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ['clearRect','fillRect','fill','stroke','drawImage','putImageData']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function(...args) { this.canvas.__testDraws=(this.canvas.__testDraws||0)+1; return original.apply(this,args); };
    }
  });
  await page.goto(base+'#/');
  const card = page.locator('a[href="#/work/line"]').first();
  await card.scrollIntoViewIfNeeded(); await pause(page);
  const canvas = card.locator('canvas');
  check('home Siri card restores exactly one live waveform', await canvas.count() === 1, await canvas.count());
  if (await canvas.count() === 1) {
    await movement(page,canvas,'home Siri waveform changes actual pixels',true);
    await page.emulateMedia({reducedMotion:'reduce'}); await pause(page);
    await movement(page,canvas,'home live reduced motion freezes drawing',false);
    await page.reload(); await card.waitFor(); await card.scrollIntoViewIfNeeded(); await pause(page);
    await movement(page,canvas,'home reduced-motion entry remains static',false);
    await page.emulateMedia({reducedMotion:'no-preference'}); await pause(page);
    await movement(page,canvas,'home motion preference restoration resumes drawing',true);
    await page.evaluate(() => scrollTo(0,0)); await pause(page);
    const outside = await canvas.evaluate(c => {const r=c.getBoundingClientRect();return r.top>=innerHeight||r.bottom<=0;});
    check('home offscreen test actually moves canvas outside viewport',outside);
    if(outside) await movement(page,canvas,'home offscreen waveform stops drawing',false);
    await card.scrollIntoViewIfNeeded(); await pause(page);
    await movement(page,canvas,'home waveform resumes on reentry',true);
    await canvas.evaluate(c => window.__detachedSiriCover=c);
  }
  await card.click(); await page.locator('[data-siri-hero]').waitFor(); await pause(page);
  if (await page.evaluate(() => !!window.__detachedSiriCover)) {
    const before = await page.evaluate(() => window.__detachedSiriCover.__testDraws); await page.waitForTimeout(450);
    check('route exit stops detached home waveform', before === await page.evaluate(() => window.__detachedSiriCover.__testDraws));
  }
  const hero = page.locator('[data-siri-hero]');
  const screens = await hero.locator('.siri-screen img').evaluateAll(nodes => [...new Set(nodes.map(n => n.getAttribute('src')))]);
  check('hero expands beyond the three repeated screen variants',screens.length > 3,screens);
  // The layered keyvisual behavior is owned by siri-composition.cjs.
  for(let cycle=0;cycle<2;cycle++) {
    await page.evaluate(()=>location.hash='#/'); await card.waitFor(); await card.scrollIntoViewIfNeeded(); await pause(page);
    check('home route reentry '+cycle+' creates one live waveform',await canvas.count()===1,await canvas.count());
    if(await canvas.count()===1) await movement(page,canvas,'home route reentry '+cycle+' resumes pixels',true);
    await card.click(); await hero.waitFor(); await pause(page);
  }
  check('browser has no runtime errors',errors.length===0,errors);
  await browser.close();
  const result={testHash:hash(fs.readFileSync(__filename)),checks,failures:checks.filter(c=>!c.pass)};
  fs.writeFileSync(path.join(out,'siri-keyvisual-results.json'),JSON.stringify(result,null,2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`,result.failures.map(c=>c.name));
  if(result.failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1);});
