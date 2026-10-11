const fs=require('fs'),path=require('path'),crypto=require('crypto'),browserType=require(process.env.PLAYWRIGHT_MODULE||'playwright')[process.env.BROWSER_ENGINE||'chromium'];
const out=process.env.TEST_OUTPUT||path.join(require('os').tmpdir(),'hello-w-tests'),root=new URL('../',process.env.GAME_URL||'http://127.0.0.1:8789/hello-w-play/').href;
const checks=[],check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
const roles=['Product Designer','Design Strategist','Design Engineer','Product Lead','Strategy Lead','Design Lead','Builder'];
async function snapshot(page){return page.locator('.brand').evaluate(e=>{const links=document.querySelector('.links'),style=getComputedStyle(e),visible=[e,...e.querySelectorAll('*')].filter(n=>{const s=getComputedStyle(n);return s.display!=='none'&&s.visibility!=='hidden'&&n.getBoundingClientRect().height>0;});return {label:e.getAttribute('aria-label')||e.innerText.replace(/\s+/g,' ').trim(),box:e.getBoundingClientRect().toJSON(),contentRight:Math.max(...visible.map(n=>n.getBoundingClientRect().right)),links:links.getBoundingClientRect().toJSON(),width:innerWidth,lineHeight:parseFloat(style.lineHeight),role:document.querySelector('#slotRole .l1')?.textContent,blur:visible.some(n=>/blur\(/.test(getComputedStyle(n).filter)&&!/^blur\(0(?:px)?\)$/.test(getComputedStyle(n).filter)),visualLayers:visible.filter(n=>n.getAttribute('aria-hidden')==='true').length};});}
// Real animation frames exercise the browser event loop, not just mocked timers.
async function sampleMobileCycle(page){return page.evaluate(()=>new Promise(resolve=>{
 const samples=[],start=performance.now();
 function sample(now){
  const brand=document.querySelector('.brand'),layers=[...brand.querySelectorAll('.brand-word')].map(n=>{const s=getComputedStyle(n);return {text:n.textContent,opacity:Number(s.opacity),filter:s.filter,right:n.getBoundingClientRect().right};});
  samples.push({t:now-start,label:brand.getAttribute('aria-label'),layers,composite:getComputedStyle(brand).filter,scrollY,box:brand.getBoundingClientRect().toJSON(),lineHeight:parseFloat(getComputedStyle(brand).lineHeight),links:document.querySelector('.links').getBoundingClientRect().toJSON()});
  if(now-start<5600)requestAnimationFrame(sample);else resolve(samples);
 }
 requestAnimationFrame(sample);
}));}
function checkMobileCycle(name,samples){
 const stable=samples.filter(s=>s.layers[0].opacity===1&&s.layers[1].opacity===0),morph=samples.filter(s=>s.layers.every(l=>l.opacity>0.05&&l.opacity<0.95)&&s.layers.some(l=>/blur\([1-9.]/.test(l.filter)));
 check(name+' real frames alternate a stable name and valid role',stable.some(s=>s.label==='Minjung Kim')&&stable.some(s=>roles.includes(s.label)),[...new Set(stable.map(s=>s.label))]);
 check(name+' real frames show brief morph in both directions',morph.some(s=>s.layers[0].text==='Minjung Kim'&&roles.includes(s.layers[1].text))&&morph.some(s=>roles.includes(s.layers[0].text)&&s.layers[1].text==='Minjung Kim'),morph.map(s=>({t:s.t,layers:s.layers})));
 check(name+' morph frames apply shared letterform composition',morph.length>0&&morph.every(s=>s.composite.includes('url(')),[...new Set(morph.map(s=>s.composite))]);
 check(name+' settled endpoints are crisp',stable.length>0&&stable.every(s=>s.layers.every(l=>l.filter==='none'||/^blur\(0(?:px)?\)$/.test(l.filter))));
 check(name+' every rendered frame stays one line and clear of navigation',samples.every(s=>s.scrollY>8&&s.box.height<=s.lineHeight+1&&s.layers.every(l=>l.right+8<=s.links.x)),samples.filter(s=>s.box.height>s.lineHeight+1||s.layers.some(l=>l.right+8>s.links.x)));
}
// Freeze a real intermediate frame, then remove only the shared SVG filter.
// A blur/crossfade (the reported regression) has no threshold contribution and
// produces identical pixels. Child blur/opacity alone cannot satisfy this oracle.
async function checkGooeyComposite(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
 await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.goto(root+'#/about');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,400));
 await page.clock.runFor(40);
 const clip=await page.locator('.brand').boundingBox(),nameEndpoint=await page.screenshot({clip});
 fs.writeFileSync(path.join(out,'header-name-endpoint.png'),nameEndpoint);
 let frame;
 for(let t=0;t<3200;t+=40){
  await page.clock.runFor(40);
  frame=await page.locator('.brand').evaluate(brand=>{
   const layers=[...brand.querySelectorAll('.brand-word')];
   const common=[brand,...brand.querySelectorAll('*')].filter(n=>layers.every(l=>n.contains(l)));
   const filters=common.map(n=>getComputedStyle(n).filter).filter(f=>f.includes('url('));
   return {layers:layers.map(n=>({text:n.textContent,opacity:Number(getComputedStyle(n).opacity),filter:getComputedStyle(n).filter})),filters};
  });
  if(frame.layers.length===2&&frame.layers.every(l=>l.opacity>0.2&&l.opacity<0.9)&&frame.layers.every(l=>l.text)&&Math.abs(frame.layers[0].opacity-frame.layers[1].opacity)<0.08)break;
 }
 check('gooey oracle reaches a combined intermediate frame',frame.layers.length===2&&frame.layers.every(l=>l.opacity>0.2&&l.opacity<0.9)&&frame.layers.every(l=>l.text)&&Math.abs(frame.layers[0].opacity-frame.layers[1].opacity)<0.08,frame);
 check('both letterforms share an active SVG composite filter',frame.filters.length>0,frame);
 const actual=await page.screenshot({clip});fs.writeFileSync(path.join(out,'header-gooey-frame.png'),actual);
 await page.locator('.brand').evaluate(brand=>{
  const layers=[...brand.querySelectorAll('.brand-word')];
  for(const n of [brand,...brand.querySelectorAll('*')])if(layers.every(l=>n.contains(l))&&getComputedStyle(n).filter.includes('url('))n.style.setProperty('filter','none','important');
 });
 const control=await page.screenshot({clip});fs.writeFileSync(path.join(out,'header-blur-only-control.png'),control);
 await page.locator('.brand').evaluate(brand=>{for(const n of [brand,...brand.querySelectorAll('*')])n.style.removeProperty('filter');});
 await page.clock.runFor(800);
 const roleEndpoint=await page.screenshot({clip});fs.writeFileSync(path.join(out,'header-role-endpoint.png'),roleEndpoint);
 const pixels=await page.evaluate(async images=>{
  const arrays=[];let width,height;
  for(const src of images){const image=new Image();image.src=src;await image.decode();width=image.width;height=image.height;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);arrays.push(ctx.getImageData(0,0,width,height).data);}
  let changed=0,total=0;for(let i=0;i<arrays[0].length;i+=4){const delta=Math.max(...[0,1,2].map(c=>Math.abs(arrays[0][i+c]-arrays[1][i+c])));if(delta>12)changed++;total+=delta;}
  const ink=arrays.map(data=>{let count=0;for(let i=0;i<data.length;i+=4)if((data[i]+data[i+1]+data[i+2])/3<128)count++;return count;});
  return {width,height,changed,changedFraction:changed/(width*height),meanDifference:total/(width*height),ink,retainedInk:ink[0]/Math.min(ink[2],ink[3])};
 },[actual,control,nameEndpoint,roleEndpoint].map(buffer=>'data:image/png;base64,'+buffer.toString('base64')));
 check('rendered morph differs materially from blur-only control',pixels.changedFraction>0.01&&pixels.meanDifference>1,pixels);
 check('mid-morph letterforms retain visible ink rather than disappear',pixels.retainedInk>=0.5,pixels);
 await page.close();
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await browserType.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})}),errors=[];
 await checkGooeyComposite(browser);
 if(!process.env.HEADER_MORPH_ONLY){
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto(root+'#/');await page.evaluate(()=>document.fonts.ready);
  check(width+' home top shows only name',(await snapshot(page)).label==='Minjung Kim');await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(100);await page.clock.runFor(50);
  const samples=[];for(let i=0;i<8;i++){samples.push(await snapshot(page));await page.clock.runFor(1000);}
  check(width+' scroll alternates name and role without combined label',samples.some(s=>s.label==='Minjung Kim')&&samples.some(s=>roles.includes(s.label))&&samples.every(s=>s.label==='Minjung Kim'||roles.includes(s.label)),samples.map(s=>s.label));
  check(width+' header stays single line with gutters and separated links',samples.every(s=>s.box.height<=s.lineHeight+1&&s.box.x>=20&&s.width-s.links.right>=20&&s.contentRight+8<=s.links.x),samples);
  const controlled=[];for(const role of roles){await page.evaluate(role=>{ROLES.fill(role);document.querySelector('#slotRole .l1').textContent=role;},role);const seen=[];for(let i=0;i<10;i++){await page.clock.runFor(500);seen.push(await snapshot(page));}controlled.push({role,sample:seen.find(s=>s.label===role)});}
  check(width+' every valid role fits as the sampled single-line label',controlled.every(({sample:s})=>s&&s.box.height<=s.lineHeight+1&&s.box.x>=20&&s.width-s.links.right>=20&&s.contentRight+8<=s.links.x),controlled);
  check(width+' reduced motion has no blur',samples.every(s=>!s.blur));
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);await page.clock.runFor(50);check(width+' return to top restores static name',(await snapshot(page)).label==='Minjung Kim');
  await page.evaluate(()=>location.hash='#/about');await page.clock.runFor(6000);check(width+' top of other page retains static name',(await snapshot(page)).label==='Minjung Kim');await page.screenshot({path:path.join(out,`header-alternation-${width}.png`)});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'no-preference'});page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto(root+'#/');await page.evaluate(()=>scrollTo(0,400));await page.waitForTimeout(100);const samples=[];
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
 await page.close();
 for(const route of ['#/','#/about','#/work/samsung']){
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(root+route);await mobile.evaluate(()=>document.fonts.ready);await mobile.evaluate(()=>scrollTo(0,400));
  checkMobileCycle('mobile '+route,await sampleMobileCycle(mobile));
  if(route==='#/about'){
   await mobile.evaluate(()=>scrollTo(0,0));await mobile.waitForTimeout(150);check('mobile About top resets to static name',(await snapshot(mobile)).label==='Minjung Kim');
   await mobile.evaluate(()=>scrollTo(0,400));checkMobileCycle('mobile About re-scroll',await sampleMobileCycle(mobile));
   await mobile.evaluate(()=>location.hash='#/work/meta');await mobile.waitForTimeout(150);await mobile.evaluate(()=>scrollTo(0,400));checkMobileCycle('mobile case after route navigation',await sampleMobileCycle(mobile));
  }
  await mobile.close();
 }
 check('all mobile route lifecycles have no browser errors',errors.length===0,errors);
 }
 await browser.close();const hashes={index:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../index.html'))).digest('hex')},result={hashes,checks,failures:checks.filter(c=>!c.pass)};fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify(result,null,2));console.log(checks.length+' checks, '+result.failures.length+' failures',result.failures.map(c=>c.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{checks.push({name:'browser execution completes without lifecycle exceptions',pass:false,error:e.stack});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify({checks,failures:checks.filter(c=>!c.pass)},null,2));console.error(e);process.exit(1)});
