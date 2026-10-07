const fs=require('fs'),path=require('path'),crypto=require('crypto'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_OUTPUT||path.join(require('os').tmpdir(),'hello-w-tests'),root=new URL('../',process.env.GAME_URL||'http://127.0.0.1:8789/hello-w-play/').href;
const checks=[],check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
const sentence='The titles haven’t caught up to the work. They will. I’d rather be fluent now than labeled later.';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 for(const width of [320,390,640,1440,1920]) {
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});await page.goto(root+'#/');await page.evaluate(()=>document.fonts.ready);
  const subtitle=await page.locator('.hero .manifesto').evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);const rects=[...range.getClientRects()];return {text:e.textContent,lines:new Set(rects.map(r=>Math.round(r.y))).size,box:e.getBoundingClientRect().toJSON(),whiteSpace:getComputedStyle(e).whiteSpace,rects:rects.map(r=>r.toJSON())};});
  check(`${width} retains exact subtitle sentence`,subtitle.text===sentence,subtitle.text);
  if(width>=1440)check(`${width} wide subtitle uses a single line`,subtitle.lines===1,subtitle);
  else check(`${width} narrow subtitle wraps naturally inside viewport`,subtitle.lines>1&&subtitle.whiteSpace!=='nowrap'&&subtitle.rects.every(r=>r.left>=0&&r.right<=width+1),subtitle);
  if(width<=640)for(const scroll of [0,400]) {
   await page.evaluate(y=>scrollTo(0,y),scroll);await page.waitForTimeout(80);
   const geo=await page.evaluate(()=>{const wrap=document.querySelector('.nav .wrap'),brand=document.querySelector('.brand'),links=document.querySelector('.links'),hero=document.querySelector('.hero'),style=getComputedStyle(wrap);return {left:brand.getBoundingClientRect().left,right:innerWidth-links.getBoundingClientRect().right,brandRight:brand.getBoundingClientRect().right,linksLeft:links.getBoundingClientRect().left,paddingLeft:parseFloat(style.paddingLeft),paddingRight:parseFloat(style.paddingRight),mainGutter:parseFloat(getComputedStyle(hero).paddingLeft),overflow:document.querySelector('.nav').scrollWidth>innerWidth};});
   check(`${width} scroll ${scroll} retains matching side gutters`,geo.left>=20&&geo.right>=20&&Math.abs(geo.left-geo.right)<1&&Math.abs(geo.left-geo.mainGutter)<1&&geo.paddingLeft>=20&&geo.paddingRight>=20,geo);
   check(`${width} scroll ${scroll} keeps brand and navigation separated`,geo.brandRight+8<=geo.linksLeft&&!geo.overflow,geo);
  }
  await page.screenshot({path:path.join(out,`home-responsive-${width}.png`),fullPage:false});await page.close();
 }
 const assetPage=await browser.newPage();await assetPage.goto(root+'#/work/domino-mvp');
 const target=assetPage.locator('img[src*="31"]');
 const candidates=await target.evaluateAll(es=>es.filter(e=>decodeURIComponent(e.src).includes('EN · 31')).map(e=>e.src));check('Domino page retains EN31 image reference',candidates.length>0,candidates);
 if(candidates.length){const response=await assetPage.request.get(candidates[0]);check('referenced EN31 returns a decodable image',response.status()===200&&await assetPage.evaluate(async src=>{const image=new Image();image.src=src;try{await image.decode();return image.naturalWidth>0&&image.naturalHeight>0}catch{return false}},candidates[0]),{status:response.status()});}
 await browser.close();const result={en31Hash:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../assets/decks/EN · 31.png'))).digest('hex'),sourceHash:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../index.html'))).digest('hex'),checks,failures:checks.filter(c=>!c.pass)};fs.writeFileSync(path.join(out,'home-responsive-results.json'),JSON.stringify(result,null,2));console.log(checks.length+' checks, '+result.failures.length+' failures',result.failures.map(c=>c.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
