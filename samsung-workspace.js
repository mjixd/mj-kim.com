/* The Figma panels remain live layout; one progress value owns every arrival. */
(() => {
  const clamp = p => Math.max(0, Math.min(1, p));
  const ease = p => { p = clamp(p); return p * p * (3 - 2 * p); };
  const lerp = (a, b, p) => a + (b - a) * p;
  const steps = [0.28, 0.60, 1];
  const labels = ['Control Devices', 'Visitor Invitation', 'AI Agent'];
  const icon = (name, className = '') => `<img class="sw-icon ${className}" src="assets/samsung/workspace/${name}.svg" alt="" draggable="false">`;
  const modes = names => `<div class="sw-modes">${names.map((name, i) => `<span class="${i ? '' : 'is-selected'}">${name}</span>`).join('')}</div>`;
  const handle = '<div class="sw-handle"><i></i></div>';
  function control() {
    return `${handle}<div class="sw-control-content"><div class="sw-app-header">${icon('back')}<b>Control Devices</b>${icon('favorite', 'sw-trailing')}</div>
      <div class="sw-room-tabs"><span>5F.MeetingRm1</span><span>6F.MeetingRm2</span><span>6F.MeetingRm3</span><span>7F.MeetingRm3</span></div>
      <div class="sw-updated">Update : 05:04:30 ${icon('refresh')}</div>
      <div class="sw-device-card"><div class="sw-device-identity"><span class="sw-light-icon">${icon('light')}</span><div>Lighting 1 ${icon('favorite-on')}<small>ON</small></div><span class="sw-round">${icon('power')}</span></div>
        <div class="sw-brightness"><span>Brightness</span><strong>90<small>%</small></strong></div><div class="sw-rule"></div>${modes(['Relax', 'Normal', 'Focus'])}</div>
      <div class="sw-device-card sw-ac"><div class="sw-device-identity">${icon('ac')}<div>AC ${icon('favorite-off')}<small>ON</small></div><span class="sw-round">${icon('power')}</span></div>
        <div class="sw-temperature"><div><small>Current</small><b>21.7<sub>°C</sub></b></div><div><small>Target</small><b>20.7<sub>°C</sub></b></div><span class="sw-round">${icon('minus')}</span><span class="sw-round">${icon('plus')}</span></div>
        <div class="sw-rule"></div>${modes(['Auto', 'Cooling', 'Heating'])}</div></div>`;
  }
  function visitor() {
    const dates = [['FRI',29],['SAT',30],['SUN',31],['MON',1],['TUE',2],['WED',3],['THU',4],['FRI',5],['SAT',6],['SUN',7],['MON',8]];
    return `${handle}<div class="sw-visit-calendar"><div class="sw-app-header">${icon('back')}<b>Visitor Invitation</b></div><p>Samsung</p>
      <div class="sw-month">${icon('previous')}<span>2026.08</span>${icon('previous','sw-next')}</div>
      <div class="sw-dates">${dates.map(([day,n],i)=>`<div class="${i < 2 || i > 8 ? 'sw-extra-date' : ''}"><small>${day}</small><span class="${n===2||n===3?'is-selected':''}">${n}</span>${n===1?'<em>Today</em>':''}</div>`).join('')}</div><div class="sw-collapse">=</div></div>
      <div class="sw-visit-content"><div class="sw-visit-tabs"><span>Date and Time of Visit</span><span>Invite Visitor</span></div>
      <div class="sw-visit-label">${icon('calendar')}<span>Date and Time of Visit <em>*</em></span></div>
      <div class="sw-visit-time"><div><small>2026.08.02(TUE)</small><span>09:00</span></div>${icon('arrow')}<div><small>2026.08.03(WED)</small><span>19:00</span></div></div>
      <div class="sw-rule"></div><div class="sw-visitor-name">${icon('visitor')}<span>Visitor 1</span><i>${icon('remove')}</i></div>
      <div class="sw-field"><span>Name <em>*</em></span><span>Samsung</span></div><div class="sw-field"><span>Email <em>*</em> ${icon('dropdown')}</span><span>sumsung@samsung.com</span></div></div>`;
  }
  function agent() {
    return `${handle}<div class="sw-agent-content"><div class="sw-agent-header">${icon('ai-sparkles')}<b>AI Agent</b><span class="sw-agent-close">${icon('ai-close')}</span></div>
      <p class="sw-room-context">5F · Meeting Room 1</p>
      <div class="sw-conversation"><div><span class="sw-sender">AI Agent</span><p>What would you like to adjust?</p></div>
      <div class="sw-user-message">Prepare Meeting Room 1 for a presentation.</div>
      <div class="sw-response"><span class="sw-sender">AI Agent</span><p>I suggest dimming the lights and setting a comfortable cooling target. Review the changes below.</p></div>
      <div class="sw-proposal"><span>Ready to apply · 2 devices</span><div><span>Lighting 1</span><b>90% → 30%</b></div><div><span>AC target</span><b>20.7°C → 22°C</b></div><div class="sw-apply">Apply changes</div></div></div>
      <div class="sw-composer"><p>Ask about this room or its devices</p><div>${icon('ai-attachment')}<span>Pro 1.0 ${icon('ai-chevron')}</span>${icon('ai-microphone')}<i>${icon('ai-voice')}</i></div></div></div>`;
  }
  function render() {
    return `<section class="samsung-workspace" data-samsung-workspace aria-labelledby="samsung-workspace-title">
      <div class="samsung-workspace__stage" data-samsung-stage>
        <div class="samsung-story__copy"><span class="samsung-story__eyebrow">Multitask with three apps at once</span><h2 id="samsung-workspace-title">Every task. One workspace.</h2><p>Work across three split-screen panes on a single display. Use up to three apps at once, or resize pop-up windows for greater flexibility. Browse the web, check messages, and follow directions side by side—keeping your workflow moving without switching screens.</p></div>
        <div class="samsung-workspace__visual"><div class="samsung-workspace__canvas">
          <div class="samsung-workspace__device" aria-hidden="true"><div class="sw-wallpaper"></div><div class="sw-default-device"><img class="sw-default-frame" src="assets/samsung/workspace/fold-default.png" width="974" height="747" alt=""><img class="sw-default-wallpaper" src="assets/samsung/workspace/digital-twin-wallpaper.png" width="932" height="705" alt=""><i class="sw-default-camera"></i></div></div>
          <div class="sw-screen sw-screen--control" data-samsung-screen="control" role="img" aria-label="Control Devices: lighting and temperature controls">${control()}</div>
          <div class="sw-screen sw-screen--visitor" data-samsung-screen="visitor" role="img" aria-label="Visitor Invitation: calendar and visitor access">${visitor()}</div>
          <div class="sw-screen sw-screen--ai" data-samsung-screen="ai" role="img" aria-label="AI Agent: prepare Meeting Room 1, review lighting and AC changes">${agent()}</div>
          <img class="sw-preview" data-samsung-preview="control" src="assets/samsung/workspace/preview-control.png?v=layout-2" width="390" height="227" alt="Lighting controls preview" draggable="false">
          <img class="sw-preview" data-samsung-preview="visitor" src="assets/samsung/workspace/preview-visitor.png" width="424.614868" height="197" alt="Calendar preview" draggable="false">
          <img class="sw-preview" data-samsung-preview="ai" src="assets/samsung/workspace/preview-ai.png?v=layout-2" width="456.011719" height="239.132813" alt="AI Agent input and button preview" draggable="false">
          <div class="sw-status" aria-hidden="true"><img src="assets/samsung/workspace/status.svg" width="932" height="42" alt=""></div><div class="sw-camera" aria-hidden="true"></div><div class="sw-gesture" aria-hidden="true"></div>
        </div></div>
        <div class="samsung-workspace__controls" role="group" aria-label="Explore the workspace">${labels.map((label,i)=>`<button type="button" data-workspace-step="${i}" aria-pressed="${i===2}"><span aria-hidden="true">0${i+1}</span>${label}</button>`).join('')}</div>

      </div></section>`;
  }
  function mount(root) {
    const canvas = root.querySelector('.samsung-workspace__canvas');
    const visual = root.querySelector('.samsung-workspace__visual');
    const cards = [...root.querySelectorAll('[data-samsung-screen]')];
    const previews = [...root.querySelectorAll('[data-samsung-preview]')];
    const defaultDevice = root.querySelector('.sw-default-device');
    const chrome = [...root.querySelectorAll('.sw-status, .sw-camera, .sw-gesture')];
    const buttons = [...root.querySelectorAll('[data-workspace-step]')];
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, desktop = false, seen = false, visible = false, raf = 0;
    let progress = 1, transition = null, previousTime = 0;
    // Canvas coordinates preserve the device and shared system chrome. Panel
    // widths reflow their contents; transforms never stretch text or icons.
    function paint(p) {
      progress = clamp(p);
      // Overview for incoming cards, then fit the docked device on small screens.
      const fit = desktop ? 0 : ease((p-.88)/.12);
      const scale = Math.min(visual.clientWidth/lerp(1350,1030,fit),visual.clientHeight/790);
      canvas.style.transform=`translate(-50%,-50%) scale(${scale}) translateY(-39px)`;
      const arrivals = [ease((p-.04)/.20), ease((p-.35)/.20), ease((p-.68)/.20)];
      defaultDevice.style.opacity=1-arrivals[0];
      chrome.forEach(element=>{element.style.opacity=arrivals[0];});
      const width = lerp(lerp(928,461,arrivals[1]),303.33,arrivals[2]);
      const settled = [
        {x:261,y:139,w:width,s:1},
        {x:261+width+7,y:139,w:width,s:1},
        {x:261+2*(width+7),y:139,w:303.33,s:1},
      ];
      // Each preview expands into its pane on one shared center/width trajectory.
      const compact = [{x:300,y:430,w:390,h:227},{x:725,y:350,w:424.614868,h:197},{x:1150,y:430,w:456.011719,h:239.132813}];
      cards.forEach((card,i)=>{
        const t=arrivals[i], start=compact[i], b=settled[i];
        const x=lerp(start.x,b.x+b.w/2,t), y=lerp(start.y,b.y+692/2,t);
        const renderedWidth=lerp(start.w,b.w,t), paneWidth=lerp(461,b.w,t);
        const paneScale=renderedWidth/paneWidth, previewScale=renderedWidth/start.w;
        const reveal=ease((t-.55)/.45);
        card.style.opacity=reveal;
        card.setAttribute('aria-hidden',String(reveal===0));
        const preview=previews[i];
        preview.style.transform=`translate3d(${x-renderedWidth/2}px,${y-start.h*previewScale/2}px,0) scale(${previewScale})`;
        preview.style.opacity=1-reveal;
        preview.setAttribute('aria-hidden',String(reveal===1));
        card.style.width=paneWidth+'px';
        card.style.transform=`translate3d(${x-renderedWidth/2}px,${y-692*paneScale/2}px,0) scale(${paneScale})`;
        card.style.boxShadow=`0 ${24*(1-t)}px ${64*(1-t)}px rgba(0,0,0,${.2*(1-t)})`;
      });
      const selected = p < .35 ? 0 : p < .68 ? 1 : 2;
      buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));
    }
    function draw(time) {
      raf=0;
      if (!active) return;
      if (desktop) paint(clamp(-root.getBoundingClientRect().top / Math.max(1,root.offsetHeight-innerHeight)));
      else if (transition) {
        if (!visible || document.hidden) { previousTime=0; return; }
        const delta = previousTime ? Math.min(time-previousTime,50) : 0;
        previousTime=time;
        transition.elapsed+=delta;
        const t=clamp(transition.elapsed/transition.duration);
        paint(lerp(transition.from,transition.to,t));
        if(t===1) { transition=null;previousTime=0; } else queue();
      }
    }
    function queue() { if(active && !raf) raf=requestAnimationFrame(draw); }
    function animateTo(to) {
      if (motion.matches) { transition=null;paint(to);return; }
      transition={from:progress,to,elapsed:0,duration:Math.max(350,Math.abs(to-progress)*4200)};
      previousTime=0;queue();
    }
    function reconcile() {
      const wasDesktop=desktop;
      desktop=innerWidth>820 && innerHeight>=700 && !motion.matches;
      root.classList.toggle('samsung-workspace--scroll',desktop);
      paint(progress);
      if (desktop) { transition=null;queue(); }
      else if (motion.matches) { transition=null;paint(1); }
      else if(wasDesktop || !seen) { transition=null;paint(seen?progress:0); }
      if(!desktop && !motion.matches && visible && !seen) { seen=true;animateTo(1); }
      else queue();
    }
    function select(event) {
      const button=event.target.closest('[data-workspace-step]');
      if(!button || !root.contains(button)) return;
      const to=steps[Number(button.dataset.workspaceStep)];
      seen=true;
      if(desktop) window.scrollTo({top:scrollY+root.getBoundingClientRect().top+(root.offsetHeight-innerHeight)*to,behavior:'smooth'});
      else animateTo(to);
    }
    const observer=new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if(visible && !desktop && !motion.matches && !seen) { seen=true;animateTo(1); }
      else queue();
    },{threshold:.25});
    observer.observe(visual);
    root.addEventListener('click',select);
    window.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',reconcile);
    document.addEventListener('visibilitychange',queue);
    motion.addEventListener('change',reconcile);
    reconcile();
    return ()=>{active=false;cancelAnimationFrame(raf);transition=null;observer.disconnect();root.removeEventListener('click',select);window.removeEventListener('scroll',queue);window.removeEventListener('resize',reconcile);document.removeEventListener('visibilitychange',queue);motion.removeEventListener('change',reconcile);};
  }
  window.SamsungWorkspace={render,mount};
})();
