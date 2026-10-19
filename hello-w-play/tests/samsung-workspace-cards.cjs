// Independent behavioral contract for the later Samsung workspace sequence.
// Run alongside samsung-story.cjs, which owns the separate unfolding hero.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TEST_BROWSER || 'webkit';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8789/';
const out = process.env.TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'samsung-workspace-' + engine);
const rootSelector = '[data-samsung-workspace]';
const names = ['control', 'visitor', 'ai'];
const labels = ['Control Devices', 'Visitor Invitation', 'AI Agent'];
// Compact export bounds; AI includes the rendered glow.
const previewSize={control:{width:390,height:227},visitor:{width:424.614868,height:197},ai:{width:456.011719,height:239.132813}};
const sceneBaseline={1440:{initial:479.424438,final:479.424438},390:{initial:235.103455,final:313.159485},320:{initial:188.082764,final:264.776672}};
const continuityProgress=[0,.08,.14,.17,.20,.23,.28,.39,.45,.48,.51,.54,.60,.72,.78,.81,.84,.87,1];
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({name, pass: Boolean(pass), actual});
const pause = page => page.waitForTimeout(300);
async function enter(page) {
  await page.goto(base + '#/work/samsung');
  await page.locator(rootSelector).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await pause(page);
}
async function phase(page, p) {
  await page.locator(rootSelector).evaluate((root, p) => scrollTo({top: scrollY + root.getBoundingClientRect().top + Math.max(0, root.offsetHeight - innerHeight) * p, behavior:'instant'}), p);
  await pause(page);
}
async function snapshot(page) {
  return page.locator(rootSelector).evaluate(root => {
    const alpha = el => { let a=1; for(let n=el;n;n=n.parentElement){const c=getComputedStyle(n);if(c.display==='none'||c.visibility==='hidden')return 0;a*=Number(c.opacity);}return a; };
    const scale=el=>{const m=new DOMMatrixReadOnly(getComputedStyle(el).transform);return {x:Math.hypot(m.a,m.b),y:Math.hypot(m.c,m.d)};};
    const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const anchor=el=>{if(el.dataset.samsungScreen==='ai')return rect(el.querySelector('.sw-composer'));if(el.dataset.samsungScreen==='visitor'){const a=rect(el.querySelector('.sw-month')),b=rect(el.querySelector('.sw-dates'));return {...a,height:b.bottom-a.y};}return rect(el);};
    return {
      allImagesDecoded:[...root.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),
      visual:rect(root.querySelector('.samsung-workspace__visual')),
      clipMargin:parseFloat(getComputedStyle(root.querySelector('.samsung-workspace__visual')).overflowClipMargin)||0,
      canvasScale:scale(root.querySelector('.samsung-workspace__canvas')),
      shell:root.querySelector('.samsung-workspace__device')?rect(root.querySelector('.samsung-workspace__device')):null,chrome:root.querySelectorAll('.sw-status').length,gesture:root.querySelectorAll('.sw-gesture').length,
      height:root.offsetHeight, viewport:innerHeight, width:innerWidth, scrollY,
      sticky:getComputedStyle(root.querySelector('[data-samsung-stage]')||root.firstElementChild).position,
      overflow:document.documentElement.scrollWidth > innerWidth+1,
      previews:[...root.querySelectorAll('[data-samsung-preview]')].map(el=>({id:el.dataset.samsungPreview,alpha:alpha(el),transform:getComputedStyle(el).transform,rect:rect(el),images:[...el.querySelectorAll('img'),...(el.matches('img')?[el]:[])].map(img=>({src:img.getAttribute('src'),alt:img.alt,loaded:img.complete&&img.naturalWidth>0,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,rect:rect(img)}))})),
      defaultImages:[...root.querySelectorAll('.samsung-workspace__device img')].map(img=>({wallpaper:img.classList.contains('sw-default-wallpaper'),src:img.getAttribute('src'),alt:img.alt,loaded:img.complete&&img.naturalWidth>0,alpha:alpha(img),rect:rect(img)})),
      cards:[...root.querySelectorAll('[data-samsung-screen]')].map(el=>({id:el.dataset.samsungScreen,anchor:anchor(el),scale:scale(el),text:el.textContent.trim(),label:el.getAttribute('aria-label'),alpha:alpha(el),transform:getComputedStyle(el).transform,rect:rect(el),hidden:el.getAttribute('aria-hidden'),images:[...el.querySelectorAll('img'),...(el.matches('img')?[el]:[])].map(img=>({src:img.getAttribute('src'),alt:img.alt,loaded:img.complete&&img.naturalWidth>0,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,fit:getComputedStyle(img).objectFit,rect:rect(img)}))})),
      buttons:[...root.querySelectorAll('button')].map(el=>({label:el.textContent.trim()||el.getAttribute('aria-label'),pressed:el.getAttribute('aria-pressed'),selected:el.getAttribute('aria-selected'),rect:rect(el)})),
      copy:[...root.querySelectorAll('h2,p,button')].filter(el=>alpha(el)>.9).map(el=>({text:el.textContent.trim(),...rect(el)})),
    };
  });
}
const signature = s => JSON.stringify({cards:s.cards.map(({id,alpha,transform,hidden})=>({id,alpha,transform,hidden})),previews:s.previews.map(({id,alpha,transform})=>({id,alpha,transform})),defaultImages:s.defaultImages.map(({src,alpha})=>({src,alpha}))});
const card = (s,id) => s.cards.find(c=>c.id===id);
function decoded(s) { return s.allImagesDecoded&&s.cards.every(c=>c.images.every(i=>i.loaded)); }
function undistorted(s) { return Math.abs(s.canvasScale.x-s.canvasScale.y)<.001&&s.cards.every(c=>Math.abs(c.scale.x-c.scale.y)<.001&&c.images.every(i=>i.src.endsWith('.svg')||['contain','cover','scale-down'].includes(i.fit)||Math.abs(i.rect.width/i.rect.height-i.naturalWidth/i.naturalHeight)<.02)); }
function active(s,id) {
  const c=card(s,id); if(!c || c.alpha<.9 || c.hidden==='true')return false;
  const marked=s.buttons.find(b=>b.pressed==='true'||b.selected==='true');
  return !marked || marked.label.toLowerCase().includes(labels[names.indexOf(id)].toLowerCase());
}
async function capture(page,label) { await page.screenshot({path:path.join(out,label+'.png')}); }
// Exercise the public mount contract with deterministic scroll, RAF and media
// inputs. The expected pane counts/order come from the user contract, not paint().
function unitChecks() {
  const source=fs.readFileSync(path.resolve(__dirname,'../../samsung-workspace.js'),'utf8');
  const vm=require('node:vm');
  function fixture(reduced=false,width=1440) {
    let top=0,nextId=0,now=0,observe;const jobs=new Map(),listeners=new Map();
    const eventTarget={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
    const node=()=>({style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
    const canvas=node(),visual={clientWidth:1200,clientHeight:590},defaultDevice=node(),wallpaper=node(),chrome=[node(),node(),node()];
    const cards=names.map(node),previews=names.map(node);
    // Synthetic layout inputs exercise the DOM measurement boundary; actual
    // calendar/composer alignment is checked against browser geometry below.
    for(const card of cards)card.querySelector=selector=>({'.sw-month':{offsetTop:150,offsetHeight:30},'.sw-dates':{offsetTop:190,offsetHeight:65},'.sw-composer':{offsetTop:590,offsetHeight:80,offsetLeft:12,get offsetWidth(){return parseFloat(card.style.width)-24;}}}[selector]);
    const buttons=names.map((_,i)=>({dataset:{workspaceStep:String(i)},attrs:{},setAttribute(k,v){this.attrs[k]=v;}}));
    const root={...eventTarget,contains:el=>buttons.includes(el),classList:{toggle(){}},offsetHeight:3060,getBoundingClientRect:()=>({top}),querySelector:s=>s.endsWith('__canvas')?canvas:s==='.sw-default-device'?defaultDevice:s==='.sw-default-wallpaper'?wallpaper:visual,querySelectorAll:s=>s==='[data-samsung-screen]'?cards:s==='[data-samsung-preview]'?previews:s==='.sw-status, .sw-camera, .sw-gesture'?chrome:s.includes('.sw-default-')?[defaultDevice,wallpaper]:buttons};
    const window={...eventTarget};
    const context={window,document:{hidden:false,...eventTarget},innerWidth:width,innerHeight:900,matchMedia:()=>({matches:reduced,...eventTarget}),IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}disconnect(){}},requestAnimationFrame:fn=>{jobs.set(++nextId,fn);return nextId;},cancelAnimationFrame:id=>jobs.delete(id)};
    vm.runInNewContext(source,context);
    const dispose=window.SamsungWorkspace.mount(root);
    const flush=(delta=16)=>{now+=delta;const pending=[...jobs.values()];jobs.clear();pending.forEach(fn=>fn(now));};
    const read=()=>JSON.stringify({cards:cards.map(c=>c.style),previews:previews.map(c=>c.style),defaultDevice:defaultDevice.style,wallpaper:wallpaper.style,chrome:chrome.map(c=>c.style),buttons:buttons.map(b=>b.attrs)});
    return {cards,previews,buttons,defaultDevice,wallpaper,dispose,read,enter:visible=>observe([{isIntersecting:visible}]),choose:i=>listeners.get('click')({target:{closest:()=>buttons[i]}}),render:window.SamsungWorkspace.render,at(p){top=-2160*p;listeners.get('scroll')?.();flush();return read();},listeners,jobs,flush};
  }
  const f=fixture();
  check('unit: public render returns stable ordered screen markup',f.render()===f.render()&&names.every((name,i)=>f.render().indexOf('data-samsung-screen="'+name+'"')>(i?f.render().indexOf('data-samsung-screen="'+names[i-1]+'"'):-1)));
  f.at(0);check('unit: initial compact previews replace hidden full application panes',f.previews.every(p=>Number(p.style.opacity)>.9)&&f.cards.every(c=>Number(c.style.opacity)<.01));
  const geometry=(node,width,height)=>{const m=/translate3d\(([-.\d]+)px,([- .\d]+)px,0\) scale\(([-.\d]+)\)/.exec(node.style.transform);if(!m)return null;const scale=Number(m[3]);return {x:Number(m[1])+width*scale/2,y:Number(m[2])+height*scale/2,width:width*scale};};
  const continuity=[];
  for(const p of continuityProgress){f.at(p);for(let i=0;i<3;i++){const size=previewSize[names[i]],a=geometry(f.previews[i],size.width,size.height),b=geometry(f.cards[i],parseFloat(f.cards[i].style.width),692);continuity.push({p,id:names[i],preview:a,pane:b,pass:a&&b&&Math.abs(a.x-(i===2?a.width*(.5-216/456.011719):0)-b.x)<=1&&(i!==0||Math.abs(a.y-b.y)<=1)&&(i===2?a.width>0&&(Number(f.cards[i].style.opacity)<=.01||a.width<=b.width+1):Math.abs(a.width-b.width)<=1)});}}
  check('unit: previews retain horizontal paths and undistorted widths; control retains its center',continuity.every(c=>c.pass),continuity);
  f.at(0);
  const defaultMarkup=/<div class="sw-default-device">([\s\S]*?)<\/div>/.exec(f.render())?.[1]||'';
  check('unit: wallpaper and original hardware share one visible fade owner',defaultMarkup.includes('sw-default-frame')&&defaultMarkup.includes('sw-default-wallpaper')&&Number(f.defaultDevice.style.opacity)===1);
  const starts=f.previews.map(p=>p.style.transform);
  for(const [i,p] of [[0,.14],[1,.45],[2,.78]]){f.at(p);check('unit: compact '+names[i]+' travels before its full pane appears',f.previews[i].style.transform!==starts[i]&&Number(f.previews[i].style.opacity)>.9&&Number(f.cards[i].style.opacity)<.1);}
  f.at(.14);check('unit: wallpaper fades with hardware during the first arrival',Number(f.defaultDevice.style.opacity)>0&&Number(f.defaultDevice.style.opacity)<1);
  const first=f.at(.28),full=parseFloat(f.cards[0].style.width);
  f.at(.60);const half=parseFloat(f.cards[0].style.width);
  check('unit: second arrival creates equal two panes',half<full*.51&&half>full*.48&&f.cards[0].style.width===f.cards[1].style.width&&f.buttons[1].attrs['aria-pressed']==='true');
  const second=f.read();f.at(1);const third=parseFloat(f.cards[0].style.width);
  check('unit: final arrival creates equal three panes',third<full*.34&&third>full*.31&&f.cards.every(c=>Math.abs(parseFloat(c.style.width)-third)<.01)&&f.buttons[2].attrs['aria-pressed']==='true');
  check('unit: final state retires the default wallpaper and hardware artwork',Number(f.defaultDevice.style.opacity)===0);
  check('unit: final state retires every compact preview',f.previews.every(p=>Number(p.style.opacity)<.01));
  const final=f.read();check('unit: reverse input restores earlier states exactly',f.at(.60)===second&&f.at(.28)===first);
  check('unit: out-of-range native positions clamp at sequence boundaries',f.at(2)===final&&f.at(-1)===f.at(0));
  f.at(.60);const before=f.read();f.dispose();f.at(1);check('unit: cleanup removes queued work and scroll ownership',f.read()===before&&f.jobs.size===0&&!f.listeners.has('scroll'));
  const mobile=fixture(false,390);mobile.enter(true);mobile.flush();const selected=[];
  for(let frame=0;frame<30;frame++){mobile.flush(50);selected.push(mobile.buttons.findIndex(b=>b.attrs['aria-pressed']==='true'));}
  mobile.enter(false);mobile.flush(50);const paused=mobile.read();mobile.flush(10000);
  check('unit: offscreen mobile animation pauses without wall-clock drift',mobile.read()===paused);
  mobile.enter(true);mobile.flush(50);
  for(let frame=0;frame<90;frame++){mobile.flush(50);selected.push(mobile.buttons.findIndex(b=>b.attrs['aria-pressed']==='true'));}
  check('unit: mobile fake-clock animation visits Control then Visitor then AI',JSON.stringify([...new Set(selected)])===JSON.stringify([0,1,2])&&mobile.cards.every(c=>Math.abs(parseFloat(c.style.width)-third)<.01),selected);
  mobile.choose(0);mobile.flush();for(let frame=0;frame<70;frame++)mobile.flush(50);
  check('unit: a mobile tap returns to the requested full-screen step',Math.abs(parseFloat(mobile.cards[0].style.width)-full)<.01&&mobile.buttons[0].attrs['aria-pressed']==='true');mobile.dispose();
  const r=fixture(true);r.flush();check('unit: reduced motion mounts final AI selection immediately',r.buttons[2].attrs['aria-pressed']==='true'&&r.cards.every(c=>Math.abs(parseFloat(c.style.width)-third)<.01));r.dispose();
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  unitChecks();
  if(process.env.SAMSUNG_UNIT_ONLY==='1'){fs.writeFileSync(path.join(out,'unit-results.json'),JSON.stringify(checks,null,2));console.log(checks);if(checks.some(c=>!c.pass))process.exitCode=1;return;}
  const executablePath=process.env[engine.toUpperCase()+'_EXECUTABLE'];
  const browser=await playwright[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    page.on('pageerror',e=>errors.push(e.stack||e.message));
    await enter(page);
    check('public SamsungStory API is preserved',await page.evaluate(()=>['render','renderWorkspace','mount','cleanup'].every(k=>typeof window.SamsungStory?.[k]==='function')));
    check('one workspace follows the original unfolding and case introduction',await page.locator(rootSelector).count()===1&&await page.locator(rootSelector).evaluate(root=>[document.querySelector('[data-samsung-story]'),document.querySelector('main h1')].every(prior=>Boolean(prior.compareDocumentPosition(root)&Node.DOCUMENT_POSITION_FOLLOWING))));
    check('workspace rendering is deterministic and side-effect free',await page.evaluate(()=>{const first=SamsungStory.renderWorkspace();const second=SamsungStory.renderWorkspace();return first===second&&document.querySelectorAll('[data-samsung-workspace]').length===1;}));
    let initial=await snapshot(page);
    check('three distinct screens have the required order',JSON.stringify(initial.cards.map(c=>c.id))===JSON.stringify(names),initial.cards);
    check('three screens expose meaningful accessible identities',labels.every(label=>initial.cards.some(c=>((c.label||'')+' '+c.text).toLowerCase().includes(label.toLowerCase()))),initial.cards);
    if(initial.cards.length===3) {
      await phase(page,0);const floating=await snapshot(page);await capture(page,'desktop-floating');
      const approaches=[];for(const p of [.14,.45,.78]){await phase(page,p);approaches.push(await snapshot(page));await capture(page,'desktop-approach-'+p);}
      const samples=[];
      for(const p of [.28,.44,.60,.78,1]){await phase(page,p);samples.push(await snapshot(page));await capture(page,'desktop-'+p);}
      check('desktop retains native sticky scroll progression',samples[0].sticky==='sticky'&&samples[0].height>samples[0].viewport,samples[0]);
      check('any screen images decode',decoded(samples[4]),samples[4].cards);
      check('initial scene contains only the three compact Figma previews',JSON.stringify(floating.previews.map(p=>p.id))===JSON.stringify(names)&&floating.previews.every(p=>p.alpha>.9)&&floating.cards.every(c=>c.alpha<.01),floating);
      const handoffs=[];for(const progress of continuityProgress){await phase(page,progress);const sample=await snapshot(page);handoffs.push({progress,sample});if([.17,.48,.81].includes(progress))await capture(page,'desktop-handoff-'+progress);}
      for(const id of names){const pairs=handoffs.map(({progress,sample})=>{const a=sample.previews.find(p=>p.id===id),b=card(sample,id),scale=sample.shell.width/974;return {progress,dx:(a.rect.x+a.rect.width*(id==='ai'?216/456.011719:.5)-(id==='ai'?b.anchor.x+b.anchor.width/2:b.rect.x+b.rect.width/2))/scale,dy:(a.rect.y+a.rect.height*(a.id==='ai'?369/(2*718):.5)-b.anchor.y-b.anchor.height/2)/scale,dw:(a.rect.width-b.rect.width)/scale,inputWidthError:Math.abs(a.rect.width*1296/1368-b.anchor.width)/b.anchor.width,overlap:a.alpha>.01&&b.alpha>.01};});
        check(id+' handoff shares horizontal geometry and its corresponding UI vertical anchor',pairs.every(p=>Math.abs(p.dx)<=1&&(!p.overlap||Math.abs(p.dy)<=2)&&(id==='ai'?!p.overlap||p.inputWidthError<.1:Math.abs(p.dw)<=1))&&pairs.some(p=>p.overlap),pairs);}
      check('visible compact previews stay inside the scene throughout entry',handoffs.every(({sample})=>sample.previews.filter(p=>p.alpha>.01).every(p=>p.rect.x>=Math.max(0,sample.visual.x-sample.clipMargin)-1&&p.rect.right<=Math.min(sample.width,sample.visual.right+sample.clipMargin)+1&&p.rect.y>=sample.visual.y-sample.clipMargin-1&&p.rect.bottom<=sample.visual.bottom+sample.clipMargin+1)),handoffs.map(({progress,sample})=>({progress,visual:sample.visual,previews:sample.previews})));
      check('visible full panes stay inside the scene throughout entry',handoffs.every(({sample})=>sample.cards.filter(p=>p.alpha>.01).every(p=>p.rect.x>=sample.visual.x-1&&p.rect.right<=sample.visual.right+1&&p.rect.y>=sample.visual.y-1&&p.rect.bottom<=sample.visual.bottom+1)),handoffs.map(({progress,sample})=>({progress,visual:sample.visual,cards:sample.cards})));
      check('desktop scene is larger at the opening and final state',floating.shell.width>sceneBaseline[1440].initial+1&&samples[4].shell.width>sceneBaseline[1440].final+1,{initial:floating.shell.width,final:samples[4].shell.width,baseline:sceneBaseline[1440]});
      check('initial device displays the original default Figma asset',floating.defaultImages.some(i=>i.src.split('?')[0]==='assets/samsung/workspace/fold-default.png'&&i.loaded&&i.alpha>.9),floating.defaultImages);
      const wallpaper=floating.defaultImages.find(i=>i.wallpaper),deviceScale=floating.shell.width/974;
      const wallpaperRect=wallpaper&&{x:(wallpaper.rect.x-floating.shell.x)/deviceScale,y:(wallpaper.rect.y-floating.shell.y)/deviceScale,width:wallpaper.rect.width/deviceScale,height:wallpaper.rect.height/deviceScale};
      // The requested digital-twin replacement preserves the original screen geometry.
      check('updated Figma wallpaper covers the original screen exactly',wallpaper?.loaded&&wallpaper.src.split('?')[0]==='assets/samsung/workspace/digital-twin-wallpaper.png'&&wallpaper.alpha>.9&&Object.entries({x:21,y:21,width:932,height:705}).every(([key,value])=>Math.abs(wallpaperRect[key]-value)<=1),{wallpaper,wallpaperRect});
      check('updated wallpaper follows the base device fade through the first arrival',[floating,approaches[0],samples[0],samples[4]].every(s=>{const overlay=s.defaultImages.find(i=>i.wallpaper),base=s.defaultImages.find(i=>!i.wallpaper);return overlay&&base&&Math.abs(overlay.alpha-base.alpha)<.01;})&&samples[4].defaultImages.every(i=>i.alpha<.01));
      check('initial previews use the three approved compact exports',floating.previews.length===3&&floating.previews.every((p,i)=>p.images.length===1&&p.images[0].src.split('?')[0]==='assets/samsung/workspace/preview-'+names[i]+'.png'),floating.previews);
      check('compact previews move before full panes reveal',names.every((id,i)=>{const start=floating.previews.find(p=>p.id===id),middle=approaches[i].previews.find(p=>p.id===id);return start&&middle&&middle.transform!==start.transform&&middle.alpha>.9&&card(approaches[i],id).alpha<.1;}),approaches);
      check('compact previews decode without stretching',floating.previews.length===3&&floating.previews.every(p=>p.images.length&&p.images.every(i=>i.loaded&&Math.abs(i.rect.width/i.rect.height-i.naturalWidth/i.naturalHeight)<.02)),floating.previews);
      check('Control Devices arrives first',active(samples[0],'control'),samples[0]);
      check('Visitor Invitation arrives second',active(samples[2],'visitor'),samples[2]);
      check('AI Agent arrives last',active(samples[4],'ai'),samples[4]);
      const aiText=card(samples[4],'ai').text.replace(/\s+/g,' ');
      check('AI master preserves its original conversation, review and composer content',['5F · Meeting Room 1','What would you like to adjust?','Prepare Meeting Room 1 for a presentation.','I suggest dimming the lights and setting a comfortable cooling target. Review the changes below.','Ready to apply · 2 devices','90% → 30%','20.7°C → 22°C','Apply changes','Ask about this room or its devices','Pro 1.0'].every(text=>aiText.includes(text)),aiText);
      check('final third screen is AI Agent rather than SmartThings Home',/AI Agent/i.test(card(samples[4],'ai').text)&&!/(Scan a QR|Find devices|Add a device)/i.test(card(samples[4],'ai').text),card(samples[4],'ai'));
      check('final three screen surfaces are visible and fit the viewport',samples[4].cards.every(c=>c.alpha>.9&&c.rect.width>0&&c.rect.height>0&&c.rect.x>=-1&&c.rect.right<=1441),samples[4].cards);
      check('each compact preview travels and retires when its full pane arrives',names.every((id,i)=>{const before=floating.previews.find(p=>p.id===id),after=samples[[0,2,4][i]].previews.find(p=>p.id===id);return before&&after&&before.transform!==after.transform&&after.alpha<.01&&card(samples[[0,2,4][i]],id).alpha>.9;}),{floating:floating.previews,arrivals:samples.map(s=>s.previews)});
      check('one shared device status bar and navigation remain',samples.every(s=>s.chrome===1&&s.gesture===1),samples.map(s=>({chrome:s.chrome,gesture:s.gesture})));
      for(const [sampleIndex,paneCount] of [[0,1],[2,2],[4,3]]){
        const sample=samples[sampleIndex],arrived=sample.cards.slice(0,paneCount);
        check(paneCount+' pane layout fills the device without clipping or distortion',arrived.every((c,i)=>Math.abs(c.rect.width/sample.shell.width-(paneCount===1?.953:paneCount===2?.473:.311))<.015&&c.rect.x>=sample.shell.x&&c.rect.right<=sample.shell.right&&c.rect.y>=sample.shell.y&&c.rect.bottom<=sample.shell.bottom&&(i===0||c.rect.x>=arrived[i-1].rect.right)),{shell:sample.shell,arrived});
      }
      check('desktop image geometry stays undistorted',samples.every(undistorted));
      check('desktop transition never adds horizontal overflow',samples.every(s=>!s.overflow));
      for(const index of [3,2,1,0]){const p=[.28,.44,.60,.78,1][index];await phase(page,p);check('reverse native scroll restores phase '+p,signature(await snapshot(page))===signature(samples[index]));}
      await phase(page,0);check('reverse to opening restores compact previews and original default artwork',signature(await snapshot(page))===signature(floating));
      // Scroll events may interrupt each other; the final location owns the result.
      for(const p of [.9,.1,.7,.60])await page.locator(rootSelector).evaluate((root,p)=>scrollTo(0,scrollY+root.getBoundingClientRect().top+(root.offsetHeight-innerHeight)*p),p);
      await pause(page);check('rapid reversal converges to Visitor Invitation',signature(await snapshot(page))===signature(samples[2]));
      await page.setViewportSize({width:390,height:844});await pause(page);
      let mobile=await snapshot(page);check('desktop to mobile resize removes sticky runway',mobile.sticky!=='sticky'&&mobile.height<mobile.viewport*1.7,mobile);
      await page.setViewportSize({width:1440,height:900});await pause(page);await phase(page,.60);
      check('mobile to desktop resize restores scroll ownership',signature(await snapshot(page))===signature(samples[2]));
      await page.evaluate(()=>{window.__retiredWorkspace=document.querySelector('[data-samsung-workspace]');location.hash='#/about';});
      await page.locator(rootSelector).waitFor({state:'detached'});
      const retired=await page.evaluate(()=>window.__retiredWorkspace.outerHTML);
      await page.evaluate(()=>{scrollTo(0,300);dispatchEvent(new Event('resize'));});await pause(page);
      check('unmounted workspace ignores late scroll and resize',retired===await page.evaluate(()=>window.__retiredWorkspace.outerHTML));
      await enter(page);await phase(page,.60);
      check('route reentry retains exactly one workspace and correct progression',await page.locator(rootSelector).count()===1&&signature(await snapshot(page))===signature(samples[2]));
    }
    await page.close();
    for(const width of [320,390,820]){
      const p=await browser.newPage({viewport:{width,height:844},reducedMotion:'no-preference'});p.on('pageerror',e=>errors.push(e.stack||e.message));await enter(p);await phase(p,0);await p.clock.install();
      let s=await snapshot(p);if(sceneBaseline[width])check('mobile '+width+' opening scene is larger',s.shell.width>sceneBaseline[width].initial+1,{actual:s.shell.width,baseline:sceneBaseline[width].initial});
      check('mobile '+width+' has no scroll trap',s.sticky!=='sticky'&&s.height<s.viewport*1.7,s);
      check('mobile '+width+' has one reachable control for each screen',labels.every(label=>s.buttons.some(b=>b.label.toLowerCase().includes(label.toLowerCase()))),s.buttons);
      if(s.cards.length===3&&s.buttons.length>=3){
        for(const index of [0,1,2,1,0]){await p.locator(rootSelector).getByRole('button',{name:new RegExp(labels[index],'i')}).click();if(index===2){const frames=[];for(let tick=0;tick<44;tick++){await p.clock.runFor(100);frames.push(await snapshot(p));}check('mobile '+width+' animation keeps visible previews and panes inside the scene',frames.every(s=>[...s.previews,...s.cards].filter(c=>c.alpha>.01).every(c=>c.rect.x>=Math.max(0,s.visual.x-s.clipMargin)-1&&c.rect.right<=Math.min(s.width,s.visual.right+s.clipMargin)+1&&c.rect.y>=s.visual.y-s.clipMargin-1&&c.rect.bottom<=s.visual.bottom+s.clipMargin+1)),frames.map(s=>({visual:s.visual,previews:s.previews,cards:s.cards})));check('mobile '+width+' previews hand off at their corresponding UI anchors',frames.every(s=>s.previews.every(a=>{const b=card(s,a.id),scale=s.shell.width/974;return Math.abs(a.rect.x+a.rect.width*(a.id==='ai'?216/456.011719:.5)-(a.id==='ai'?b.anchor.x+b.anchor.width/2:b.rect.x+b.rect.width/2))<=scale&&(!(a.alpha>.01&&b.alpha>.01)||Math.abs(a.rect.y+a.rect.height*(a.id==='ai'?369/(2*718):.5)-b.anchor.y-b.anchor.height/2)<=2*scale)&&(a.id==='ai'?!(a.alpha>.01&&b.alpha>.01)||Math.abs(a.rect.width*1296/1368-b.anchor.width)/b.anchor.width<.1:Math.abs(a.rect.width-b.rect.width)<=scale);})));}else await p.clock.runFor(4400);s=await snapshot(p);if(index===2&&sceneBaseline[width])check('mobile '+width+' final device retains its viewport fit',s.shell.width>=sceneBaseline[width].final-1,{actual:s.shell.width,baseline:sceneBaseline[width].final});await capture(p,'mobile-'+width+'-'+names[index]);check('mobile '+width+' tap '+names[index]+' selects visible screen',active(s,names[index]),s);check('mobile '+width+' tap '+names[index]+' fits viewport',!s.overflow&&s.copy.every(r=>r.x>=-1&&r.right<=width+1),s.copy);}
        check('mobile '+width+' content images decode without distortion',decoded(s)&&undistorted(s),s.cards);
      }
      await capture(p,'mobile-'+width);await p.close();
    }
    const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await enter(reduced);await phase(reduced,0);const before=await snapshot(reduced);
    check('reduced motion exposes the stable final AI Agent screen',before.sticky!=='sticky'&&before.height<before.viewport*1.7&&active(before,'ai'),before);
    await phase(reduced,1);check('reduced motion does not scrub with scroll',signature(before)===signature(await snapshot(reduced)));await capture(reduced,'reduced-motion');await reduced.close();
    check('all scenarios are free of uncaught browser errors',errors.length===0,errors);
    const sheet=await browser.newPage({viewport:{width:1200,height:900}});
    const captures=fs.readdirSync(out).filter(file=>/^(desktop-|mobile-|reduced-motion)/.test(file)&&file.endsWith('.png'));
    await sheet.setContent('<style>body{margin:0;padding:16px;background:#ddd;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px;background:white}</style><main>'+captures.map(file=>'<figure><img src="data:image/png;base64,'+fs.readFileSync(path.join(out,file)).toString('base64')+'"><figcaption>'+file+'</figcaption></figure>').join('')+'</main>');
    await sheet.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});await sheet.close();
  } finally {await browser.close();}
  const failures=checks.filter(c=>!c.pass);
  const sources=Object.fromEntries(['samsung-workspace.js','samsung-workspace.css','assets/samsung/workspace/fold-default.png','assets/samsung/workspace/default-wallpaper.png','assets/samsung/workspace/preview-control.png','assets/samsung/workspace/preview-visitor.png','assets/samsung/workspace/preview-ai.png','hello-w-play/tests/samsung-workspace-cards.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex')]));
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine,sources,checks,failures},null,2));
  console.log(checks.length+' checks, '+failures.length+' failures',failures.map(c=>c.name));if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1);});
