// Independent user-visible carousel contract. Product helpers are deliberately not imported.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'domino-carousel-tests');
const root = path.resolve(__dirname, '../..');
const checks = [];
const recordings = [];
const check = (name, pass, actual) => checks.push({ name, pass: Boolean(pass), actual });
const carousel = '[data-carousel="domino-mvp"]';
const sourceIs = (url, n) => decodeURIComponent(url).includes(`EN · ${21 + n}.png`);
async function snapshot(page) {
  return page.evaluate(selector => {
    const root = document.querySelector(selector), frame = root?.querySelector('.kv');
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    return { count: root.querySelector('.carousel-count').textContent.trim(), box: { width: rect.width, height: rect.height },
      images: [...frame.querySelectorAll('img')].map(img => {
        let opacity = 1;
        for (let e = img; e && e !== frame.parentElement; e = e.parentElement) {
          const style = getComputedStyle(e);
          opacity *= style.display === 'none' || style.visibility === 'hidden' ? 0 : Number(style.opacity);
        }
        return { src: img.currentSrc || img.src, loaded: img.complete && img.naturalWidth > 0, opacity };
      }), animations: frame.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length };
  }, carousel);
}
async function sample(page, duration = 650) {
  return page.evaluate(async ({ selector, duration }) => {
    const samples = [], start = performance.now();
    while (performance.now() - start < duration) {
      const frame = document.querySelector(selector)?.querySelector('.kv');
      if (!frame) break;
      const images = [...frame.querySelectorAll('img')].map(img => {
        let opacity = 1;
        for (let e = img; e && e !== frame.parentElement; e = e.parentElement) {
          const s = getComputedStyle(e);
          opacity *= s.display === 'none' || s.visibility === 'hidden' ? 0 : Number(s.opacity);
        }
        return { loaded: img.complete && img.naturalWidth > 0, opacity };
      });
      const r = frame.getBoundingClientRect();
      samples.push({ coverage: images.reduce((sum, img) => sum + (img.loaded ? img.opacity : 0), 0), intermediate: images.some(img => img.loaded && img.opacity > .02 && img.opacity < .98), width: r.width, height: r.height });
      await new Promise(requestAnimationFrame);
    }
    return samples;
  }, { selector: carousel, duration });
}
async function countIs(page, n, timeout = 2500) {
  return page.waitForFunction(({selector, n}) => document.querySelector(`${selector} .carousel-count`)?.textContent.trim() === `${n} / 4`, {selector:carousel, n}, {timeout}).then(() => true, () => false);
}
async function setup(browser, { reduced = false, block = null, delayDecode = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference', recordVideo: { dir: out, size: { width: 960, height: 666 } } });
  const page = await context.newPage();
  recordings.push(await page.video().path());
  if (delayDecode) await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    const gate = new Promise(resolve => { window.releaseImageDecode = resolve; });
    HTMLImageElement.prototype.decode = async function () {
      await decode.call(this);
      if (decodeURIComponent(this.currentSrc || this.src).includes('EN · 23.png')) await gate;
    };
  });
  if (block) await page.route(url => sourceIs(url.toString(), 2), block);
  await page.goto(base + '#/work/domino-mvp', { waitUntil: 'domcontentloaded' });
  await page.locator(carousel + ' .kv').evaluate(el => el.scrollIntoView({ block:'center', behavior:'instant' }));
  await page.waitForFunction(selector => [...document.querySelectorAll(`${selector} .kv img`)].some(img => img.complete && img.naturalWidth > 0), carousel);
  const pause = page.locator(carousel + ' [data-carousel-pause]');
  if (await pause.getAttribute('aria-label') === 'Pause slideshow') await pause.click();
  return { context, page };
}
async function run(browser) {
  // Delayed network is a deterministic version of a cold-cache/slow-device advance.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const delayed = await setup(browser, { block: async route => { await gate; await route.continue().catch(() => {}); } });
  const before = await snapshot(delayed.page);
  await delayed.page.locator(carousel + ' [data-carousel-next]').click();
  const waiting = await sample(delayed.page, 350);
  const held = await snapshot(delayed.page);
  check('cold image keeps current slide painted and count unchanged', held.count === '1 / 4' && held.images.some(img => sourceIs(img.src, 1) && img.loaded && img.opacity > .98) && waiting.every(s => s.coverage >= .98), { before, held, minimumCoverage: Math.min(...waiting.map(s => s.coverage)) });
  release();
  const samples = await sample(delayed.page, 900);
  const settled = await countIs(delayed.page, 2);
  check('decoded advance crossfades without blank frames or layout shift', settled && samples.some(s => s.intermediate) && samples.every(s => s.coverage >= .98 && Math.abs(s.width - before.box.width) < .5 && Math.abs(s.height - before.box.height) < .5), { settled, frames:samples.length, intermediateFrames:samples.filter(s=>s.intermediate).length, minimumCoverage:Math.min(...samples.map(s=>s.coverage)) });
  await delayed.context.close();
  if (process.env.FOCUSED_ONLY) return;

  const normal = await setup(browser);
  for (const [button, expected] of [['prev',4], ['next',1], ['next',2], ['prev',1]]) {
    await normal.page.locator(`${carousel} [data-carousel-${button}]`).click();
    const passed = await countIs(normal.page, expected);
    await normal.page.waitForTimeout(550);
    const state = await snapshot(normal.page);
    check(`${button} reaches ${expected} with matching visible image`, passed && state.images.some(img => sourceIs(img.src, expected) && img.loaded && img.opacity > .98), state);
  }
  await normal.page.locator(carousel).evaluate(el => { el.querySelector('[data-carousel-next]').click(); el.querySelector('[data-carousel-next]').click(); el.querySelector('[data-carousel-prev]').click(); });
  await normal.page.waitForTimeout(1100);
  const rapid = await snapshot(normal.page);
  check('rapid next-next-prev preserves final navigation intent', rapid.count === '2 / 4' && rapid.images.some(img=>sourceIs(img.src,2) && img.loaded && img.opacity>.98), rapid);
  await normal.page.waitForTimeout(3300);
  check('pause stops automatic advancement', (await snapshot(normal.page)).count === '2 / 4');
  await normal.page.locator(carousel + ' [data-carousel-pause]').click();
  check('visible playing carousel advances automatically', await countIs(normal.page,3,4500));
  await normal.page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await normal.page.waitForTimeout(550);
  const offscreenBefore = await snapshot(normal.page);
  await normal.page.waitForTimeout(3400);
  check('offscreen carousel pauses', (await snapshot(normal.page)).count === offscreenBefore.count);
  await normal.page.locator(carousel + ' .kv').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  check('returning onscreen resumes autoplay', await countIs(normal.page,4,4500));
  await normal.page.evaluate(selector=>{ window.retainedCarousel=document.querySelector(selector); location.hash='#/'; },carousel);
  await normal.page.waitForTimeout(600);
  const oldCount=await normal.page.evaluate(()=>window.retainedCarousel.querySelector('.carousel-count').textContent);
  await normal.page.waitForTimeout(3400);
  check('route cleanup stops detached carousel updates', await normal.page.evaluate(previous=>!window.retainedCarousel.isConnected && window.retainedCarousel.querySelector('.carousel-count').textContent===previous,oldCount));
  await normal.context.close();

  let releaseReduced;
  const reducedGate = new Promise(resolve=>{releaseReduced=resolve;});
  const reduced = await setup(browser,{reduced:true,block:async route=>{await reducedGate;await route.continue().catch(()=>{});}});
  await reduced.page.locator(carousel+' [data-carousel-next]').click();
  await reduced.page.waitForTimeout(200);
  const reducedHeld=await snapshot(reduced.page);
  check('reduced motion retains decoded current image while waiting',reducedHeld.count==='1 / 4' && reducedHeld.images.some(img=>sourceIs(img.src,1)&&img.loaded&&img.opacity>.98),reducedHeld);
  releaseReduced();
  const reducedSamples=await sample(reduced.page,700);
  check('reduced motion swaps without animated intermediate frames',await countIs(reduced.page,2) && reducedSamples.every(s=>!s.intermediate&&s.coverage>=.98),{intermediateFrames:reducedSamples.filter(s=>s.intermediate).length});
  await reduced.context.close();

  const decoding = await setup(browser,{delayDecode:true});
  await decoding.page.locator(carousel+' [data-carousel-next]').click();
  await decoding.page.waitForTimeout(250);
  const decodingHeld=await snapshot(decoding.page);
  check('downloaded incoming image waits for decode before replacing current',decodingHeld.count==='1 / 4' && decodingHeld.images.some(img=>sourceIs(img.src,1)&&img.loaded&&img.opacity>.98),decodingHeld);
  await decoding.page.evaluate(()=>window.releaseImageDecode());
  check('decode completion releases pending advance',await countIs(decoding.page,2));
  await decoding.context.close();

  const failed = await setup(browser,{block:route=>route.abort('failed')});
  await failed.page.locator(carousel+' [data-carousel-next]').click();
  await failed.page.waitForTimeout(650);
  const failure=await snapshot(failed.page);
  check('failed incoming image leaves current slide intact',failure.count==='1 / 4' && failure.images.some(img=>sourceIs(img.src,1)&&img.loaded&&img.opacity>.98),failure);
  await failed.context.close();

  let releaseDetached;
  const detachedGate=new Promise(resolve=>{releaseDetached=resolve;});
  const detached=await setup(browser,{block:async route=>{await detachedGate;await route.continue().catch(()=>{});}});
  await detached.page.locator(carousel+' [data-carousel-next]').click();
  await detached.page.evaluate(selector=>{window.retainedCarousel=document.querySelector(selector);location.hash='#/';},carousel);
  await detached.page.waitForTimeout(150);
  const detachedHTML=await detached.page.evaluate(()=>window.retainedCarousel.innerHTML);
  releaseDetached();
  await detached.page.waitForTimeout(1000);
  check('pending image completion cannot mutate a detached carousel',await detached.page.evaluate(before=>!window.retainedCarousel.isConnected && window.retainedCarousel.innerHTML===before,detachedHTML));
  await detached.context.close();
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const engine=browserName==='webkit'?webkit:chromium;
  const executable=process.env.CHROMIUM_EXECUTABLE || process.env.BROWSER_EXECUTABLE;
  const browser=await engine.launch({headless:true,...(browserName==='chromium' && executable?{executablePath:executable}:{})});
  try { await run(browser); } catch(error) { check('test completes',false,error.stack); }
  finally { await browser.close(); }
  const hashes=Object.fromEntries(['index.html','hello-w-play/tests/domino-carousel.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
  const result={browser:browserName,hashes,recordings,checks};
  fs.writeFileSync(path.join(out,`domino-carousel-${browserName}.json`),JSON.stringify(result,null,2));
  for(const c of checks)console.log(`${c.pass?'PASS':'FAIL'} ${c.name}${c.pass?'':': '+JSON.stringify(c.actual)}`);
  process.exitCode=checks.some(c=>!c.pass)?1:0;
})();
