const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_OUTPUT||path.join(require('os').tmpdir(),'hello-w-tests'),root=new URL('../',process.env.GAME_URL||'http://127.0.0.1:8789/hello-w-play/').href;
const checks=[],check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
const roles=['Product Designer','Design Strategist','Design Engineer','Product Lead','Strategy Lead','Design Lead','Builder'];
async function snapshot(page){return page.locator('.brand').evaluate(e=>{const links=document.querySelector('.links'),style=getComputedStyle(e),visible=[e,...e.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&n.getBoundingClientRect().height>0;});return {label:e.getAttribute('aria-label')||e.innerText.replace(/\s+/g,' ').trim(),box:e.getBoundingClientRect().toJSON(),contentRight:Math.max(...visible.map(n=>n.getBoundingClientRect().right)),links:links.getBoundingClientRect().toJSON(),width:innerWidth,lineHeight:parseFloat(style.lineHeight),role:document.querySelector('#slotRole .l1')?.textContent,blur:visible.some(n=>/blur\(/.test(getComputedStyle(n).filter)&&!/^blur\(0(?:px)?\)$/.test(getComputedStyle(n).filter)),visualLayers:visible.filter(n=>n.getAttribute('aria-hidden')==='true').length};});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})}),errors=[];
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(root+'#/');await page.evaluate(()=>document.fonts.ready);
  check(width+' home top shows only name',(await snapshot(page)).label==='Minjung Kim');await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(100);await page.clock.runFor(50);
  const samples=[];for(let i=0;i<8;i++){samples.push(await snapshot(page));await page.clock.runFor(1000);}
  check(width+' scroll alternates name and role without combined label',samples.some(s=>s.label==='Minjung Kim')&&samples.some(s=>roles.includes(s.label))&&samples.every(s=>s.label==='Minjung Kim'||roles.includes(s.label)),samples.map(s=>s.label));
  check(width+' header stays single line with gutters and separated links',samples.every(s=>s.box.height<=s.lineHeight+1&&s.box.x>=20&&s.width-s.links.right>=20&&s.contentRight+8<=s.links.x),samples);
  const controlled=[];for(const role of roles){await page.evaluate(role=>{ROLES.fill(role);document.querySelector('#slotRole .l1').textContent=role;},role);const seen=[];for(let i=0;i<10;i++){await page.clock.runFor(500);seen.push(await snapshot(page));}controlled.push({role,sample:seen.find(s=>s.label===role)});}
  check(width+' every valid role fits as the sampled single-line label',controlled.every(({sample:s})=>s&&s.box.height<=s.lineHeight+1&&s.box.x>=20&&s.width-s.links.right>=20&&s.contentRight+8<=s.links.x),controlled);
  check(width+' reduced motion has no blur',samples.every(s=>!s.blur));
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);await page.clock.runFor(50);check(width+' return to top restores static name',(await snapshot(page)).label==='Minjung Kim');
  await page.evaluate(()=>location.hash='#/about');await page.clock.runFor(6000);check(width+' other page retains static name',(await snapshot(page)).label==='Minjung Kim');await page.screenshot({path:path.join(out,`header-alternation-${width}.png`)});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'no-preference'});page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(root+'#/');await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(100);const samples=[];
 for(let t=0;t<7600;t+=100){await page.clock.runFor(100);samples.push({t,...await snapshot(page)});}
 const changes=samples.filter((s,i)=>!i||s.label!==samples[i-1].label);
 check('normal motion commits alternating name and role',changes.length>=3&&changes.every((s,i)=>s.label==='Minjung Kim'||roles.includes(s.label))&&changes.slice(1).every((s,i)=>(s.label==='Minjung Kim')!==(changes[i].label==='Minjung Kim')),changes);
 check('labels alternate at the agreed approximately two-second cadence',changes.length>=3&&changes.slice(2).every((s,i)=>s.t-changes[i+1].t>=1800&&s.t-changes[i+1].t<=2800),changes);
 check('both directions use a brief morph',changes.slice(1).length>=2&&changes.slice(1).every(c=>samples.some(s=>Math.abs(s.t-c.t)<=500&&s.blur)),changes);
 const runs=[];let start=null;for(const s of samples){if(s.blur&&start===null)start=s.t;if(!s.blur&&start!==null){runs.push(s.t-start);start=null;}}
 check('morph completes promptly without continuous blur',runs.length>=2&&runs.every(ms=>ms<=600),runs);
 check('role entry samples the current committed hero role',changes.filter(s=>roles.includes(s.label)).every(c=>samples.some(s=>s.t<=c.t&&s.t>=c.t-600&&s.role===c.label)),changes);
 check('visual morph layers do not duplicate accessible brand name',samples.some(s=>s.visualLayers>=2)&&samples.every(s=>s.label==='Minjung Kim'||roles.includes(s.label)));
 await page.evaluate(()=>location.hash='#/about');await page.clock.runFor(3000);check('leaving home cancels active label animation',(await snapshot(page)).label==='Minjung Kim'&&!(await snapshot(page)).blur);
 // Existing lifecycle regression: route during overlapping hero morph callbacks.
 await page.goto(root+'#/');await page.clock.runFor(2580);await page.evaluate(()=>location.hash='#/about');await page.clock.runFor(4000);check('navigation during morph has no browser errors',errors.length===0,errors);
 await browser.close();const hashes={index:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../index.html'))).digest('hex')},result={hashes,checks,failures:checks.filter(c=>!c.pass)};fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify(result,null,2));console.log(checks.length+' checks, '+result.failures.length+' failures',result.failures.map(c=>c.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{checks.push({name:'browser execution completes without lifecycle exceptions',pass:false,error:e.stack});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify({checks,failures:checks.filter(c=>!c.pass)},null,2));console.error(e);process.exit(1)});
