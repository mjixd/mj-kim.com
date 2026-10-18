// Independent contract: Samsung's mobile story precedes a distinct token-validation
// chapter; the black chapter changes paired image/copy in one place and reverses.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'chromium';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-content-' + engine);
const scene = '[data-samsung-governance]';
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({name, pass: Boolean(pass), actual});
const settle = p => p.waitForTimeout(250);
async function enter(page) {
  await page.goto(base + '#/work/samsung');
  await page.locator('[data-samsung-story]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
}
async function at(page, progress) {
  await page.locator(scene).evaluate((root, p) => scrollTo({top:scrollY + root.getBoundingClientRect().top + Math.max(0,root.offsetHeight-innerHeight)*p, behavior:'instant'}), progress);
  await settle(page);
}
async function snapshot(page) {
  return page.locator(scene).evaluate(root => {
    const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const alpha = el => {let a=1;for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.visibility==='hidden'||s.display==='none')return 0;a*=Number(s.opacity);}return a;};
    const steps=[...root.querySelectorAll('[data-governance-step]')].map(el=>({id:el.dataset.governanceStep,alpha:alpha(el),hidden:el.getAttribute('aria-hidden'),text:el.textContent.replace(/\s+/g,' ').trim(),visual:rect(el.querySelector('.samsung-governance__visual')),copy:rect(el.querySelector('.samsung-governance__copy')),paragraphs:[...el.querySelectorAll('p')].map(p=>({text:p.textContent.trim(),rect:rect(p)})),images:[...el.querySelectorAll('img')].map(img=>({src:decodeURI(img.getAttribute('src')),alt:img.alt,loaded:img.complete&&img.naturalWidth>0,rect:rect(img),fit:getComputedStyle(img).objectFit}))}));
    return {steps,heading:rect(root.querySelector('header')),scrolling:root.classList.contains('samsung-governance--scroll'),rect:rect(root),height:root.offsetHeight,viewport:innerHeight,width:innerWidth,background:getComputedStyle(root).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
}
const sameAnchors = (a,b) => Math.abs(a.visual.y-b.visual.y)<=1&&Math.abs(a.copy.y-b.copy.y)<=1;
const stateSignature = s => JSON.stringify(s.steps.map(x=>({id:x.id,alpha:x.alpha,hidden:x.hidden})));
async function content(page) {
  const result = await page.evaluate(()=>{
    const normalize=s=>s.replace(/\s+/g,' ').trim();
    const elements=[...document.querySelectorAll('main h1,main h2,main p,main video,[data-samsung-workspace]')];
    const locate=text=>elements.findIndex(n=>normalize(n.textContent)===text);
    const markers=[locate('B2B AI Agent & Mobile AI Office'),locate('From monitoring to on-site control.'),elements.findIndex(n=>n.matches('video')),locate('Connected devices and visitor workflows, together in one workspace.'),locate('Every task. One workspace.'),locate('Complex data, clear decisions, on site'),locate('Business and product challenge'),locate('Define the automation boundary')];
    const workspace=document.querySelector('[data-samsung-workspace]');
    const headings=[...document.querySelectorAll('main h1,main h2')].map(n=>normalize(n.textContent));
    const delivery=headings.indexOf('Complex data, clear decisions, on site');
    const context=headings.indexOf('Business and product challenge');
    return {markers,headings,workspaceText:normalize(workspace?.textContent||''),chapter:headings.slice(delivery+1,context),smartThings:[...document.querySelectorAll('a')].find(n=>n.textContent.includes('SmartThings Pro Mobile'))?.href,smartThingsText:[...document.querySelectorAll('a')].find(n=>n.textContent.includes('SmartThings Pro Mobile'))?.parentElement.textContent,adoption:headings.some(t=>t==='From one-off fixes to shared updates'),request:!!document.querySelector('[data-copy-email]'),nav:[...document.querySelectorAll('nav[aria-label="Case navigation"] a')].map(n=>n.getAttribute('href')),h1s:document.querySelectorAll('main h1').length};
  });
  check('one Samsung H1 and requested story order',result.h1s===1&&result.markers.every((x,i)=>x>=0&&(!i||x>result.markers[i-1])),result);
  check('token validation is a separately introduced chapter after mobile delivery',result.chapter.some(t=>/token/i.test(t)&&/validat|governance|system/i.test(t)),result.chapter);
  check('workspace explains three-app multitasking, split panes, popups and switching context',[/three|3/i,/split|pane/i,/pop.?up/i,/web|brows/i,/message/i,/route|direction|navigat/i,/switch/i].every(re=>re.test(result.workspaceText)),result.workspaceText);
  check('SmartThings link, adoption, request action and case navigation survive',result.smartThings?.includes('com.samsung.space.pnpt.stpm')&&['workplace access','room and seat reservations','calendar syncing','visitor invitations','support requests','lighting and temperature control','company’s administrator','operating policies'].every(text=>result.smartThingsText?.includes(text))&&result.adoption&&result.request&&result.nav.length===2,result);
}
async function staticScene(page,label) {
  await page.locator(scene).scrollIntoViewIfNeeded();await settle(page);
  const s=await snapshot(page);
  check(label+': both slide descriptions remain accessible without scrubbing',s.steps.length===2&&s.steps.every(x=>x.alpha>.99&&x.hidden!=='true'&&x.text.length>50),s);
  check(label+': both original deck images decode and fit viewport',s.steps.every(x=>x.images.length===1&&x.images[0].loaded&&x.images[0].alt&&x.visual.x>=-1&&x.visual.right<=s.width+1),s.steps);
  check(label+': black background reaches viewport edges without overflow',s.background==='rgb(0, 0, 0)'&&Math.abs(s.rect.x)<1&&Math.abs(s.rect.width-s.width)<2&&!s.overflow,s);
  for(const step of await page.locator(scene+' [data-governance-step]').all()){await step.scrollIntoViewIfNeeded();await settle(page);}
  await page.screenshot({path:path.join(out,label+'.png')});
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const executablePath=process.env[engine.toUpperCase()+'_EXECUTABLE'];
  const browser=await playwright[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    page.on('pageerror',e=>errors.push(e.message));await enter(page);await content(page);
    const count=await page.locator(scene).count();check('exactly one automation-boundary scene exists',count===1,count);
    if(count===1){
      const states=[];
      for(const p of [.1,.9]){await at(page,p);states.push(await snapshot(page));await page.screenshot({path:path.join(out,'desktop-'+p+'.png')});}
      const [first,last]=states;
      check('desktop black scene occupies the full viewport width',states.every(s=>s.background==='rgb(0, 0, 0)'&&Math.abs(s.rect.x)<1&&Math.abs(s.rect.width-1440)<2&&!s.overflow),states);
      check('desktop has a scroll runway and exactly EN08 then EN09',first.height>first.viewport*1.3&&first.steps.length===2&&first.steps.every((s,i)=>s.images.length===1&&s.images[0].src.includes('EN · 0'+(8+i))),first);
      check('scroll swaps each image together with its description',first.steps[0]?.alpha>.99&&first.steps[1]?.alpha<.01&&last.steps[0]?.alpha<.01&&last.steps[1]?.alpha>.99&&first.steps.every(s=>s.text.length>50)&&first.steps[0]?.text!==first.steps[1]?.text,states);
      check('active scene is exposed to assistive technology',first.steps[0]?.hidden!=='true'&&last.steps[1]?.hidden!=='true',states.map(s=>s.steps.map(x=>x.hidden)));
      const a=first.steps[0]?.images[0],b=last.steps[1]?.images[0];
      check('images decode and replace each other at the same screen position',a?.loaded&&b?.loaded&&a.alt&&b.alt&&Math.abs(first.steps[0].visual.x-last.steps[1].visual.x)<2&&Math.abs(first.steps[0].visual.y-last.steps[1].visual.y)<2&&Math.abs(first.steps[0].visual.width-last.steps[1].visual.width)<2&&first.steps[0].visual.y>=0&&last.steps[1].visual.bottom<=900,{a,b});
      check('desktop keeps the actual image and copy top anchors fixed across steps',sameAnchors(first.steps[0],last.steps[1]),{first:first.steps[0],last:last.steps[1]});
      await at(page,.5);const middle=await snapshot(page);check('transition retains visual coverage and an accessible description',middle.steps.reduce((sum,s)=>sum+s.alpha,0)>.99&&middle.steps.some(s=>s.hidden!=='true'),middle);
      await at(page,.1);check('reverse scrolling restores first image and description',stateSignature(await snapshot(page))===stateSignature(first));
      for(const p of [.9,.1,.8,.1])await page.locator(scene).evaluate((r,p)=>scrollTo(0,scrollY+r.getBoundingClientRect().top+(r.offsetHeight-innerHeight)*p),p);
      await settle(page);check('rapid interruption resolves to the final scroll position',stateSignature(await snapshot(page))===stateSignature(first));
      await page.evaluate(()=>{window.__retiredGovernance=document.querySelector('[data-samsung-governance]');location.hash='#/about';});await page.locator(scene).waitFor({state:'detached'});
      const retired=await page.evaluate(()=>window.__retiredGovernance.outerHTML);
      await page.evaluate(()=>{scrollTo(0,500);dispatchEvent(new Event('resize'));});await settle(page);
      check('route cleanup prevents retired scene updates',retired===await page.evaluate(()=>window.__retiredGovernance.outerHTML));
      await enter(page);await at(page,.9);check('reentry mounts one scene with the correct second state',await page.locator(scene).count()===1&&stateSignature(await snapshot(page))===stateSignature(last));
      await page.setViewportSize({width:320,height:700});await settle(page);const narrow=await snapshot(page);check('live resize exposes readable fallback when content exceeds viewport',!narrow.scrolling&&narrow.steps.every(s=>s.alpha>.99&&s.hidden!=='true')&&!narrow.overflow,narrow);
      await page.setViewportSize({width:1440,height:900});await settle(page);await at(page,.9);check('live resize restores desktop scroll ownership',stateSignature(await snapshot(page))===stateSignature(last));
      await page.emulateMedia({reducedMotion:'reduce'});await settle(page);await staticScene(page,'desktop-reduced');
      await page.emulateMedia({reducedMotion:'no-preference'});await settle(page);await at(page,.1);check('live motion preference restoration returns scroll ownership',stateSignature(await snapshot(page))===stateSignature(first));
    }
    await page.close();
    for(const [width,height] of [[320,700],[390,844]]){
      const p=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});p.on('pageerror',e=>errors.push(e.message));await enter(p);
      if(await p.locator(scene).count()){
        const mobile=await snapshot(p);
        if(mobile.scrolling){
          const endpoints=[];
          for(const [index,progress] of [[0,.1],[1,.9],[0,.1]]){
            await at(p,progress);const s=await snapshot(p),active=s.steps[index];endpoints.push(active);
            check('mobile '+width+'×'+height+': scroll reaches accessible step '+index,active.alpha>.99&&active.hidden!=='true'&&active.images.every(i=>i.loaded&&i.alt),s);
            check('mobile '+width+'×'+height+': active image and copy fit viewport',!s.overflow&&s.background==='rgb(0, 0, 0)'&&s.heading.y>=0&&s.heading.bottom<=height&&active.visual.x>=-1&&active.visual.right<=width+1&&active.visual.y>=0&&active.visual.bottom<=height&&active.copy.x>=-1&&active.copy.right<=width+1&&active.copy.y>=0&&active.copy.bottom<=height,s);
            await p.screenshot({path:path.join(out,'mobile-'+width+'-'+index+'.png')});
          }
        check('mobile '+width+'×'+height+': actual image and copy top anchors stay fixed forward and reverse',endpoints.every(s=>sameAnchors(endpoints[0],s)),endpoints);
        }else await staticScene(p,'mobile-'+width);
        await p.emulateMedia({reducedMotion:'reduce'});await settle(p);await staticScene(p,'mobile-'+width+'-reduced');
      }
      await p.close();
    }
    check('no uncaught browser errors',errors.length===0,errors);
  }finally{await browser.close();}
  const sources=Object.fromEntries(['index.html','samsung-story.js','samsung-story.css','samsung-workspace.js','samsung-workspace.css','samsung-governance.js','samsung-governance.css','hello-w-play/tests/samsung-story-content.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex')]));
  const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,sources,checks,failures},null,2));
  console.log(checks.length+' checks, '+failures.length+' failures',failures.map(c=>c.name));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1);});
