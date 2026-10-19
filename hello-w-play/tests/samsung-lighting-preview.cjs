// Lighting remains a compact, undistorted asset while moving into the control pane.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.TEST_OUTPUT||'/tmp/samsung-lighting-preview';
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const checks=[],frames=[];const check=(name,pass,actual)=>checks.push({name,pass:!!pass,actual});
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const p=await browser.newPage({viewport:{width:1440,height:900}});await p.goto(base+'#/work/samsung',{waitUntil:'domcontentloaded'});await p.locator('[data-samsung-workspace]').waitFor();await p.evaluate(()=>document.fonts.ready);
for(const progress of [0,.08,.14,.17,.20,.23,.28,.45,.60,.78,.81,1]){
 await p.locator('[data-samsung-workspace]').evaluate((r,v)=>scrollTo({top:scrollY+r.getBoundingClientRect().top+(r.offsetHeight-innerHeight)*v,behavior:'instant'}),progress);await p.waitForTimeout(60);
 const sample=await p.locator('[data-samsung-workspace]').evaluate(root=>({
  previews:[...root.querySelectorAll('[data-samsung-preview]')].map(el=>{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return{id:el.dataset.samsungPreview,opacity:+getComputedStyle(el).opacity,width:el.offsetWidth*m.a,height:el.offsetHeight*m.d,x:m.e+el.offsetWidth*m.a/2,y:m.f+el.offsetHeight*m.d/2,transform:el.style.transform};}),
  panes:[...root.querySelectorAll('[data-samsung-screen]')].map(el=>({id:el.dataset.samsungScreen,opacity:+getComputedStyle(el).opacity,width:parseFloat(el.style.width),transform:el.style.transform})),overflow:document.documentElement.scrollWidth>innerWidth+1
 }));frames.push({progress,...sample});if([0,.14,.20,1].includes(progress))await p.screenshot({path:path.join(out,'desktop-'+progress+'.png')});
}
const light=frames.map(f=>f.previews.find(p=>p.id==='control')).filter(p=>p.opacity>.01),initial=light[0];
check('visible lighting preview retains its original compact size',light.every(p=>Math.abs(p.width-initial.width)<=1&&Math.abs(p.height-initial.height)<=1),light);
check('lighting preview moves continuously right before retiring',light.at(-1).x>initial.x+100&&light.every((p,i)=>i===0||p.x>=light[i-1].x-1),light.map(p=>p.x));
check('final three panes retain equal widths and retire previews',frames.at(-1).panes.every(p=>p.opacity>.99&&Math.abs(p.width-303.33)<.1)&&frames.at(-1).previews.every(p=>p.opacity<.01),frames.at(-1));
check('desktop motion introduces no horizontal overflow',frames.every(f=>!f.overflow));
}finally{await browser.close();}
const hashes=Object.fromEntries(['samsung-workspace.js','samsung-workspace.css','samsung-story.js','samsung-story.css','hello-w-play/tests/samsung-lighting-preview.cjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',f))).digest('hex')]));const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({hashes,checks,frames,failures},null,2));console.log(checks.length+' checks, '+failures.length+' failures',failures.map(c=>c.name));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
