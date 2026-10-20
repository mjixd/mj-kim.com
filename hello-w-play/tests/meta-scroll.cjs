// Independent contract: desktop scroll story and mobile tap accordion.
const fs = require('fs');
const path = require('path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'meta-scroll-tests');
const rootUrl = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const expected = [
  ['CTA for Upcoming 1:1s', 'solution-upcoming.png'],
  ['Event details with 1:1 notes', 'solution-event-notes.png'],
  ['Quick editor', 'solution-quick-editor.png'],
  ['Discover & Add your 1:1s', 'solution-discover.png'],
];
const checks = [], errors = [];
function check(name, pass, actual) { checks.push({ name, pass: !!pass, actual }); }
const pause = page => page.waitForTimeout(550);
async function state(page) {
  return page.locator('.solution-accordion').evaluate(root => {
    const buttons = [...root.querySelectorAll('.solution-toggle')];
    const active = buttons.findIndex(button => button.getAttribute('aria-expanded') === 'true');
    const rect = node => { const r = node.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height }; };
    const visible = node => { const style = getComputedStyle(node); return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && +style.opacity > .95; };
    const images = [...root.querySelectorAll('.solution-visual .solution-scene')];
    const shown = images.map((img,i) => visible(img) ? i : -1).filter(i => i >= 0);
    const selected = images[active];
    return { active, expanded:buttons.filter(b=>b.getAttribute('aria-expanded')==='true').length, shown,
      description: active >= 0 && visible(document.getElementById(buttons[active].getAttribute('aria-controls'))),
      filter:selected && getComputedStyle(selected).filter, imageLoaded:selected && selected.getBoundingClientRect().width > 0 && selected.textContent.trim().length > 0,
      controls:buttons.map(rect), descriptionRect: active >= 0 && rect(document.getElementById(buttons[active].getAttribute('aria-controls'))),
      visual:rect(root.querySelector('.solution-visual')), text:rect(root.querySelector('.solution-list')),
      overflow:document.documentElement.scrollWidth > innerWidth + 1,
      src: selected && selected.dataset.scene, alt:selected && selected.getAttribute('aria-label') };
  });
}
function matching(s) { return s.active >= 0 && s.expanded===1 && s.shown.length===1 && s.shown[0]===s.active && s.description && s.imageLoaded && s.src === String(s.active) && s.alt === expected[s.active][0]; }
function sharp(s) { return s.filter === 'none' || s.filter === 'blur(0px)'; }
async function enter(page) { await page.goto(rootUrl + '#/work/meta'); await page.locator('.solution-accordion').waitFor(); }
async function introChecks(page) {
  const copy = 'Recurring check-ins, mid-cycle, performance, and career conversations in a familiar flow. Meetings as the entry point, so preparation and follow-up became part of everyday work.';
  for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:width===1440?1000:844}); await enter(page); await pause(page);
    const root=page.locator('.solution-accordion'), heading=page.getByRole('heading',{name:'Workflow integration',exact:true});
    check(width+' workflow title and original introduction belong to scroll story',await root.locator('h2').filter({hasText:'Workflow integration'}).count()===1 && (await root.textContent()).includes(copy));
    if(width<=820) {
      await introFallbackCheck(page,width+' mobile');
      await root.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(out,'meta-intro-'+width+'.png')});
      continue;
    }
    const entry=await root.evaluate(root=>{
      const sticky=[root,...root.querySelectorAll('*')].find(node=>getComputedStyle(node).position==='sticky');
      return {top:root.getBoundingClientRect().top+scrollY,offset:sticky?parseFloat(getComputedStyle(sticky).top):0};
    });
    await page.evaluate(y=>scrollTo(0,y),entry.top-entry.offset+20); await pause(page);
    const before=await heading.boundingBox(), first=await state(page);
    const shared=await heading.evaluate(heading=>{
      let node=heading.parentElement;
      while(node && getComputedStyle(node).position!=='sticky') node=node.parentElement;
      const description=heading.nextElementSibling, visual=document.querySelector('.solution-visual');
      return !!node && node.contains(visual) && !!description && node.contains(description);
    });
    check(width+' title and introduction share first scene sticky surface',shared && first.active===0 && matching(first));
    const headerBottom=await page.locator('.nav').evaluate(nav=>nav.getBoundingClientRect().bottom);
    check(width+' first scene starts below header with visible title and screen',before.y>=headerBottom-1 && first.visual.bottom<=(width===1440?1000:844)+1,{heading:before,visual:first.visual,headerBottom});
    await page.evaluate(()=>scrollBy(0,80)); await pause(page);
    const after=await heading.boundingBox(), next=await state(page);
    check(width+' title remains pinned with screen throughout first readable hold',Math.abs(after.y-before.y)<2 && Math.abs(next.visual.top-first.visual.top)<2 && next.active===0,{headingBefore:before.y,headingAfter:after.y,screenBefore:first.visual.top,screenAfter:next.visual.top});
    await page.screenshot({path:path.join(out,'meta-intro-'+width+'.png')});
  }
  await page.setViewportSize({width:1440,height:1000}); await enter(page);
}
async function introFallbackCheck(page, label) {
  const result=await page.getByRole('heading',{name:'Workflow integration',exact:true}).evaluate(heading=>{
    let node=heading.parentElement, sticky=false;
    while(node) { if(getComputedStyle(node).position==='sticky') sticky=true; node=node.parentElement; }
    return {inside:!!heading.closest('.solution-accordion'),sticky,description:heading.nextElementSibling?.textContent};
  });
  check(label+' retains workflow introduction in an unpinned accessible story',result.inside && !result.sticky && result.description?.startsWith('Recurring check-ins,'),result);
}
async function renderedFrame(page, index) {
  return page.locator('.solution-visual .solution-scene').nth(index).evaluate(image => {
    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
    return { opacity:+style.opacity, transform:style.transform, filter:style.filter, visibility:style.visibility,
      hidden:image.hidden, width:rect.width, height:rect.height, loaded:image.getBoundingClientRect().width>0 && image.textContent.trim().length>0 };
  });
}
// Sample the first rendered midpoint instead of assuming a frame has painted at 80ms.
// This still fails if a transition jumps straight to its endpoint or never starts.
async function transitionFrame(page, index) {
  const deadline = Date.now() + 600;
  let frame;
  do {
    frame = await renderedFrame(page, index);
    if (frame.opacity > 0 && frame.opacity < 1) return frame;
    await page.waitForTimeout(16);
  } while (Date.now() < deadline);
  return frame;
}
async function motionChecks(page) {
  const controls = page.locator('.solution-toggle');
  if ((await state(page)).active !== 0) await controls.nth(0).click();
  await controls.nth(0).scrollIntoViewIfNeeded(); await pause(page);
  await controls.nth(1).click();
  const secondMidpoint = await transitionFrame(page,1);
  check('second scene visibly transitions before interruption',secondMidpoint.loaded && secondMidpoint.opacity>0 && secondMidpoint.opacity<1 && secondMidpoint.transform!=='none',secondMidpoint);
  // Select the third scene before the second scene's 420ms fade has completed.
  const interruptedOpacity = await controls.nth(2).evaluate(button => {
    const outgoing = button.closest('.solution-accordion').querySelectorAll('.solution-visual .solution-scene')[1];
    const opacity = +getComputedStyle(outgoing).opacity;
    button.click();
    return opacity;
  });
  check('latest selection interrupts an unfinished rendered fade',interruptedOpacity>0 && interruptedOpacity<1,interruptedOpacity);
  const thirdMidpoint = await transitionFrame(page,2);
  check('latest scene visibly transitions after rapid selection',thirdMidpoint.loaded && thirdMidpoint.opacity>0 && thirdMidpoint.opacity<1 && thirdMidpoint.transform!=='none',thirdMidpoint);
  await page.screenshot({path:path.join(out,'meta-transition-midpoint.png')});
  await pause(page);
  const endpoint = await renderedFrame(page,2), finalState = await state(page);
  check('interrupted transition settles on latest scene with full opacity and no transform',finalState.active===2 && matching(finalState) && sharp(finalState) && endpoint.opacity===1 && endpoint.transform==='none',endpoint);
  await page.screenshot({path:path.join(out,'meta-transition-endpoint.png')});
  await page.emulateMedia({reducedMotion:'reduce'}); await pause(page);
  // Observe synchronously after activation, before any animation frame can run.
  const immediate = await controls.nth(1).evaluate(button => {
    button.click();
    const root=button.closest('.solution-accordion'), image=root.querySelectorAll('.solution-visual .solution-scene')[1], style=getComputedStyle(image);
    return {expanded:button.getAttribute('aria-expanded'),hidden:image.hidden,opacity:+style.opacity,transform:style.transform,filter:style.filter,visibility:style.visibility};
  });
  check('reduced motion selection is fully rendered immediately',immediate.expanded==='true' && !immediate.hidden && immediate.opacity===1 && immediate.transform==='none' && immediate.filter==='none' && immediate.visibility==='visible',immediate);
  await page.screenshot({path:path.join(out,'meta-transition-reduced.png')});
  await page.emulateMedia({reducedMotion:'no-preference'}); await pause(page);
}
async function largeTextChecks(page) {
  await page.setViewportSize({width:390,height:740}); await enter(page);
  await page.evaluate(()=>document.fonts.ready);
  const stylesheet = await page.addStyleTag({content:'.solution-item .solution-description{font-size:24px!important;line-height:1.55!important}.solution-mobile-title{font-size:28px!important}'});
  await page.evaluate(()=>{window.scrollTo(0,0);window.dispatchEvent(new Event('resize'));});
  await page.locator('.solution-accordion').evaluate(root=>root.scrollIntoView({block:'start'}));
  await pause(page);
  for(let i=0;i<4;i++) {
    const control=page.locator('.solution-toggle').nth(i);
    if((await state(page)).active!==i) await control.click();
    await pause(page);
    const result = await page.locator('.solution-panel').evaluate(panel=>{
      let sticky=panel;
      while(sticky && getComputedStyle(sticky).position!=='sticky') sticky=sticky.parentElement;
      return {sticky:!!sticky,bottom:(sticky||panel).getBoundingClientRect().bottom,height:innerHeight};
    });
    const s=await state(page);
    check('large text scene '+i+' is matched and does not clip in a sticky panel',s.active===i && matching(s) && !s.overflow && (!result.sticky || result.bottom<=result.height),result);
  }
  await page.screenshot({path:path.join(out,'meta-large-text.png')});
  await stylesheet.evaluate(style=>style.remove());
}
async function mobileAccordionChecks(page) {
  for(const width of [390,320,820]) {
    await page.setViewportSize({width,height:844}); await enter(page); await pause(page);
    const story=page.locator('.solution-accordion'), controls=story.locator('.solution-toggle');
    await controls.first().scrollIntoViewIfNeeded(); await pause(page);
    const layout=await story.evaluate(root=>({
      sticky:[root,...root.querySelectorAll('*')].some(node=>['sticky','fixed'].includes(getComputedStyle(node).position)),
      height:root.getBoundingClientRect().height, content:root.querySelector('.solution-stage').getBoundingClientRect().height,
      titles:[...root.querySelectorAll('.solution-label')].map(node=>({text:node.textContent,visible:node.getBoundingClientRect().height>0 && getComputedStyle(node).visibility!=='hidden'}))
    }));
    check(width+' mobile accordion has no sticky scene or extra scroll runway',!layout.sticky && Math.abs(layout.height-layout.content)<2,layout);
    check(width+' mobile displays all four title controls',layout.titles.every((title,i)=>title.visible && title.text===expected[i][0]),layout.titles);
    for(let i=0;i<4;i++) {
      if((await state(page)).active!==i) await controls.nth(i).click();
      await pause(page);
      const s=await state(page);
      check(width+' tap '+i+' opens matching description and image',s.active===i && matching(s) && sharp(s) && !s.overflow && s.visual.left>=-1 && s.visual.right<=width+1,s);
      await controls.nth(i).click(); await pause(page);
      const collapsed=await story.evaluate(root=>({
        expanded:[...root.querySelectorAll('.solution-toggle')].filter(b=>b.getAttribute('aria-expanded')==='true').length,
        visibleDescriptions:[...root.querySelectorAll('.solution-description')].filter(p=>!p.hidden && getComputedStyle(p).display!=='none').length
      }));
      check(width+' repeated tap '+i+' collapses its description',collapsed.expanded===0 && collapsed.visibleDescriptions===0,collapsed);
    }
    await controls.nth(1).click(); await pause(page);
    const samples=await scrollSweep(page);
    check(width+' document scrolling preserves tapped selection',samples.every(s=>s.active===1 && s.expanded===1),samples.map(s=>s.active));
    await controls.nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'meta-'+width+'.png')});
  }
  await page.setViewportSize({width:1024,height:1000}); await pause(page);
  const desktop=await scrollSweep(page);
  check('820 to 1024 resize restores all desktop scroll scenes',JSON.stringify([...new Set(desktop.map(s=>s.active))])==='[0,1,2,3]');
  await page.setViewportSize({width:390,height:844}); await pause(page);
  const story=page.locator('.solution-accordion');
  const layout=await story.evaluate(root=>({sticky:[root,...root.querySelectorAll('*')].some(node=>getComputedStyle(node).position==='sticky'),height:root.offsetHeight,content:root.querySelector('.solution-stage').offsetHeight}));
  check('desktop to mobile resize removes pinned scene and runway',!layout.sticky && Math.abs(layout.height-layout.content)<2,layout);
  const control=story.locator('.solution-toggle').nth(2);
  if((await state(page)).active!==2) await control.click();
  await control.click(); await pause(page);
  check('desktop to mobile resize restores repeat-tap collapse',(await state(page)).expanded===0);
}
async function finish(browser) {
  await browser.close();
  const result={checks,failures:checks.filter(c=>!c.pass)};
  fs.writeFileSync(path.join(out,'meta-scroll-results.json'),JSON.stringify(result,null,2));
  console.log(`${checks.length} checks, ${result.failures.length} failures`,result.failures.map(c=>c.name));
  if(result.failures.length) process.exitCode=1;
}
async function scrollSweep(page, reverse = false) {
  const bounds = await page.locator('.solution-accordion').evaluate(root=>({top:root.getBoundingClientRect().top+scrollY,height:root.getBoundingClientRect().height,vh:innerHeight}));
  const steps = 24, values = [];
  for(let i=0;i<=steps;i++) {
    const fraction = (reverse ? steps-i : i)/steps;
    await page.evaluate(y=>window.scrollTo(0,y), bounds.top - bounds.vh * .12 + fraction * Math.max(bounds.height - bounds.vh*.5, bounds.vh));
    await page.waitForTimeout(100);
    let sample = await state(page);
    if (!values.length || sample.active !== values[values.length-1].active) {
      await pause(page);
      sample = { ...await state(page), settled: true };
    }
    values.push(sample);
  }
  await pause(page);
  return values;
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const engine = process.env.TEST_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({headless:true,...(engine === chromium && process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE}: {})});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await enter(page);
  if(process.env.TEST_FOCUS==='mobile-accordion') { await mobileAccordionChecks(page); check('mobile accordion produces no browser errors',errors.length===0,errors); await finish(browser); return; }
  if(process.env.TEST_FOCUS==='intro') { await introChecks(page); check('intro entry produces no browser errors',errors.length===0,errors); await finish(browser); return; }
  if(process.env.TEST_FOCUS==='large-text') { await largeTextChecks(page); await finish(browser); return; }
  await motionChecks(page);
  if(process.env.TEST_FOCUS==='motion') { check('motion interruption produces no browser errors',errors.length===0,errors); await finish(browser); return; }
  await introChecks(page);
  const story = page.locator('.solution-accordion');
  check('four original titles and native scenes preserved', JSON.stringify(await story.locator('.solution-toggle').allTextContents()).includes(expected[0][0]) && await story.locator('.solution-toggle').count()===4 && JSON.stringify(await story.locator('.solution-visual .solution-scene').evaluateAll(scenes=>scenes.map(s=>[s.getAttribute('aria-label'),s.dataset.scene])))===JSON.stringify(expected.map((v,i)=>[v[0],String(i)])));
  check('native demonstration does not open mail', await story.locator('.solution-visual').getAttribute('href') === null);
  const forward = await scrollSweep(page);
  const sequence = [...new Set(forward.map(s=>s.active))];
  check('forward scrolling visits all four solutions in order', JSON.stringify(sequence) === '[0,1,2,3]', sequence);
  check('every forward scroll transition settles on matching sharp content', forward.filter(s=>s.settled).every(s=>matching(s)&&sharp(s)));
  check('every scroll scene has a readable hold',expected.every((_,i)=>forward.filter(s=>s.active===i).length>=3),expected.map((_,i)=>forward.filter(s=>s.active===i).length));
  const settled = await state(page);
  check('last scroll scene settles with matching sharp image and description', matching(settled) && sharp(settled),settled);
  const ratio = settled.text.width/(settled.text.width+settled.visual.width);
  check('desktop keeps approximately 25:75 text and screen columns', Math.abs(ratio-.25)<.03,ratio);
  const middle = forward.filter(s=>s.active===1 || s.active===2);
  check('screen stays pinned through middle scenes', middle.length>=4 && Math.max(...middle.map(s=>s.visual.top))-Math.min(...middle.map(s=>s.visual.top))<4,middle.map(s=>s.visual.top));
  const backward = await scrollSweep(page,true);
  check('reverse scrolling visits all four solutions in reverse order',JSON.stringify([...new Set(backward.map(s=>s.active))])==='[3,2,1,0]',[...new Set(backward.map(s=>s.active))]);
  for(let i=0;i<4;i++) {
    if ((await state(page)).active !== i) await story.locator('.solution-toggle').nth(i).click(); await pause(page);
    const s=await state(page); check('desktop explicit control '+i+' selects matching sharp scene',s.active===i && matching(s) && sharp(s),s);
  }
  await story.locator('.solution-toggle').nth(1).focus(); await page.keyboard.press('Enter'); await pause(page);
  check('keyboard Enter selects second scene',(await state(page)).active===1);
  await story.locator('.solution-toggle').nth(2).focus(); await page.keyboard.press('Space'); await pause(page);
  check('keyboard Space selects third scene',(await state(page)).active===2);
  await page.screenshot({path:path.join(out,'meta-desktop.png')});
  await mobileAccordionChecks(page);
  await page.setViewportSize({width:1440,height:1000}); await pause(page);
  const resized = await scrollSweep(page);
  check('mobile to desktop resize restores all scroll scenes',JSON.stringify([...new Set(resized.map(s=>s.active))])==='[0,1,2,3]');
  for(let i=0;i<3;i++) {
    await page.evaluate(()=>location.hash='#/work/domino-mvp'); await page.locator('.solution-accordion').waitFor({state:'detached'});
    await page.evaluate(()=>window.scrollTo(0,900)); await page.setViewportSize({width:i===1?1280:1440,height:1000});
    await page.evaluate(()=>location.hash='#/work/meta'); await story.waitFor();
    const samples=await scrollSweep(page);
    check('route reentry '+i+' restores scroll scene sequence',JSON.stringify([...new Set(samples.map(s=>s.active))])==='[0,1,2,3]');
  }
  await page.emulateMedia({reducedMotion:'reduce'}); await pause(page);
  check('live reduced-motion change retains a sharp matched scene',matching(await state(page)) && sharp(await state(page)));
  await enter(page);
  for(let i=0;i<4;i++) { if ((await state(page)).active !== i) await story.locator('.solution-toggle').nth(i).click(); await pause(page); const s=await state(page); check('reduced motion scene '+i+' stays accessible and sharp',s.active===i&&matching(s)&&sharp(s),s); }
  await story.locator('.solution-toggle').nth(3).click(); await pause(page);
  check('reduced motion retains normal repeat-tap accordion collapse',(await state(page)).expanded===0);
  await story.locator('.solution-toggle').nth(1).click(); await pause(page);
  const reducedSamples=await scrollSweep(page);
  check('reduced motion document scrolling preserves tapped selection',reducedSamples.every(s=>s.active===1));
  await introFallbackCheck(page,'reduced motion');
  const reduced = await story.boundingBox();
  check('reduced motion avoids a long scroll runway',reduced.height<=1200,reduced.height);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:500}); await enter(page);
  for(let i=0;i<4;i++) { if ((await state(page)).active !== i) await story.locator('.solution-toggle').nth(i).click(); await pause(page); const s=await state(page); check('short viewport fallback scene '+i+' remains accessible',s.active===i&&matching(s)&&sharp(s)&&!s.overflow,s); }
  await introFallbackCheck(page,'short viewport');
  await largeTextChecks(page);
  check('navigation and resize produce no browser errors',errors.length===0,errors);
  await finish(browser);
})().catch(error=>{console.error(error);process.exit(1);});
