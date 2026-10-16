// Independent resource regression oracle. Browser survival is recorded separately
// from resource bounds: a desktop engine cannot prove physical iOS memory safety.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browserName = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'domino-mobile-resources');
const root = path.resolve(__dirname, '../..');
function assetFiles(directory) {
  return fs.readdirSync(path.join(root,directory), {withFileTypes:true}).flatMap(entry=>entry.isDirectory() ? assetFiles(path.join(directory,entry.name)) : [path.join(directory,entry.name)]);
}
// Capture before execution so edits during a run cannot relabel its evidence.
const hashes = Object.fromEntries(['index.html','domino-zoom.js','domino-zoom.css','hello-w-play/tests/domino-mobile-resources.cjs',...assetFiles('assets/domino/zoom')].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sectionSelector = '[data-domino-zoom]';
const checks = [];
const check = (name, pass, actual) => checks.push({name, pass: Boolean(pass), actual});
// Twice the physical display resolution allows transition oversampling while
// rejecting artwork sized for the 10,464px authoring canvas on a phone display.
const OVERSAMPLE = 2;
function withinResolution(source, display, dpr) {
  return source.width > 0 && source.height > 0 && source.width <= Math.ceil(display.width * dpr * OVERSAMPLE) + 2 && source.height <= Math.ceil(display.height * dpr * OVERSAMPLE) + 2;
}
async function phase(page, progress) {
  await page.locator(sectionSelector).evaluate(async (section, progress) => {
    scrollTo({top: scrollY + section.getBoundingClientRect().top + Math.max(0, section.offsetHeight - innerHeight) * progress, behavior: 'instant'});
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, progress);
  await page.waitForTimeout(180);
}
async function snapshot(page) {
  return page.locator(sectionSelector).evaluate(section => {
    const rect = element => {const r = element.getBoundingClientRect(); return {width:r.width, height:r.height};};
    const resource = element => ({
      source: element.currentSrc || element.getAttribute('src'),
      intrinsic: {width: element.naturalWidth ?? element.videoWidth, height: element.naturalHeight ?? element.videoHeight},
      display: rect(element),
    });
    return {
      dpr: devicePixelRatio,
      viewport: {width:innerWidth,height:innerHeight},
      surfaces: [...section.querySelectorAll('.domino-zoom__board,[data-domino-phone]')].map(element => ({name:element.dataset.dominoPhone || 'board', layout:{width:element.offsetWidth,height:element.offsetHeight}, display:rect(element)})),
      phones: [...section.querySelectorAll('[data-domino-phone]')].map(phone => ({name:phone.dataset.dominoPhone, center:phone.hasAttribute('data-domino-center'), images:[...phone.querySelectorAll('img')].map(resource), videos:[...phone.querySelectorAll('video')].map(video => ({...resource(video), paused:video.paused,error:video.error?.code || null}))})),
    };
  });
}
async function released(page, retained) {
  return page.evaluate(retained => window[retained].map(video => ({connected:video.isConnected, paused:video.paused, src:video.getAttribute('src'), currentSrc:video.currentSrc, ready:video.readyState, network:video.networkState})), retained);
}
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await playwright[browserName].launch({headless:true, ...(browserName === 'chromium' && process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})});
  const errors = [], crashes = [], observations = [];
  try {
    // Establish that the bound rejects a known oversized source independently of
    // whichever asset names or implementation units production happens to use.
    assert.equal(withinResolution({width:1280,height:2642},{width:125,height:258},3),false);
    assert.equal(withinResolution({width:640,height:1321},{width:125,height:258},3),true);
    for (const width of [390,320]) {
      const page = await browser.newPage({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
      page.on('pageerror',error=>errors.push({width,message:error.message}));
      page.on('crash',()=>crashes.push({width}));
      await page.goto(base+'#/work/domino-mvp');
      await phase(page,0);
      check(`${width}px: hidden composition videos have no active sources at opening`, await page.locator(sectionSelector+' video').evaluateAll(videos=>videos.length===6 && videos.every(video=>!video.getAttribute('src') && video.paused)));
      const opening = await snapshot(page);
      const frames = [opening];
      for (const progress of [.25,.421,.56,.82,1]) { await phase(page,progress); frames.push(await snapshot(page)); }
      await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' video')].every(video=>video.readyState>=2),sectionSelector,{timeout:15000});
      const final = await snapshot(page);
      observations.push({width,opening,final});
      const oversizedSurfaces = final.surfaces.filter(surface=>{
        const appearances=frames.map(frame=>frame.surfaces.find(candidate=>candidate.name===surface.name));
        return surface.layout.width > Math.max(...appearances.map(item=>item.display.width))*OVERSAMPLE+2 || surface.layout.height > Math.max(...appearances.map(item=>item.display.height))*OVERSAMPLE+2;
      });
      check(`${width}px: layout surfaces stay within twice their peak displayed dimensions`,oversizedSurfaces.length===0,oversizedSurfaces);
      const oversizedImages = final.phones.flatMap(phone=>phone.images.map((image,index)=>({name:phone.name,index,...image,display:phone.center ? opening.phones.find(item=>item.center).images[index].display : image.display}))).filter(image=>!withinResolution(image.intrinsic,image.display,final.dpr));
      check(`${width}px: decoded image resolution follows the opening center and revealed composition display budget`,oversizedImages.length===0,oversizedImages);
      const videos = final.phones.flatMap(phone=>phone.videos.map(video=>({name:phone.name,...video})));
      check(`${width}px: six real video decoders fit the revealed physical display budget`,videos.length===6 && videos.every(video=>withinResolution(video.intrinsic,video.display,final.dpr) && !video.paused && !video.error),videos);
      const uniqueImages = [...new Map(final.phones.flatMap(phone=>phone.images).map(image=>[image.source,image])).values()];
      const decodedImageBytes = uniqueImages.reduce((sum,image)=>sum+image.intrinsic.width*image.intrinsic.height*4,0);
      observations.at(-1).decodedImageBytes=decodedImageBytes;
      await page.locator('[data-domino-playback]').click();
      await phase(page,0); await phase(page,.85);
      check(`${width}px: explicit pause survives reverse scroll and reveal`,await page.locator(sectionSelector+' video').evaluateAll(videos=>videos.every(video=>video.paused)));
      await page.locator('[data-domino-playback]').click();
      await page.evaluate(selector=>{window.retainedResourceVideos=[...document.querySelectorAll(selector+' video')];},sectionSelector);
      await page.locator('.pager').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      let inactive=await released(page,'retainedResourceVideos');
      check(`${width}px: leaving the composition releases video decoder state`,inactive.every(video=>video.paused && !video.src && video.ready===0 && video.network===0),inactive);
      await phase(page,.85);
      await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' video')].every(video=>!video.paused && video.readyState>=2),sectionSelector,{timeout:15000});
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
        Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(300);
      inactive=await released(page,'retainedResourceVideos');
      check(`${width}px: hidden-document boundary releases video decoder state`,inactive.every(video=>video.paused && !video.src && video.ready===0 && video.network===0),inactive);
      await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
      for (let visit=0;visit<3;visit++) {
        await phase(page,.85);
        await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' video')].every(video=>!video.paused && video.readyState>=2),sectionSelector,{timeout:15000});
        await page.evaluate(selector=>{window.retainedResourceVideos=[...document.querySelectorAll(selector+' video')];location.hash='#/about';},sectionSelector);
        await page.waitForFunction(selector=>!document.querySelector(selector),sectionSelector);
        await page.waitForTimeout(100);
        const retired=await released(page,'retainedResourceVideos');
        check(`${width}px visit ${visit+1}: route cleanup releases retained media sources and decode state`,retired.length===6 && retired.every(video=>!video.connected && video.paused && !video.src && video.ready===0 && video.network===0),retired);
        await page.evaluate(()=>{location.hash='#/work/domino-mvp';});
        await page.locator(sectionSelector).waitFor();
        await phase(page,0);
        check(`${width}px visit ${visit+1}: fresh route returns to an unloaded opening`,await page.locator(sectionSelector+' video').evaluateAll(videos=>videos.length===6 && videos.every(video=>!video.getAttribute('src') && video.paused)));
      }
      check(`${width}px: route remains usable after repeated scrolling and route changes`,await page.locator('[data-domino-phone]').count()===16);
      await page.close();
    }
    // Keep real playback/decoding, but hold the first play Promise settlement
    // across unload/reentry to exercise a completion from a retired media load.
    for (const settlement of ['resolve','reject']) {
      const interrupted = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
      interrupted.on('pageerror',error=>errors.push({scenario:'interrupted-play',message:error.message}));
      interrupted.on('crash',()=>crashes.push({scenario:'interrupted-play'}));
      await interrupted.addInitScript(settlement=>{
        const play=HTMLMediaElement.prototype.play;
        const delayed=new WeakSet();
        window.retiredPlaySettlements=[];
        HTMLMediaElement.prototype.play=function(){
          const request=play.call(this);
          if(!this.closest('[data-domino-zoom]') || delayed.has(this))return request;
          delayed.add(this);
          return new Promise((resolve,reject)=>request.then(
            ()=>window.retiredPlaySettlements.push(settlement==='resolve' ? resolve : ()=>reject(new DOMException('Retired playback denied','NotAllowedError'))),
            error=>window.retiredPlaySettlements.push(()=>reject(error))
          ));
        };
      },settlement);
      await interrupted.goto(base+'#/work/domino-mvp');
      await phase(interrupted,.85);
      await interrupted.waitForFunction(()=>window.retiredPlaySettlements.length===6);
      await interrupted.locator('.pager').scrollIntoViewIfNeeded();
      await interrupted.waitForTimeout(200);
      await phase(interrupted,.85);
      await interrupted.evaluate(()=>window.retiredPlaySettlements.forEach(settle=>settle()));
      const resumed=await interrupted.waitForFunction(selector=>[...document.querySelectorAll(selector+' video')].every(video=>!video.paused && video.readyState>=2),sectionSelector,{timeout:5000}).then(()=>true,()=>false);
      check(`unload/reentry resumes playback when an earlier play request settles late (${settlement})`,resumed,await interrupted.locator(sectionSelector+' video').evaluateAll(videos=>videos.map(video=>({paused:video.paused,ready:video.readyState,src:video.getAttribute('src')}))));
      await interrupted.close();
    }
    check('browser page crash events are absent (not a physical-device memory guarantee)',crashes.length===0,crashes);
    check('JavaScript errors are absent, tracked independently of resource regressions',errors.length===0,errors);
  } finally {
    await browser.close();
    const result={browser:browserName,physicalIOSVerified:false,hashes,checks,observations,failures:checks.filter(item=>!item.pass)};
    fs.writeFileSync(path.join(out,`domino-mobile-resources-${browserName}.json`),JSON.stringify(result,null,2));
    console.log(`${checks.length} checks, ${result.failures.length} failures; evidence: ${out}`);
    console.log(result.failures.map(failure=>failure.name));
    if(result.failures.length)process.exitCode=1;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
