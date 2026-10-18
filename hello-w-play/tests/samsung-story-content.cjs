// Story regression checks retain mobile/workspace content while the automation
// chapter embeds one persistent prototype. Interaction tests live separately.
const fs=require('node:fs'),path=require('node:path');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.TEST_BROWSER||'chromium';
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:8791/';
const out=process.env.TEST_OUTPUT||path.join(require('node:os').tmpdir(),'samsung-content-'+engine);
const checks=[],errors=[];
const check=(name,pass,actual)=>checks.push({name,pass:Boolean(pass),actual});
async function content(page) {
  const result = await page.evaluate(()=>{
    const normalize=s=>s.replace(/\s+/g,' ').trim();
    const elements=[...document.querySelectorAll('main h1,main h2,main p,main video,[data-samsung-workspace]')];
    const locate=text=>elements.findIndex(n=>normalize(n.textContent)===text);
    const markers=[locate('B2B AI Agent & Mobile AI Office'),locate('From monitoring to on-site control.'),elements.findIndex(n=>n.matches('video')),locate('Connected devices and visitor workflows, together in one workspace.'),locate('Every task. One workspace.'),locate('Complex data, clear decisions, on site'),locate('Business and product challenge'),locate('Define the automation boundary')];
    const workspace=document.querySelector('[data-samsung-workspace]');
    const headings=[...document.querySelectorAll('main h1,main h2')].map(n=>normalize(n.textContent));
    const delivery=headings.indexOf('Complex data, clear decisions, on site');
    const context=headings.indexOf('Business and product challenge');
    return {markers,headings,workspaceText:normalize(workspace?.textContent||''),chapter:headings.slice(delivery+1,context),smartThings:[...document.querySelectorAll('a')].find(n=>n.textContent.includes('SmartThings Pro Mobile'))?.href,smartThingsText:[...document.querySelectorAll('a')].find(n=>n.textContent.includes('SmartThings Pro Mobile'))?.parentElement.textContent,adoption:headings.some(t=>t==='From one-off fixes to shared updates'),request:!!document.querySelector('[data-copy-email]'),nav:[...document.querySelectorAll('nav[aria-label="Case navigation"] a')].map(n=>n.getAttribute('href')),h1s:document.querySelectorAll('main h1').length};
  });
  check('one Samsung H1 and requested story order',result.h1s===1&&result.markers.every((x,i)=>x>=0&&(!i||x>result.markers[i-1])),result);
  check('token validation is a separately introduced chapter after mobile delivery',result.chapter.some(t=>/token/i.test(t)&&/validat|governance|system/i.test(t)),result.chapter);
  check('workspace explains three-app multitasking, split panes, popups and switching context',[/three|3/i,/split|pane/i,/pop.?up/i,/web|brows/i,/message/i,/route|direction|navigat/i,/switch/i].every(re=>re.test(result.workspaceText)),result.workspaceText);
  check('SmartThings link, adoption, request action and case navigation survive',result.smartThings?.includes('com.samsung.space.pnpt.stpm')&&['workplace access','room and seat reservations','calendar syncing','visitor invitations','support requests','lighting and temperature control','company’s administrator','operating policies'].every(text=>result.smartThingsText?.includes(text))&&result.adoption&&result.request&&result.nav.length===2,result);
}
(async()=>{fs.mkdirSync(out,{recursive:true});const executablePath=process.env.BROWSER_EXECUTABLE||process.env[engine.toUpperCase()+'_EXECUTABLE'];const browser=await playwright[engine].launch({headless:true,...(executablePath?{executablePath}:{})});try{
for(const width of [1440,390,320])for(const motion of ['no-preference','reduce']){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:motion});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/work/samsung');const scene=page.locator('[data-samsung-governance]');await scene.waitFor();if(width===1440&&motion==='no-preference')await content(page);
 await scene.scrollIntoViewIfNeeded();await scene.locator('iframe').scrollIntoViewIfNeeded();const iframe=await (await scene.locator('iframe').elementHandle()).contentFrame();await iframe.waitForFunction(()=>/^\d+$/.test(document.querySelector('#score')?.textContent||''));await page.waitForTimeout(200);
 const s=await scene.evaluate(root=>{const r=root.getBoundingClientRect();return {background:getComputedStyle(root).backgroundColor,x:r.x,width:r.width,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,heading:root.querySelector('h2').textContent,copies:[...root.querySelectorAll('article')].map(n=>({text:n.textContent,hidden:n.getAttribute('aria-hidden'),display:getComputedStyle(n).display,opacity:getComputedStyle(n).opacity})),frames:root.querySelectorAll('iframe').length};});
 check(width+' '+motion+': black full-width chapter contains one working prototype',s.background==='rgb(0, 0, 0)'&&Math.abs(s.x)<2&&Math.abs(s.width-width)<2&&s.frames===1&&!s.overflow,s);
 check(width+' '+motion+': both explanations remain readable',s.copies.length===2&&s.copies.every(c=>c.text.length>100&&c.hidden!=='true'&&c.display!=='none'&&Number(c.opacity)===1),s.copies);
 await page.screenshot({path:path.join(out,width+'-'+motion+'.png')});await page.close();
}
check('no uncaught browser errors',errors.length===0,errors);
}finally{await browser.close()}const failures=checks.filter(c=>!c.pass);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,failures},null,2));console.log(checks.length+' checks, '+failures.length+' failures',failures.map(c=>c.name));if(failures.length)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1});
