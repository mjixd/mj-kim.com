// Independent visual-behavior contracts for the Samsung surface polish.
// Asset/Figma blur and crop fidelity additionally require visual readback.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-surface-polish');
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({name, pass:!!pass, actual});
const rgb = color => (color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
const neutral = color => { const v=rgb(color); return v.length===3 && Math.max(...v)-Math.min(...v)<=12; };
const brightness = color => rgb(color).reduce((a,b)=>a+b,0)/3;
async function scrollSection(page, selector) {
  await page.locator(selector).first().evaluate(el=>scrollTo({top:scrollY+el.getBoundingClientRect().top+80,behavior:'instant'}));
  await page.waitForTimeout(320);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  for (const width of [1440,390]) {
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('theme','light'));
   await page.goto(base+'#/work/samsung');
   await page.locator('[data-samsung-governance]').waitFor();
   const copy=await page.evaluate(()=>({text:document.querySelector('main').textContent,headings:[...document.querySelectorAll('.samsung-governance__heading h2,.samsung-governance__heading p')].map(el=>({text:el.textContent,align:getComputedStyle(el).textAlign}))}));
   check(width+': requested obsolete copy removed',!copy.text.includes('SmartThings Pro mobile workflows with an AI-assisted workspace concept.')&&!copy.text.includes('2 Operating model'),copy.headings);
   check(width+': automation title and instruction centered',copy.headings.length===2&&copy.headings.every(h=>h.align==='center'),copy.headings);
   await scrollSection(page,'[data-samsung-workspace]');
   const panes=await page.locator('[data-samsung-screen]').evaluateAll(nodes=>nodes.map(el=>{
    const css=n=>{const s=getComputedStyle(n);return {bg:s.backgroundColor,opacity:s.opacity,filter:s.filter,blur:s.backdropFilter};};
    const surface=[css(el),...['::before','::after'].map(p=>{const s=getComputedStyle(el,p);return {bg:s.backgroundColor,opacity:s.opacity,filter:s.filter,blur:s.backdropFilter};})];
    return {id:el.dataset.samsungScreen,surface,content:[...el.querySelectorAll('b,p')].map(css)};
   }));
   check(width+': three pane backgrounds use 80% fill and 20px backdrop blur',panes.length===3&&panes.every(p=>p.surface.some(s=>/rgba\([^)]*,\s*0\.8\)/.test(s.bg)&&s.blur==='blur(20px)'&&s.opacity==='1'&&s.filter==='none')),panes);
   check(width+': text content remains opaque and unfiltered',panes.every(p=>p.content.length&&p.content.every(s=>s.opacity==='1'&&s.filter==='none')),panes);
   const wallpaper=await page.locator('.sw-wallpaper').evaluate(el=>({image:getComputedStyle(el).backgroundImage,size:getComputedStyle(el).backgroundSize,position:getComputedStyle(el).backgroundPosition}));
   check(width+': middle device background uses a centered aspect-fill image',wallpaper.image.includes('url(')&&wallpaper.size==='cover'&&wallpaper.position==='50% 50%',wallpaper);
   await scrollSection(page,'[data-samsung-governance]');
   const frame=await (await page.locator('[data-samsung-governance] iframe').elementHandle()).contentFrame();
   await frame.waitForFunction(()=>/^\d+$/.test(document.querySelector('#score')?.textContent||''));
   const controls=await frame.locator('button,select').evaluateAll(nodes=>nodes.map(el=>{const s=getComputedStyle(el);return {id:el.id||el.textContent.trim().slice(0,32),kind:el.tagName,border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],radius:s.borderRadius,padding:s.paddingRight,appearance:s.appearance,image:s.backgroundImage,position:s.backgroundPosition};}));
   check(width+': all prototype buttons and dropdowns are borderless pills',controls.length>10&&controls.every(c=>c.border.every(w=>w==='0px')&&parseFloat(c.radius)>=999),controls.filter(c=>!c.border.every(w=>w==='0px')||parseFloat(c.radius)<999));
   check(width+': dropdown custom arrows reserve right inset',controls.filter(c=>c.kind==='SELECT').every(c=>parseFloat(c.padding)>=28&&c.appearance==='none'&&c.image!=='none'&&c.position!=='100% 50%'),controls.filter(c=>c.kind==='SELECT'));
   const surfaces=await frame.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,panels:['.source','.preview','.inspector','.canvas','.score-area'].map(selector=>({selector,color:getComputedStyle(document.querySelector(selector)).backgroundColor}))}));
   check(width+': prototype panels use neutral tones lighter than outer background',neutral(surfaces.body)&&surfaces.panels.every(p=>neutral(p.color)&&brightness(p.color)>brightness(surfaces.body)),surfaces);
   check(width+': main source, live, and conformance surfaces have coherent tones',Math.max(...surfaces.panels.slice(0,3).map(p=>brightness(p.color)))-Math.min(...surfaces.panels.slice(0,3).map(p=>brightness(p.color)))<=20,surfaces);
   await page.screenshot({path:path.join(out,width+'-surface.png')});
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
  await page.addInitScript(()=>localStorage.setItem('theme','light'));
  await page.goto(base+'#/work/samsung');
  const header=()=>page.locator('#nav').evaluate(el=>{const s=getComputedStyle(el),p=getComputedStyle(el,'::before');return {color:s.color,bg:p.backgroundColor,transition:[s.transitionDuration,p.transitionDuration],theme:document.documentElement.dataset.theme};});
  await scrollSection(page,'[aria-label="SmartThings Pro Mobile overview"]');const light=await header();
  await scrollSection(page,'[data-samsung-governance]');const dark=await header();
  await scrollSection(page,'[aria-label="SmartThings Pro Mobile overview"]');const restored=await header();
  check('header adapts light to dark and back within 320ms without changing page theme',brightness(light.color)<100&&brightness(dark.color)>180&&restored.color===light.color&&[light,dark,restored].every(h=>h.theme==='light'),{light,dark,restored});
  check('header color change is smoothly animated and quick',dark.transition.some(t=>t.split(',').some(v=>parseFloat(v)>0&&parseFloat(v)<=.3)),dark);
  await page.close();
  check('no browser errors',errors.length===0,errors);
 } finally {await browser.close();}
 const files=['index.html','samsung-story.js','samsung-workspace.js','samsung-workspace.css','samsung-governance.js','samsung-governance.css','tokenproof/public.css'];
 const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',f))).digest('hex')]));
 const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({hashes,checks,failures},null,2));
 console.log(checks.length+' checks, '+failures.length+' failures',failures.map(c=>c.name));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
