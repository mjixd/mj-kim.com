// Independent behavioral contract for Meta's four-step scroll story.
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
    const images = [...root.querySelectorAll('.solution-visual img')];
    const shown = images.map((img,i) => visible(img) ? i : -1).filter(i => i >= 0);
    const selected = images[active];
    return { active, expanded:buttons.filter(b=>b.getAttribute('aria-expanded')==='true').length, shown,
      description: active >= 0 && visible(document.getElementById(buttons[active].getAttribute('aria-controls'))),
      filter:selected && getComputedStyle(selected).filter, imageLoaded:selected && selected.complete && selected.naturalWidth > 0,
      controls:buttons.map(rect), descriptionRect: active >= 0 && rect(document.getElementById(buttons[active].getAttribute('aria-controls'))),
      visual:rect(root.querySelector('.solution-visual')), text:rect(root.querySelector('.solution-list')),
      overflow:document.documentElement.scrollWidth > innerWidth + 1,
      src: selected && selected.getAttribute('src'), alt:selected && selected.alt };
  });
}
function matching(s) { return s.active >= 0 && s.expanded===1 && s.shown.length===1 && s.shown[0]===s.active && s.description && s.imageLoaded && s.src.endsWith(expected[s.active][1]) && s.alt === expected[s.active][0]; }
function sharp(s) { return s.filter === 'none' || s.filter === 'blur(0px)'; }
async function enter(page) { await page.goto(rootUrl + '#/work/meta'); await page.locator('.solution-accordion').waitFor(); }
async function renderedFrame(page, index) {
  return page.locator('.solution-visual img').nth(index).evaluate(image => {
    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
    return { opacity:+style.opacity, transform:style.transform, filter:style.filter, visibility:style.visibility,
      hidden:image.hidden, width:rect.width, height:rect.height, loaded:image.complete && image.naturalWidth>0 };
  });
}
async function motionChecks(page) {
  const controls = page.locator('.solution-toggle');
  if ((await state(page)).active !== 0) await controls.nth(0).click();
  await controls.nth(0).scrollIntoViewIfNeeded(); await pause(page);
  await controls.nth(1).click(); await page.waitForTimeout(80);
  const secondMidpoint = await renderedFrame(page,1);
  check('second scene visibly transitions before interruption',secondMidpoint.loaded && secondMidpoint.opacity>0 && secondMidpoint.opacity<1 && secondMidpoint.transform!=='none',secondMidpoint);
  // Select the third scene before the second scene's 420ms fade has completed.
  const interruptedOpacity = await controls.nth(2).evaluate(button => {
    const outgoing = button.closest('.solution-accordion').querySelectorAll('.solution-visual img')[1];
    const opacity = +getComputedStyle(outgoing).opacity;
    button.click();
    return opacity;
  });
  check('latest selection interrupts an unfinished rendered fade',interruptedOpacity>0 && interruptedOpacity<1,interruptedOpacity);
  await page.waitForTimeout(80);
  const thirdMidpoint = await renderedFrame(page,2);
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
    const root=button.closest('.solution-accordion'), image=root.querySelectorAll('.solution-visual img')[1], style=getComputedStyle(image);
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
    const result = await page.locator('.solution-panel').evaluate(panel=>({sticky:getComputedStyle(panel).position==='sticky',bottom:panel.getBoundingClientRect().bottom,height:innerHeight}));
    const s=await state(page);
    check('large text scene '+i+' is matched and does not clip in a sticky panel',s.active===i && matching(s) && !s.overflow && (!result.sticky || result.bottom<=result.height),result);
  }
  await page.screenshot({path:path.join(out,'meta-large-text.png')});
  await stylesheet.evaluate(style=>style.remove());
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
  if(process.env.TEST_FOCUS==='large-text') { await largeTextChecks(page); await finish(browser); return; }
  await motionChecks(page);
  if(process.env.TEST_FOCUS==='motion') { check('motion interruption produces no browser errors',errors.length===0,errors); await finish(browser); return; }
  const story = page.locator('.solution-accordion');
  check('four original titles and image assets preserved', JSON.stringify(await story.locator('.solution-toggle').allTextContents()).includes(expected[0][0]) && await story.locator('.solution-toggle').count()===4 && JSON.stringify(await story.locator('.solution-visual img').evaluateAll(images=>images.map(i=>[i.alt,i.getAttribute('src').split('/').pop()])))===JSON.stringify(expected));
  check('screen retains explicit full-case email request', /^mailto:mjkiminfo@gmail.com\?/.test(await story.locator('.solution-visual').getAttribute('href')));
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
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844}); await pause(page);
    const samples = await scrollSweep(page);
    check(width+' mobile scrolling visits all four scenes',JSON.stringify([...new Set(samples.map(s=>s.active))])==='[0,1,2,3]');
    for(let i=0;i<4;i++) {
      if ((await state(page)).active !== i) await story.locator('.solution-toggle').nth(i).click(); await pause(page);
      const s=await state(page);
      check(width+' mobile scene '+i+' is matched and fits viewport',s.active===i && matching(s) && sharp(s) && !s.overflow && s.visual.left>=-1 && s.visual.right<=width+1,s);
      const content=[s.visual,...s.controls,s.descriptionRect];
      check(width+' mobile scene '+i+' keeps screen, controls and text readable together',Math.min(...content.map(r=>r.top))>=-1 && Math.max(...content.map(r=>r.bottom))<=845 && (s.descriptionRect.top>=s.visual.bottom-1 || s.descriptionRect.bottom<=s.visual.top+1),content);
    }
    await page.screenshot({path:path.join(out,'meta-'+width+'.png')});
  }
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
  const reduced = await story.boundingBox();
  check('reduced motion avoids a long scroll runway',reduced.height<=1200,reduced.height);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:500}); await enter(page);
  for(let i=0;i<4;i++) { if ((await state(page)).active !== i) await story.locator('.solution-toggle').nth(i).click(); await pause(page); const s=await state(page); check('short viewport fallback scene '+i+' remains accessible',s.active===i&&matching(s)&&sharp(s)&&!s.overflow,s); }
  await largeTextChecks(page);
  check('navigation and resize produce no browser errors',errors.length===0,errors);
  await finish(browser);
})().catch(error=>{console.error(error);process.exit(1);});
