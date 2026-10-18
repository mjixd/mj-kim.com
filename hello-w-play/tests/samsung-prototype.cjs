// Independent observable contract, drafted before product edits. The public
// Tokenproof app must do real local validation and preserve human-review limits.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const engine = process.env.TEST_BROWSER || 'chromium';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-prototype-' + engine);
const checks=[], errors=[], requests=[];
function check(name, pass, actual) { checks.push({name,pass:Boolean(pass),actual}); if(process.env.TEST_VERBOSE)console.log(pass?'PASS':'FAIL',name); }
async function ready(frame) {
  await frame.waitForFunction(() => /^\d+$/.test(document.querySelector('#score')?.textContent||'') && !document.querySelector('#analyze')?.disabled);
}
async function value(frame, property) {
  return frame.frameLocator('#liveFrame').locator('.metric-card').first().evaluate((el,p)=>getComputedStyle(el)[p],property);
}
async function exercise(frame,label) {
  await ready(frame);
  const baseline=Number(await frame.locator('#score').textContent());
  const initialRadius=await value(frame,'borderRadius'),initialPadding=await value(frame,'paddingTop');
  check(label+': baseline has real rendered dashboard and bounded score',baseline>0&&baseline<=100&&parseFloat(initialRadius)>0,{baseline,initialRadius,initialPadding});
  await frame.locator('[data-tab="css"]').click();
  const source=await frame.locator('#editor').inputValue();
  await frame.locator('#token-2').selectOption('radius/large');
  await frame.waitForFunction(()=>!document.querySelector('#tokenEvidence').hidden&&document.querySelector('#tokenEvidence').textContent.includes('radius/large'));
  await ready(frame);
  const changed=Number(await frame.locator('#score').textContent()),radius=await value(frame,'borderRadius');
  check(label+': changing radius updates real preview',radius==='24px'&&radius!==initialRadius,{radius,initialRadius});
  const changedSource=await frame.locator('#editor').inputValue();
  check(label+': source records selected token',changedSource!==source&&changedSource.includes('border-radius: var(--radius-large)'),changedSource.slice(-300));
  check(label+': mismatch lowers score and produces evidence',changed<baseline&&(await frame.locator('#results').innerText()).includes('FAILED'),{baseline,changed});
  await frame.locator('#analyze').click();await ready(frame);
  check(label+': repeated QA is deterministic',Number(await frame.locator('#score').textContent())===changed);
  await frame.locator('#token-3').selectOption('spacing/xs');
  await frame.waitForFunction(()=>document.querySelector('#tokenEvidence').textContent.includes('spacing/xs'));await ready(frame);
  check(label+': second independent token changes preview and worsens conformance',await value(frame,'paddingTop')==='8px'&&Number(await frame.locator('#score').textContent())<changed,{padding:await value(frame,'paddingTop'),score:await frame.locator('#score').textContent()});
  await frame.locator('#restore').click();
  await frame.waitForFunction(()=>document.querySelector('#tokenEvidence').textContent.includes('기준 복구'));await ready(frame);
  await frame.locator('#analyze').click();await ready(frame);
  check(label+': restore and re-QA return original rendered values and score',Number(await frame.locator('#score').textContent())===baseline&&await value(frame,'borderRadius')===initialRadius&&await value(frame,'paddingTop')===initialPadding,{score:await frame.locator('#score').textContent(),radius:await value(frame,'borderRadius'),padding:await value(frame,'paddingTop')});
  const results=await frame.locator('#results').innerText(),coverage=await frame.locator('.coverage').innerText();
  check(label+': unresolved human judgments remain REVIEW after restore',results.includes('REVIEW')&&results.includes('수동 검토')&&/전체 WCAG|전체 인증/.test(coverage),{results:results.slice(0,300),coverage});
}
(async () => {
  fs.mkdirSync(out, {recursive:true});
  const browser = await playwright[engine].launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  try {
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/\/api\/|__agent|__project|localhost|figma-bridge/.test(r.url()))requests.push(r.url());});
      await page.goto(base+'#/work/samsung');
      const scene=page.locator('[data-samsung-governance]');await scene.waitFor();
      assert.equal(await scene.locator('iframe').count(),1,'Automation-boundary section must embed a working prototype instead of static screenshots');
      await scene.scrollIntoViewIfNeeded();
      const surface=scene.locator('iframe');await surface.scrollIntoViewIfNeeded();
      const info=await scene.evaluate(root=>({text:root.textContent,background:getComputedStyle(root).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,rect:root.getBoundingClientRect().toJSON(),width:innerWidth,images:[...root.querySelectorAll('img')].map(i=>i.src)}));
      check(width+': black section and automation explanations survive',info.background==='rgb(0, 0, 0)'&&info.text.includes('Define the automation boundary')&&info.text.includes('human')&&info.text.includes('baseline'),info);
      check(width+': original deck screenshots replaced without page overflow',!info.images.some(s=>/EN.*0[89]/.test(decodeURI(s)))&&!info.overflow&&Math.abs(info.rect.x)<2&&Math.abs(info.rect.width-width)<2,info);
      const link=scene.locator('a[target="_blank"]');
      check(width+': full-view prototype link is keyboard reachable and matches embedded app',await link.count()===1&&await link.getAttribute('href')===await surface.getAttribute('src')&&await link.isVisible());
      const frame=await (await surface.elementHandle()).contentFrame();
      await exercise(frame,width+' embedded');
      await page.waitForTimeout(150);
      const geometry=await frame.evaluate(()=>({viewport:innerHeight,height:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      check(width+': embedded app grows to content without nested page scrolling',geometry.height<=geometry.viewport+2&&geometry.scrollWidth<=geometry.width+1,geometry);
      const heightBefore=await surface.evaluate(f=>f.getBoundingClientRect().height);await page.waitForTimeout(250);
      check(width+': automatic frame height settles',Math.abs(await surface.evaluate(f=>f.getBoundingClientRect().height)-heightBefore)<2,{heightBefore,heightAfter:await surface.evaluate(f=>f.getBoundingClientRect().height)});
      await surface.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,width+'-embedded.png')});
      const fullURL=await link.evaluate(a=>a.href);
      const full=await browser.newPage({viewport:{width,height:900}});full.on('pageerror',e=>errors.push(e.message));await full.goto(fullURL);await ready(full);
      check(width+': standalone app fits viewport and exposes token controls',await full.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)&&await full.locator('#token-2').isVisible());
      if(width===390)await exercise(full,'390 full view');
      await full.screenshot({path:path.join(out,width+'-full.png')});await full.close();
      // Leaving and revisiting the route must release the old app and mount one fresh instance.
      await page.evaluate(()=>location.hash='#/about');await scene.waitFor({state:'detached'});
      await page.evaluate(()=>location.hash='#/work/samsung');await scene.waitFor();
      check(width+': route reentry creates exactly one prototype',await scene.locator('iframe').count()===1);
      await scene.scrollIntoViewIfNeeded();await surface.scrollIntoViewIfNeeded();
      const replacement=await (await surface.elementHandle()).contentFrame();await ready(replacement);
      check(width+': route reentry resets previous experiment',await replacement.locator('#token-2').inputValue()==='radius/medium');
      await page.close();
    }
    check('no uncaught browser errors',errors.length===0,errors);
    check('public app does not call private local services',requests.length===0,requests);
  } finally { await browser.close(); }
  const files=['samsung-governance.js','samsung-governance.css','tokenproof/index.html','tokenproof/public.css','tokenproof/public.js','hello-w-play/tests/samsung-prototype.cjs'];
  const hashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex')]));
  const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,hashes,checks,failures},null,2));
  console.log(`${checks.length} checks, ${failures.length} failures`,failures.map(c=>c.name));if(failures.length)process.exitCode=1;
})().catch(error => { fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({checks,errors,error:error.message},null,2)); console.error(error.message); process.exitCode = 1; });
