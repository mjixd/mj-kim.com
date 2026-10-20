// Independent user contract: four workflow demonstrations, motion preferences, lifecycle.
// Hooks identify rendered parts only; no implementation phase/state is an oracle.
const fs = require('fs');
const path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'meta-workflow-motion');
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({name, pass:!!pass, actual});
async function snapshot(page) {
  return page.locator('.solution-visual').evaluate(root => {
    const parts = {};
    for (const node of root.querySelectorAll('[data-workflow-part]')) {
      const style = getComputedStyle(node), r = node.getBoundingClientRect();
      let visible = r.width > 0 && r.height > 0;
      for(let n=node;n && n!==root.parentElement;n=n.parentElement) {
        const s=getComputedStyle(n);
        visible &&= !n.hidden && s.display!=='none' && s.visibility!=='hidden' && +s.opacity > .05;
      }
      if (visible) parts[node.dataset.workflowPart] = {
        x:Math.round(r.x), y:Math.round(r.y), height:Math.round(r.height),
        opacity:+style.opacity, transform:style.transform, background:style.backgroundImage,
        text:node.textContent.trim(), scroll:node.scrollTop
      };
    }
    return parts;
  });
}
async function select(page,i) {
  const control=page.locator('.solution-toggle').nth(i);
  await control.scrollIntoViewIfNeeded();
  if(await control.getAttribute('aria-expanded')!=='true') await control.click();
  await page.waitForTimeout(500);
}
async function capture(page, duration=12000) {
  const frames=[];
  for(let t=0;t<duration;t+=150) { frames.push(await snapshot(page)); await page.waitForTimeout(150); }
  return frames;
}
const changes=(frames,key,property)=>new Set(frames.filter(f=>f[key]).map(f=>JSON.stringify(f[key][property]))).size>1;
const ordered=(frames,a,b)=>frames.some((f,i)=>a(f)&&frames.slice(i+1).some(b));
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'#/work/meta'); await page.locator('.solution-accordion').waitFor();
  for(let i=0;i<4;i++) {
    await select(page,i);
    const f=await capture(page);
    fs.writeFileSync(path.join(out,`scene-${i}.json`),JSON.stringify(f));
    await page.screenshot({path:path.join(out,`scene-${i}.png`)});
    if(i===0) check('Upcoming pale gradient visibly changes',f.some(s=>s.highlight?.background.includes('gradient')) && (changes(f,'highlight','opacity')||changes(f,'highlight','transform')),f.filter(s=>s.highlight).length);
    if(i===1) check('Details demonstration raises a bottom sheet',changes(f,'sheet','y') && f.some(s=>s.sheet),f.filter(s=>s.sheet).map(s=>s.sheet.y));
    if(i===2) {
      check('Input demonstration expands sheet',changes(f,'sheet','height')||changes(f,'sheet','y'));
      check('Quick editor presents cursor and progressive typing',f.some(s=>s.cursor) && ordered(f,s=>!!s.typing,s=>!!s.typing) && changes(f,'typing','text'),f.filter(s=>s.typing).map(s=>s.typing.text));
    }
    if(i===3) {
      check('Notes content scrolls vertically',changes(f,'notes','y')||changes(f,'notes','scroll')||changes(f,'notes','transform'));
      check('All 38 dropdown opens then selects Career Conversation',ordered(f,s=>s['filter-label']?.text.includes('All')&&!!s['filter-menu'],s=>s['filter-label']?.text.includes('Career Conversation')&&!s['filter-menu']));
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  for(let i=0;i<4;i++) {
    await select(page,i); const f=await capture(page,1800);
    check(`reduced motion scene ${i} has no automatic movement`,f.length>1 && f.every(s=>JSON.stringify(s)===JSON.stringify(f[0])));
    if(i===2) {
      // Reduced motion renders the expanded endpoint deterministically. Source design
      // keeps the sheet 23px below the screen top at the native 360px width.
      const geometry=await page.locator('.solution-scene[data-scene="2"]').evaluate(scene=>{
        const screen=scene.querySelector('.mw-screen').getBoundingClientRect();
        const sheet=scene.querySelector('[data-workflow-part="sheet"]').getBoundingClientRect();
        return {top:(sheet.top-screen.top)*360/screen.width,
          contained:sheet.top>=screen.top-.5&&sheet.bottom<=screen.bottom+.5&&sheet.left>=screen.left-.5&&sheet.right<=screen.right+.5};
      });
      check('fully expanded editor sheet stays inside screen with original top inset',geometry.contained && Math.abs(geometry.top-23)<1,geometry);
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'}); await select(page,2);
  await page.evaluate(()=>scrollTo(0,0)); await page.waitForTimeout(600);
  let f=await capture(page,1800);
  check('offscreen workflow remains suspended',f.every(s=>JSON.stringify(s)===JSON.stringify(f[0])));
  await select(page,2);
  // Exercise the browser lifecycle event deterministically; not an OS background-tab claim.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(600); f=await capture(page,1800);
  check('hidden document lifecycle suspends workflow',f.every(s=>JSON.stringify(s)===JSON.stringify(f[0])));
  await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  for(let i=0;i<2;i++) {
    await page.evaluate(()=>location.hash='#/work/domino-mvp'); await page.locator('.solution-accordion').waitFor({state:'detached'});
    await page.waitForTimeout(300);
    await page.evaluate(()=>location.hash='#/work/meta'); await page.locator('.solution-accordion').waitFor();
    await select(page,0); f=await capture(page,1800);
    check(`route reentry ${i} resumes visible workflow`,changes(f,'highlight','opacity')||changes(f,'highlight','transform'));
  }
  await page.setViewportSize({width:390,height:844});
  for(let i=0;i<4;i++) {
    await select(page,i);
    check(`mobile tap ${i} selects scene`,await page.locator('.solution-toggle').nth(i).getAttribute('aria-expanded')==='true');
    await page.locator('.solution-toggle').nth(i).click();
    check(`mobile repeat tap ${i} collapses`,await page.locator('.solution-toggle').nth(i).getAttribute('aria-expanded')==='false');
  }
  check('route changes and preference changes produce no errors',errors.length===0,errors);
  const result={checks,failures:checks.filter(c=>!c.pass)};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
  if(result.failures.length) process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
