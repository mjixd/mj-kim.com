// Independent acceptance: fixed chrome + typed request + upward card entrance.
// Original PSD text/art fidelity and perceived easing are checked by visual readback.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const out=process.env.TEST_OUTPUT||'/tmp/siri-composition-tests';
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const checks=[],errors=[];
const check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'#/work/line');
 const chip=page.locator('[data-siri-chip]');await chip.waitFor();
 const structure=await chip.evaluate(root=>{
  const clone=root.cloneNode(true);clone.querySelector('.siri-chip-phone')?.remove();clone.querySelectorAll('button').forEach(n=>n.remove());
  return {next:root.nextElementSibling?.querySelector('h2')?.innerText,copy:clone.innerText||clone.textContent,buttons:[...root.querySelectorAll('button')].map(n=>({text:n.textContent.trim(),label:n.getAttribute('aria-label')}))};
 });
 check('keyvisual immediately precedes Supported Domains',structure.next?.trim()==='Supported Domains',structure.next);
 const normalized=structure.copy.replace(/\s+/g,' ').trim();
 check('external keyvisual copy contains only title and subtitle',normalized==='Say it to Siri.Send it with LINE. A name. A message. One spoken request.'||normalized==='Say it to Siri. Send it with LINE. A name. A message. One spoken request.',normalized);
 check('optional playback control is icon-only with accessible label',structure.buttons.every(b=>!/[A-Za-z]{2}/.test(b.text)&&b.label),structure.buttons);
 const counts=await chip.evaluate(root=>({status:root.querySelectorAll('[data-siri-status]').length,request:root.querySelectorAll('[data-siri-request]').length,card:root.querySelectorAll('[data-siri-card]').length}));
 check('phone exposes separate fixed status, typed request, and message card',counts.status===1&&counts.request===1&&counts.card>=1,counts);
 if(counts.status===1&&counts.request===1&&counts.card>=1){
  async function scene(){return chip.evaluate(root=>{
   const phone=root.querySelector('.siri-chip-phone').getBoundingClientRect();
   function visible(n){let opacity=1;for(let p=n;p&&p!==root;p=p.parentElement){const s=getComputedStyle(p);opacity*=+s.opacity;if(s.display==='none'||s.visibility==='hidden')opacity=0;}return opacity;}
   function box(n){const r=n.getBoundingClientRect();return {x:r.x-phone.x,y:r.y-phone.y,w:r.width,h:r.height,opacity:visible(n)};}
   return {status:box(root.querySelector('[data-siri-status]')),request:root.querySelector('[data-siri-request]').innerText,
    cards:[...root.querySelectorAll('[data-siri-card]')].map(n=>({...box(n),transform:getComputedStyle(n).transform}))};
  });}
  async function show(){await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await page.locator('.siri-chip-phone').scrollIntoViewIfNeeded();await page.waitForTimeout(100);}
  await show();const samples=[];
  for(let i=0;i<140;i++){samples.push(await scene());await page.waitForTimeout(100);}
  const status=samples[0].status;
  check('status bar stays visible and fixed throughout the scene',status.w>0&&status.h>0&&samples.every(s=>s.status.opacity>.95&&['x','y','w','h'].every(k=>Math.abs(s.status[k]-status[k])<1)),samples.map(s=>s.status));
  const longest=samples.reduce((a,b)=>a.request.length>b.request.length?a:b).request;
  const firstFull=samples.findIndex(s=>s.request===longest);
  const typed=[...new Set(samples.slice(0,firstFull).map(s=>s.request).filter(t=>t.length>0&&t.length<longest.length))];
  check('request reveals multiple partial prefixes before the full utterance',longest.length>30&&typed.length>=4&&typed.every(t=>longest.startsWith(t)),{longest,typed});
  const entering=samples.flatMap(s=>s.cards).filter(c=>c.opacity>.05&&c.opacity<.99);
  const settled=samples.flatMap(s=>s.cards).filter(c=>c.opacity>.99);
  check('message card enters from below and settles visibly',entering.length>1&&settled.length>0&&Math.max(...entering.map(c=>c.y))-Math.min(...settled.map(c=>c.y))>10,{entering,settled:settled.slice(-3)});
  check('message presentation preserves typed request and status bar',samples.some(s=>s.cards.some(c=>c.opacity>.99)&&s.request===longest&&s.status.opacity>.95));
  await show();await page.waitForTimeout(1000);
  const playback=page.locator('[data-siri-playback]');
  if(await playback.count()){
   await playback.evaluate(button=>button.focus({preventScroll:true}));await page.keyboard.press('Enter');await page.waitForTimeout(150);
   const paused=await scene();await page.waitForTimeout(600);
   check('icon playback control pauses via keyboard and announces play action',JSON.stringify(paused)===JSON.stringify(await scene())&&/Play/i.test(await playback.getAttribute('aria-label')));
   await page.keyboard.press('Enter');await page.waitForTimeout(1200);
   check('icon playback control resumes typed request via keyboard',JSON.stringify(paused)!==JSON.stringify(await scene())&&/Pause/i.test(await playback.getAttribute('aria-label')));
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(200);
  const hidden=await scene();await page.waitForTimeout(600);check('hidden document freezes typed text and card motion',JSON.stringify(hidden)===JSON.stringify(await scene()));
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(250);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);
  const offscreen=await scene();await page.waitForTimeout(600);check('offscreen stops typed text and card updates',JSON.stringify(offscreen)===JSON.stringify(await scene()));
  await page.emulateMedia({reducedMotion:'reduce'});await show();
  const reduced=await scene();await page.waitForTimeout(600);
  check('reduced motion shows static request and visible message card',reduced.request.length>0&&reduced.cards.some(c=>c.opacity>.95)&&JSON.stringify(reduced)===JSON.stringify(await scene()),reduced);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:900});await page.locator('.siri-chip-phone').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
   const layout=await chip.evaluate(root=>{const r=root.querySelector('.siri-chip-phone').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,overflow:document.documentElement.scrollWidth>innerWidth+1};});
   check(width+': phone composition fits viewport',layout.left>=-1&&layout.right<=width+1&&layout.width>100&&!layout.overflow,layout);
   await page.screenshot({path:path.join(out,'composition-'+width+'.png')});
  }
  await page.emulateMedia({reducedMotion:'no-preference'});await show();await page.waitForTimeout(1000);
  await chip.evaluate(root=>window.__detachedSiriComposition=root);
  await page.evaluate(()=>location.hash='#/about');await chip.waitFor({state:'detached'});await page.waitForTimeout(200);
  const before=await page.evaluate(()=>window.__detachedSiriComposition.outerHTML);await page.waitForTimeout(600);
  check('route exit stops detached composition updates',before===await page.evaluate(()=>window.__detachedSiriComposition.outerHTML));
  await page.evaluate(()=>location.hash='#/work/line');await chip.waitFor();await show();
  const reentry=await scene();await page.waitForTimeout(1500);
  check('route reentry restores one advancing composition',await chip.count()===1&&JSON.stringify(reentry)!==JSON.stringify(await scene()));
 }
 check('browser has no runtime errors',errors.length===0,errors);await browser.close();
 const result={testHash:hash(fs.readFileSync(__filename)),checks,failures:checks.filter(c=>!c.pass)};
 fs.writeFileSync(path.join(out,'siri-composition-results.json'),JSON.stringify(result,null,2));
 console.log(`${checks.length} checks, ${result.failures.length} failures`,result.failures.map(c=>c.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
