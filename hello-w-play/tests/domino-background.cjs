// Independent browser contract for the Background redesign. No product helpers imported.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'domino-background-tests');
const root = path.resolve(__dirname, '../..');
const selectors = { section: '[data-domino-background]', video: '[data-domino-background-video]', copy: '[data-domino-background-copy]' };
const checks = [];
const check = (name, pass, actual) => checks.push({name, pass: Boolean(pass), actual});
const hashes = Object.fromEntries(['index.html', 'domino-zoom.js', 'domino-zoom.css', 'domino-background.js', 'domino-background.css', 'assets/domino/background/landscape-2074.png', 'assets/domino/background/chart-mobile.mp4', 'assets/videos/domino-chart.mp4', 'hello-w-play/tests/domino-background.cjs'].filter(file => fs.existsSync(path.join(root,file))).map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
async function state(page, retained = false) {
  return page.evaluate(({selector,retained}) => {
    const v = retained ? window.retainedBackgroundVideo : document.querySelector(selector);
    return v && {connected:v.isConnected, paused:v.paused, time:v.currentTime, src:v.getAttribute('src'), ready:v.readyState, network:v.networkState, error:v.error?.code, width:v.videoWidth, height:v.videoHeight};
  }, {selector:selectors.video,retained});
}
async function stopped(page, name, {unloaded=false,retained=false}={}) {
  await page.waitForTimeout(250);
  const before = await state(page,retained);
  await page.waitForTimeout(250);
  const after = await state(page,retained);
  check(name, !!after && after.paused && Math.abs(before.time-after.time)<.04 && (!unloaded || !after.src && after.ready===0 && after.network===0), {before,after});
}
async function moving(page,name) {
  const before=await state(page);
  const moved=await page.waitForFunction(({selector,time}) => {
    const v=document.querySelector(selector);
    let opacity=1;
    for(let e=v;e && e!==document.body;e=e.parentElement)opacity*=Number(getComputedStyle(e).opacity);
    const rect=v?.getBoundingClientRect();
    return v && opacity>.9 && rect.width>0 && rect.height>0 && rect.top<innerHeight && rect.bottom>0 && !v.paused && v.readyState>=2 && v.videoWidth>0 && !v.error && Math.abs(v.currentTime-time)>.08;
  }, {selector:selectors.video,time:before.time}, {timeout:10000}).then(()=>true,()=>false);
  check(name,moved,{before,after:await state(page)});
}
async function reveal(page) {
  await page.locator(selectors.video).evaluate(v => v.scrollIntoView({block:'center',behavior:'instant'}));
  await page.waitForTimeout(250);
}
async function layout(page,width) {
  const result=await page.evaluate(s=>{
    const section=document.querySelector(s.section), video=document.querySelector(s.video), copy=document.querySelector(s.copy);
    const heading=[...section.querySelectorAll('h2,h3')].find(h=>h.textContent.trim()==='Background');
    const columns=copy ? [...copy.children] : [];
    const wrap=section.querySelector('.wrap');
    const reference=document.querySelector('.c-hero.wrap');
    const rect=e=>e?.getBoundingClientRect().toJSON();
    return {paddingTop:parseFloat(getComputedStyle(section).paddingTop), heading:heading?.textContent, followsZoom:section.previousElementSibling?.hasAttribute('data-domino-zoom'),
      obsolete:[...section.querySelectorAll('img')].some(i=>decodeURIComponent(new URL(i.src).pathname).endsWith('/EN · 19.png')),
      videoCount:section.querySelectorAll(s.video).length, ordered:!!copy && !!(video.compareDocumentPosition(copy)&Node.DOCUMENT_POSITION_FOLLOWING),
      headings:columns.map(c=>c.querySelector('h2,h3,h4')?.textContent.trim()), paragraphs:columns.map(c=>c.textContent.trim()), columns:columns.map(rect),
      copy:rect(copy), wrap:rect(wrap), reference:rect(reference), overflow:document.documentElement.scrollWidth>innerWidth+1,
      safeMedia:video.muted && video.playsInline && video.loop, poster:video.poster,
      title:document.querySelector('.c-hero h1')?.textContent, role:document.querySelector('.c-hero .role')?.textContent};
  },selectors);
  const expectedPadding=Math.min(112,Math.max(56,width*.08))+100;
  check(`${width}px: Background adds exactly 100px above its existing band padding`,Math.abs(result.paddingTop-expectedPadding)<1,result.paddingTop);
  check(`${width}px: Background follows zoom and replaces the old EN19 slide with one safe video before copy`,result.followsZoom && result.heading==='Background' && !result.obsolete && result.videoCount===1 && result.ordered && result.safeMedia,result);
  check(`${width}px: Motivation and MVP have substantial editable text`,result.headings.length===2 && /motivation/i.test(result.headings[0]) && /MVP/i.test(result.headings[1]) && result.paragraphs.every(t=>t.length>100),result.headings);
  check(`${width}px: copy forms ${width>820?'two columns':'a readable stack'}`,result.columns.length===2 && (width>820 ? Math.abs(result.columns[0].top-result.columns[1].top)<2 && result.columns[1].left>result.columns[0].right : result.columns[1].top>=result.columns[0].bottom),result.columns);
  check(`${width}px: page margins remain aligned and no horizontal overflow`,!!result.wrap && Math.abs(result.wrap.left-result.reference.left)<1 && Math.abs(result.wrap.right-result.reference.right)<1 && !result.overflow && result.copy.left>=result.wrap.left-1 && result.copy.right<=result.wrap.right+1,result);
  check(`${width}px: existing career title and role are unchanged`,result.title==='0→1 product and business strategy' && result.role==='Role · Founding member, product strategy, design and team lead, high-level decisions with the CEO · 2022 – 2024',result);
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await playwright[browserName].launch({headless:true,...(browserName==='chromium' && process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const errors=[];
  const newPage=async (options,initScript)=>{
    const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'no-preference',...options});
    page.on('pageerror',error=>errors.push(error.message));
    if(initScript)await page.addInitScript(initScript);
    await page.goto(base+'#/work/domino-mvp');
    await page.locator('.pager').waitFor();
    return page;
  };
  try {
    const page=await newPage();
    const exists=await page.locator(selectors.section).count()===1;
    check('Background exposes the redesigned section',exists);
    if(!exists)return;
    await layout(page,1440);
    await stopped(page,'Opening leaves offscreen Background video unloaded',{unloaded:true});
    await reveal(page);
    await moving(page,'In-view video decodes and actually advances');
    await page.screenshot({path:path.join(out,`background-desktop-${browserName}.png`)});
    const button=page.locator(selectors.section).getByRole('button');
    check('Playback has one visible accessible pause control',await button.count()===1 && await button.isVisible() && /pause/i.test(await button.getAttribute('aria-label')||await button.innerText()));
    await button.click();
    await stopped(page,'Manual pause stops playback');
    await page.locator('.pager').scrollIntoViewIfNeeded();
    await stopped(page,'Offscreen manually-paused video releases decoder state',{unloaded:true});
    await reveal(page);
    await stopped(page,'Manual pause persists after leaving and reentering');
    await button.focus(); await page.keyboard.press('Enter');
    await moving(page,'Keyboard play resumes video');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    await stopped(page,'Hidden document unloads decoder state',{unloaded:true});
    await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
    await moving(page,'Visible document resumes eligible video');
    await page.locator('.pager').scrollIntoViewIfNeeded();
    await stopped(page,'Leaving Background unloads decoder state',{unloaded:true});
    await reveal(page); await moving(page,'Reentering Background restarts real playback');
    await page.evaluate(s=>{window.retainedBackgroundVideo=document.querySelector(s);location.hash='#/about';},selectors.video);
    await page.waitForFunction(s=>!document.querySelector(s),selectors.section);
    await stopped(page,'Route disposal unloads retained video',{unloaded:true,retained:true});
    await page.evaluate(()=>location.hash='#/work/domino-mvp');
    await page.locator(selectors.section).waitFor();
    await reveal(page); await moving(page,'Route reentry creates working playback');
    await stopped(page,'Old route video remains unloaded after reentry',{unloaded:true,retained:true});
    await page.close();
    for(const width of [390,320]) {
      const mobile=await newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
      await layout(mobile,width);
      await reveal(mobile); await moving(mobile,`${width}px: Background video really plays`);
      await mobile.screenshot({path:path.join(out,`background-${width}-${browserName}.png`)});
      await mobile.locator('.pager').scrollIntoViewIfNeeded();
      await stopped(mobile,`${width}px: offscreen media unloads`,{unloaded:true});
      await mobile.close();
    }
    const reduced=await newPage({reducedMotion:'reduce'});
    await reveal(reduced);
    await stopped(reduced,'Reduced motion prevents autoplay');
    const reducedButton=reduced.locator(selectors.section).getByRole('button');
    check('Reduced motion provides a visible play action',await reducedButton.isVisible() && /play/i.test(await reducedButton.getAttribute('aria-label')||await reducedButton.innerText()));
    await reducedButton.click(); await moving(reduced,'Reduced motion permits explicit playback');
    await reducedButton.click(); await stopped(reduced,'Reduced motion manual pause works');
    await reduced.close();
    const denied=await newPage({},()=>{
      const play=HTMLMediaElement.prototype.play;
      window.allowBackgroundPlayback=false;
      HTMLMediaElement.prototype.play=function(){
        return this.matches('[data-domino-background-video]') && !window.allowBackgroundPlayback ? Promise.reject(new DOMException('Autoplay denied by test','NotAllowedError')) : play.call(this);
      };
    });
    await reveal(denied); await stopped(denied,'Autoplay denial leaves media safely paused');
    const retry=denied.locator(selectors.section).getByRole('button');
    check('Autoplay denial offers an accessible retry action',await retry.isVisible() && /play/i.test(await retry.getAttribute('aria-label')||await retry.innerText()));
    await denied.evaluate(()=>window.allowBackgroundPlayback=true);
    await retry.click(); await moving(denied,'User play recovers from autoplay denial');
    await denied.close();
    // Real playback is retained; only first-request settlement is held across
    // unload/reentry to expose a completion belonging to a retired media load.
    const interrupted=await newPage({},()=>{
      const play=HTMLMediaElement.prototype.play, delayed=new WeakSet();
      HTMLMediaElement.prototype.play=function(){
        const request=play.call(this);
        if(!this.matches('[data-domino-background-video]') || delayed.has(this))return request;
        delayed.add(this);
        return new Promise((resolve,reject)=>request.then(()=>window.rejectRetiredBackground=()=>reject(new DOMException('Late autoplay denial','NotAllowedError')),reject));
      };
    });
    await reveal(interrupted);
    await interrupted.waitForFunction(()=>typeof window.rejectRetiredBackground==='function');
    await interrupted.locator('.pager').scrollIntoViewIfNeeded();
    await stopped(interrupted,'Interrupted play request unloads when leaving',{unloaded:true});
    await reveal(interrupted);
    await interrupted.evaluate(()=>window.rejectRetiredBackground());
    await moving(interrupted,'Late failure from retired load cannot stop current playback');
    await interrupted.close();
    check('No uncaught browser errors',errors.length===0,errors);
  } finally {
    await browser.close();
    const result={browser:browserName,hashes,checks,failures:checks.filter(c=>!c.pass)};
    fs.writeFileSync(path.join(out,`domino-background-${browserName}.json`),JSON.stringify(result,null,2));
    console.log(`${checks.length} checks, ${result.failures.length} failures; evidence: ${out}`);
    console.log(result.failures.map(c=>c.name));
    if(result.failures.length)process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
