// Rendered-backdrop oracle: computed blur alone cannot detect an opaque covering layer.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const out=process.env.TEST_OUTPUT||'/tmp/samsung-glass-pixels';
const checks=[];const check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
  await page.goto(base+'#/work/samsung');await page.locator('[data-samsung-workspace]').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.locator('.samsung-workspace__visual').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  const boxes=await page.locator('[data-samsung-screen]').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.samsungScreen,x:r.x,y:r.y,w:r.width,h:r.height,localWidth:el.offsetWidth,localHeight:el.offsetHeight};}));
  const styles=await page.locator('[data-samsung-screen]').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.samsungScreen,background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter,content:[...el.querySelectorAll('b,p')].map(n=>({opacity:getComputedStyle(n).opacity,filter:getComputedStyle(n).filter}))})));
  async function capture(name,background,blur=true,opaque=false){
   await page.locator('.sw-wallpaper').evaluate((el,bg)=>el.style.background=bg,background);
   await page.locator('[data-samsung-screen]').evaluateAll((nodes,{blur,opaque})=>nodes.forEach(el=>{el.style.backdropFilter=blur?'':'none';el.style.webkitBackdropFilter=blur?'':'none';el.style.backgroundColor=opaque?'rgb(26,30,35)':'';}),{blur,opaque});
   await page.waitForTimeout(80);const buffer=await page.screenshot({path:path.join(out,name+'.png')});return buffer.toString('base64');
  }
  const black=await capture('black','#000'),white=await capture('white','#fff');
  const stripe='repeating-linear-gradient(90deg,#000 0 8px,#fff 8px 16px)';
  const blurred=await capture('stripe-blurred',stripe),sharp=await capture('stripe-sharp',stripe,false);
  const opaqueBlack=await capture('opaque-black','#000',true,true),opaqueWhite=await capture('opaque-white','#fff',true,true);
  const stats=await page.evaluate(async({images,boxes})=>{
   const pixels=await Promise.all(images.map(async raw=>{const img=new Image();img.src='data:image/png;base64,'+raw;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return{width:c.width,data:ctx.getImageData(0,0,c.width,c.height).data};}));
   return boxes.map(box=>{
    // Top-center blank strip excludes status text, camera, handles and app content.
    const samples=pixels.map(p=>{const values=[];for(let ly=18;ly<28;ly+=2)for(let lx=110;lx<215;lx+=2){const x=Math.round((box.x+lx/box.localWidth*box.w)*devicePixelRatio),y=Math.round((box.y+ly/box.localHeight*box.h)*devicePixelRatio);const i=(y*p.width+x)*4;values.push((p.data[i]+p.data[i+1]+p.data[i+2])/3);}const mean=values.reduce((a,b)=>a+b,0)/values.length;return{mean,std:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length)};});
    return{id:box.id,transmission:samples[1].mean-samples[0].mean,blurStd:samples[2].std,sharpStd:samples[3].std,opaqueTransmission:samples[5].mean-samples[4].mean,samples};
   });
  },{images:[black,white,blurred,sharp,opaqueBlack,opaqueWhite],boxes});
  for(const s of stats){
   const targetTransmission=s.id==='visitor'?38.25:51;
   check(s.id+': background pixels transmit the latest Figma fill',Math.abs(s.transmission-targetTransmission)<=5,s);
   check(s.id+': blur visibly suppresses wallpaper high frequencies',s.sharpStd>=15&&s.blurStd<s.sharpStd*.25,s);
   check(s.id+': oracle rejects an opaque surface mutation',s.opaqueTransmission<2,s);
  }
  check('all three panes preserve opaque, unfiltered content',styles.every(s=>s.content.length&&s.content.every(c=>c.opacity==='1'&&c.filter==='none')),styles);
  // Latest triple master uses 85% visitor fill; control and AI retain 80%.
  check('all panes use the latest black glass fills',styles.every(s=>s.background===`rgba(0, 0, 0, ${s.id==='visitor'?'0.85':'0.8'})`),styles);
 }finally{await browser.close();}
 const hashes=Object.fromEntries(['samsung-workspace.css','samsung-workspace.js','hello-w-play/tests/samsung-glass-pixels.cjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../..',f))).digest('hex')]));
 const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({hashes,checks,failures},null,2));console.log(checks.length+' checks, '+failures.length+' failures',failures.map(f=>f.name));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
