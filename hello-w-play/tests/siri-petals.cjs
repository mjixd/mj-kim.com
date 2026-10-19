// Behavioral contract drafted independently before implementation; executable
// checks added once the public rendered surfaces and extracted asset were available.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const out=process.env.TEST_OUTPUT||'/tmp/siri-petals-tests';
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const checks=[],errors=[];const check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const assetPath=path.resolve(__dirname,'../../assets/line/cherry-petals.json');
 const asset=JSON.parse(fs.readFileSync(assetPath));
 const rasters=asset.assets.filter(a=>a.p);
 check('animation contains only the original petal raster and no branch raster',rasters.length===1&&rasters[0].id==='image_1'&&hash(Buffer.from(rasters[0].p.split(',')[1],'base64'))==='4fd00ba7d18ba7b2ab766012531f8173321ef64337a136a1954277a4666c1fa1',rasters.map(a=>a.id));
 const refs=[...(asset.layers||[]),...asset.assets.flatMap(a=>a.layers||[])].filter(l=>l.refId).map(l=>l.refId);
 check('animation dependencies exclude branch and resolve locally',!refs.includes('image_0')&&refs.every(id=>asset.assets.some(a=>a.id===id)),[...new Set(refs)]);
 check('right animation data remains unchanged',hash(fs.readFileSync(assetPath))==='b612d9ec14bae52fc441275da39df3ac24f549339c4675e252e49c5000eb6c0c');
 const smaller=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../assets/line/cherry-petals-small.json')));
 const scaled=JSON.parse(JSON.stringify(asset));let scaledCount=0;
 for(const layer of [...(scaled.layers||[]),...scaled.assets.flatMap(a=>a.layers||[])])if(layer.ty===2){layer.ks.s.k=layer.ks.s.k.map(v=>v*.4);scaledCount++;}
 check('left derivative changes only petal scale to forty percent',scaledCount===36&&JSON.stringify(scaled)===JSON.stringify(smaller),{scaledCount});
 check('left background is the original blossom-free sky asset',hash(fs.readFileSync(path.resolve(__dirname,'../../assets/line/chat-sky-background.png')))==='a312ed208a096b76605e8cd868c4e8ec17873f0b51b8c64ccccd86e63cddf7be');
 check('original license notice remains preserved',hash(fs.readFileSync(path.resolve(__dirname,'../../assets/line/cherry-petals.LICENSE.txt')))==='7ba316331cfe5f828bc883b4acdc3bf52410e50b59933bbad4bb2328506fdc23');
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 const root=page.locator('[data-siri-themes]');
 const stamp=async()=>(await root.locator('[data-siri-petals]').evaluateAll(nodes=>nodes.map(n=>n.innerHTML))).map(hash);
 async function show(){await root.scrollIntoViewIfNeeded();await page.waitForTimeout(250);}
 async function movement(label,expected){const a=await stamp();await page.waitForTimeout(650);const b=await stamp();const changed=a.map((value,i)=>value!==b[i]);check(label,a.length===2&&b.length===2&&changed.every(value=>value===expected),{changed});}
 await page.goto(base+'#/work/line');await root.waitFor();await show();
 await page.waitForFunction(()=>document.querySelectorAll('[data-siri-petals] svg').length===2);
 await page.waitForFunction(()=>window.lottie.getRegisteredAnimations().filter(a=>a.name.startsWith('siri-petals')).every(a=>a.isLoaded));
 const baseline=await page.evaluate(()=>{
  const animations=lottie.getRegisteredAnimations().filter(a=>a.name.startsWith('siri-petals'));
  animations.forEach(a=>a.goToAndStop(45,true));
  const surfaces=[...document.querySelectorAll('[data-siri-petals]')].map((overlay,i)=>{
   const r=overlay.getBoundingClientRect(),image=[...overlay.querySelectorAll('image')].find(n=>n.getBoundingClientRect().width>0),p=image.getBoundingClientRect();
   return {speed:animations[i].playSpeed,petalWidth:p.width/r.width,petalHeight:p.height/r.height,hardwareFilter:getComputedStyle(overlay.closest('figure').querySelector('.siri-theme-hardware')).filter,sourceFilter:getComputedStyle(overlay.previousElementSibling).filter};
  });animations.forEach(a=>a.play());return surfaces;
 });
 const near=(a,b)=>Math.abs(a-b)<.005;
 check('left animated petals are forty percent of the original size',near(baseline[0].petalWidth,49.325164794921875/251.828125*.4)&&near(baseline[0].petalHeight,22.93804931640625/374.59375*.4),baseline[0]);
 check('left fall slows while right speed and petal size stay unchanged',baseline[0].speed>0&&baseline[0].speed<.65&&baseline[1].speed===.65&&near(baseline[1].petalWidth,17.534423828125/236.734375)&&near(baseline[1].petalHeight,8.1541748046875/105.171875),baseline);
 check('both phones restore unfiltered white hardware without filtering source UI',baseline.every(s=>s.hardwareFilter==='none'&&s.sourceFilter==='none'),baseline);
 const voiceCopy=await page.locator('[data-siri-voice]').innerText();
 check('petal and hardware credits are removed from the visible voice section',!/Petal animation:|Hardware and background:/.test(voiceCopy),voiceCopy);
 check('obsolete original-interface caption is removed',!(await page.locator('main').innerText()).includes('Original LINE interface designs from the 2016 SiriKit exploration.'));

 check('themes are merged into the original voice section',await page.locator('[data-siri-voice] [data-siri-themes]').count()===1&&await page.getByRole('heading',{name:'Spring, carried into Siri.',exact:true}).count()===0);
 const screens=await root.evaluate(root=>{const chat=root.querySelector('.siri-clean-chat'),chrome=chat?.querySelector('img');return {count:root.querySelectorAll('.siri-theme-screen').length,background:chat&&getComputedStyle(chat).backgroundImage,date:chat?.querySelector('.siri-chat-date')?.textContent,time:chat?.querySelector('.siri-chat-time')?.textContent,message:chat?.querySelector('.siri-chat-message')?.innerText,chrome:chrome?.getAttribute('src'),mask:chrome&&getComputedStyle(chrome).maskImage,right:root.querySelector('.siri-theme-phone:nth-child(2) .siri-theme-screen>img')?.getAttribute('src')};});
 check('left chat displays the cherry-blossom invitation with native chrome while right UI remains original',screens.count===2&&screens.background.includes('chat-sky-background.png')&&screens.date==='Today'&&screens.time==='9:39 AM'&&screens.message==='Want to go see the cherry\nblossoms this Saturday?'&&screens.chrome==='assets/line/siri-seasonal-chat.png'&&screens.mask.includes('rgba(0, 0, 0, 0)')&&screens.right==='assets/line/siri-final-sky.png',screens);
 await movement('both visible overlays animate SVG geometry',true);
 const before=hash(await root.screenshot());await page.waitForTimeout(650);const after=hash(await root.screenshot());check('visible falling petals change actual rendered pixels',before!==after);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});await show();
  const layout=await root.evaluate(root=>{
   const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
   return {viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,pair:rect(root),phones:[...root.querySelectorAll('figure')].map(phone=>{
    const screen=phone.querySelector('.siri-theme-screen'),overlay=phone.querySelector('[data-siri-petals]'),o=overlay.getBoundingClientRect();
    const visible=[...overlay.querySelectorAll('image')].filter(n=>{const r=n.getBoundingClientRect();let alpha=1;for(let p=n;p&&p!==overlay;p=p.parentElement){const s=getComputedStyle(p);alpha*=+s.opacity;if(s.display==='none'||s.visibility==='hidden')alpha=0;}return alpha>.01&&r.width>0&&r.height>0&&r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top;}).length;
    return {phone:rect(phone),screen:rect(screen),overlay:rect(overlay),clip:getComputedStyle(screen).overflow,overlayClip:getComputedStyle(overlay).overflow,visible};
   })};
  });
  check(width+': centered pair fits viewport without overlap',!layout.overflow&&layout.phones.length===2&&layout.phones[0].phone.right<=layout.phones[1].phone.left&&layout.phones.every(p=>p.phone.left>=0&&p.phone.right<=width+1)&&Math.abs((layout.phones[0].phone.left+layout.phones[1].phone.right)/2-width/2)<2,layout);
  check(width+': petals are clipped entirely inside both phone screens',layout.phones.every(p=>p.clip==='hidden'&&p.overlayClip==='hidden'&&p.overlay.left>=p.screen.left-1&&p.overlay.right<=p.screen.right+1&&p.overlay.top>=p.screen.top-1&&p.overlay.bottom<=p.screen.bottom+1),layout.phones);
  check(width+': each overlay visibly renders petals',layout.phones.every(p=>p.visible>0),layout.phones.map(p=>p.visible));
  const bubble=await root.locator('.siri-chat-message').evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const box=n.getBoundingClientRect();const lines=[...range.getClientRects()].filter(r=>r.width>0);return {lines:lines.map(r=>({left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top})),width:box.width,height:box.height};});
  check(width+': complete invitation stays within the message bubble on two lines',bubble.lines.length===2&&bubble.lines.every(r=>r.left>=0&&r.right<=bubble.width&&r.top>=0&&r.bottom<=bubble.height),bubble);
  await root.screenshot({path:path.join(out,'petals-'+width+'.png')});
 }
 const toggle=page.locator('[data-petals-toggle]');await toggle.evaluate(n=>n.focus({preventScroll:true}));await page.keyboard.press('Enter');await page.waitForTimeout(250);
 await movement('keyboard pause stops SVG updates',false);check('pause exposes resume action',/Play petals/.test(await toggle.innerText())&&await toggle.getAttribute('aria-pressed')==='true');
 await page.keyboard.press('Enter');await page.waitForTimeout(250);await movement('keyboard play resumes SVG updates',true);
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);await movement('offscreen petals stop updating',false);
 await show();await movement('returning onscreen resumes petals',true);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(250);await movement('hidden document stops petals',false);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(250);await movement('visible document resumes petals',true);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);await movement('live reduced motion freezes petals',false);check('reduced motion keeps both UIs and hides inactive control',await toggle.isHidden()&&await root.locator('.siri-clean-chat').isVisible()&&await root.locator('.siri-theme-phone:nth-child(2) .siri-theme-screen>img').isVisible());
 await page.reload();await root.waitFor();await show();await page.waitForFunction(()=>document.querySelectorAll('[data-siri-petals] svg').length===2);await movement('reduced-motion entry stays static',false);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(250);await movement('restored motion preference resumes petals',true);
 for(let cycle=0;cycle<2;cycle++){
  await root.evaluate(n=>window.__detachedPetalPair=n);await page.evaluate(()=>location.hash='#/about');await root.waitFor({state:'detached'});await page.waitForTimeout(200);
  const detached=await page.evaluate(()=>window.__detachedPetalPair.innerHTML);await page.waitForTimeout(600);
  check('route exit '+cycle+' stops and removes detached SVGs',detached===await page.evaluate(()=>window.__detachedPetalPair.innerHTML)&&await page.evaluate(()=>window.__detachedPetalPair.querySelectorAll('svg').length)===0);
  await page.evaluate(()=>location.hash='#/work/line');await root.waitFor();await show();await page.waitForFunction(()=>document.querySelectorAll('[data-siri-petals] svg').length===2);
  check('route reentry '+cycle+' has exactly two SVG effects',await page.locator('[data-siri-petals] svg').count()===2);await movement('route reentry '+cycle+' animates again',true);
 }
 check('browser has no runtime errors',errors.length===0,errors);await browser.close();
 const result={testHash:hash(fs.readFileSync(__filename)),assetHash:hash(fs.readFileSync(assetPath)),checks,failures:checks.filter(c=>!c.pass)};fs.writeFileSync(path.join(out,'siri-petals-results.json'),JSON.stringify(result,null,2));console.log(`${checks.length} checks, ${result.failures.length} failures`,result.failures.map(c=>c.name));if(result.failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
