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
  // An image representing the original LINE message must actually enter the
  // keyvisual; canvas-only animation cannot satisfy the message transition.
  const message = page.locator('[data-siri-chip] img');
  const messageImages = await message.evaluateAll(nodes => nodes.filter(n=>/siri-(?:final|variant)|message|review|sent/i.test(n.getAttribute('src')+' '+n.alt)).map(n=>({src:n.getAttribute('src'),alt:n.alt})));
  check('keyvisual includes original LINE message artwork after the waveform',messageImages.length>0,messageImages);
  const chip = page.locator('[data-siri-chip]');
  async function showChip() {
    await page.evaluate(() => scrollTo(0,0)); await pause(page);
    await page.locator('.siri-chip-phone').scrollIntoViewIfNeeded(); await pause(page);
  }
  async function scene() { return chip.evaluate(root => ({
    stage:root.dataset.siriChipStage,
    wave:+getComputedStyle(root.querySelector('[data-siri-chip-wave]')).opacity,
    messages:[...root.querySelectorAll('[data-siri-message]')].map(n=>({state:n.dataset.siriMessage,opacity:+getComputedStyle(n).opacity,transform:n.style.transform})),
  })); }
  await showChip();
  const sequence=[];
  for(let i=0;i<44;i++) {sequence.push(await scene());await page.waitForTimeout(250);}
  check('keyvisual shows visible listening, request, review, and sent scenes in order',
    sequence[0].stage==='listening' && sequence[0].wave>.9 && ['request','review','sent'].every(state=>sequence.some(sample=>sample.stage===state&&sample.messages.some(m=>m.state===state&&m.opacity>.9))) &&
    sequence.findIndex(s=>s.stage==='request')<sequence.findIndex(s=>s.stage==='review') && sequence.findIndex(s=>s.stage==='review')<sequence.findIndex(s=>s.stage==='sent'),sequence);
  check('completed keyvisual loop restarts Siri listening',sequence.slice(38).some(s=>s.stage==='listening'),sequence.slice(38));
  await showChip();
  await page.waitForTimeout(4400);
  // Button activation without scroll changes preserves the visible active scene.
  await page.getByRole('button',{name:'Pause Siri demonstration'}).evaluate(button=>button.click()); await pause(page);
  const paused=await scene(); await page.waitForTimeout(700);
  check('pause control freezes message transition',JSON.stringify(paused)===JSON.stringify(await scene()) && await page.getByRole('button',{name:'Play Siri demonstration'}).count()===1,paused);
  await page.getByRole('button',{name:'Play Siri demonstration'}).evaluate(button=>button.click()); await page.waitForTimeout(400);
  check('play control resumes the paused message transition',JSON.stringify(paused)!==JSON.stringify(await scene()));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await pause(page);
  const hidden=await scene();await page.waitForTimeout(700);
  check('hidden document freezes message timeline',JSON.stringify(hidden)===JSON.stringify(await scene()));
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'reduce'});await pause(page);
  const reduced=await scene();await page.waitForTimeout(700);
  check('reduced motion gives static visible sent outcome',reduced.stage==='sent'&&reduced.messages.some(m=>m.state==='sent'&&m.opacity>.8)&&JSON.stringify(reduced)===JSON.stringify(await scene()),reduced);
  check('reduced motion hides inactive pause control',await page.locator('[data-siri-playback]').isHidden());
  await page.reload();await chip.waitFor();await page.locator('.siri-chip-phone').scrollIntoViewIfNeeded();await pause(page);
  const reducedEntry=await scene();await page.waitForTimeout(700);
  check('reduced-motion entry preserves static sent outcome',reducedEntry.stage==='sent'&&JSON.stringify(reducedEntry)===JSON.stringify(await scene()),reducedEntry);
  await page.emulateMedia({reducedMotion:'no-preference'});await showChip();
  check('scroll reentry restarts listening scene',(await scene()).stage==='listening');
  for(const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900}); await page.locator('[data-siri-chip]').scrollIntoViewIfNeeded(); await pause(page);
    check(width+': detail has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
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
