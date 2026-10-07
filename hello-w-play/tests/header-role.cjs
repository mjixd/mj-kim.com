const fs=require('fs'),path=require('path'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_OUTPUT||path.join(require('os').tmpdir(),'hello-w-tests'),root=new URL('../',process.env.GAME_URL||'http://127.0.0.1:8789/hello-w-play/').href;
const checks=[],check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto(root+'#/');
 const role=page.locator('#nav-role');check('header provides role noun slot',await role.count()===1);
 if(await role.count()) {
  check('role hidden at home top',!await role.isVisible());
  for(const width of [1280,390,320]) {
   await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,400));await page.clock.runFor(500);
   const seen=new Set();
   for(let i=0;i<7;i++) {
    const actual=await role.textContent(),committed=await page.locator('#slotRole .l1').textContent();seen.add(actual);
    check(`${width} role ${i} follows committed second slot`,await role.isVisible()&&actual===committed,{actual,committed});
    const geo=await page.evaluate(()=>{const r=document.querySelector('#nav-role'),n=document.querySelector('.brand .name'),l=document.querySelector('.links');if(!n)return null;return {r:r.getBoundingClientRect().toJSON(),n:n.getBoundingClientRect().toJSON(),l:l.getBoundingClientRect().toJSON(),roleSize:parseFloat(getComputedStyle(r).fontSize),nameSize:parseFloat(getComputedStyle(n).fontSize),width:innerWidth,overflow:document.querySelector('.nav').scrollWidth>innerWidth};});
    check(`${width} role ${actual} fits before name and clear of navigation`,geo&&!geo.overflow&&geo.r.x>=0&&geo.n.x>=0&&Math.max(geo.r.right,geo.n.right)<=geo.l.x+1&&geo.l.right<=width+1&&Math.abs(geo.roleSize-geo.nameSize)<=2&&(width>640?geo.r.right<=geo.n.x+1:geo.r.bottom<=geo.n.y+1),geo);
    await page.clock.runFor(4240);
   }
   check(`${width} all role nouns exercised`,seen.size===7,[...seen]);await page.screenshot({path:path.join(out,`header-${width}.png`)});
  }
  await page.evaluate(()=>scrollTo(0,0));await page.clock.runFor(50);check('scrolling back to top hides role',!await role.isVisible());
  await page.evaluate(()=>scrollTo(0,400));await page.clock.runFor(50);await page.locator('[data-nav="about"]').click();await page.clock.runFor(5000);check('about keeps role hidden',!await role.isVisible());
 }
 const motion=await browser.newPage({reducedMotion:'no-preference'});motion.on('pageerror',e=>errors.push(e.message));await motion.clock.install();await motion.goto(root+'#/');await motion.clock.runFor(2580);await motion.evaluate(()=>location.hash='#/about');await motion.clock.runFor(4000);check('navigation during morph has no browser errors',errors.length===0,errors);
 await browser.close();const hashes=Object.fromEntries(["index.html","hello-w-play/game.js","hello-w-play/app.js","hello-w-play/style.css","hello-w-play/block-scene.js"].filter(f=>fs.existsSync(f)).map(f=>[f,require("crypto").createHash("sha256").update(fs.readFileSync(f)).digest("hex")]));const result={hashes,checks,failures:checks.filter(x=>!x.pass)};fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify(result,null,2));console.log(checks.length+' checks, '+result.failures.length+' failures',result.failures.map(x=>x.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{checks.push({name:'browser execution completes without lifecycle exceptions',pass:false,error:e.stack});fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'header-role-results.json'),JSON.stringify({checks,failures:checks.filter(x=>!x.pass)},null,2));console.error(e);process.exit(1)});
