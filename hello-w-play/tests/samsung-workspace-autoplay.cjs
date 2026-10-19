// Controls are absent; native scroll, automatic mobile progression and reduced motion remain public entry paths.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const out=process.env.TEST_OUTPUT||'/tmp/samsung-workspace-autoplay';
const checks=[],errors=[];
const check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
async function enter(browser,width,reducedMotion='no-preference'){
 const p=await browser.newPage({viewport:{width,height:900},reducedMotion});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'#/work/samsung',{waitUntil:'domcontentloaded'});
 await p.locator('[data-samsung-workspace]').waitFor();
 await p.evaluate(()=>document.fonts.ready);return p;
}
async function state(p){return p.locator('[data-samsung-workspace]').evaluate(root=>({
 controls:root.querySelectorAll('[data-workspace-step],.samsung-workspace__controls').length,
 panes:[...root.querySelectorAll('[data-samsung-screen]')].map(el=>({id:el.dataset.samsungScreen,opacity:+getComputedStyle(el).opacity,transform:el.style.transform,width:el.style.width})),
 previews:[...root.querySelectorAll('[data-samsung-preview]')].map(el=>+getComputedStyle(el).opacity),
 overflow:document.documentElement.scrollWidth>innerWidth+1
}));}
async function phase(p,value){await p.locator('[data-samsung-workspace]').evaluate((root,v)=>scrollTo({top:scrollY+root.getBoundingClientRect().top+(root.offsetHeight-innerHeight)*v,behavior:'instant'}),value);await p.waitForTimeout(70);return state(p);}
const visible=s=>s.panes.filter(p=>p.opacity>.9).map(p=>p.id);
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  const desktop=await enter(browser,1440);const desktopFrames=[];
  for(const p of [.28,.60,1,.60,.28])desktopFrames.push(await phase(desktop,p));
  check('desktop workspace removes all three navigation buttons',desktopFrames.every(s=>s.controls===0));
  check('native desktop scroll preserves forward and reverse pane order',JSON.stringify(desktopFrames.map(visible))===JSON.stringify([['control'],['control','visitor'],['control','visitor','ai'],['control','visitor'],['control']]),desktopFrames);
  await desktop.screenshot({path:path.join(out,'desktop.png')});await desktop.close();
  const mobile=await enter(browser,390);await mobile.clock.install();
  await mobile.locator('.samsung-workspace__visual').evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top-(innerHeight-el.clientHeight)/2,behavior:'instant'}));
  const mobileFrames=[];for(let i=0;i<48;i++){await mobile.clock.runFor(100);mobileFrames.push(await state(mobile));}
  check('mobile workspace removes all three navigation buttons',mobileFrames.every(s=>s.controls===0));
  const stages=[...new Set(mobileFrames.map(s=>visible(s).length))];
  check('mobile automatically reaches control, visitor, then the final three panes',stages.includes(1)&&stages.includes(2)&&visible(mobileFrames.at(-1)).join(',')==='control,visitor,ai'&&mobileFrames.at(-1).previews.every(a=>a<.01),stages);
  check('mobile autoplay does not introduce horizontal overflow',mobileFrames.every(s=>!s.overflow));
  await mobile.screenshot({path:path.join(out,'mobile.png')});await mobile.close();
  const reduced=await enter(browser,390,'reduce');const final=await state(reduced);
  check('reduced motion exposes the final panes without navigation controls',final.controls===0&&visible(final).join(',')==='control,visitor,ai'&&final.previews.every(a=>a<.01)&&!final.overflow,final);
  await reduced.close();
  check('workspace paths produce no browser errors',errors.length===0,errors);
 }finally{await browser.close();}
 const hashes=Object.fromEntries(['samsung-workspace.js','samsung-workspace.css','hello-w-play/tests/samsung-workspace-autoplay.cjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',f))).digest('hex')]));
 const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({hashes,checks,failures},null,2));console.log(checks.length+' checks, '+failures.length+' failures',failures.map(f=>f.name));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
