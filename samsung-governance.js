/* One native-scroll progress keeps each validation image and its copy together. */
(() => {
  const clamp = p => Math.max(0, Math.min(1, p));
  const steps = [
    {slide:'08', title:'Shared tokens. Verified in the UI.', text:'Shared tokens and DESIGN.md turn design standards into checks against generated HTML/CSS and the rendered interface. Deterministic checks produce a conformance score; decisions that require judgment remain open for human review.', crop:[80,137,1120,765,1920,1080]},
    {slide:'09', title:'Expose errors. Verify the fix.', text:'Change a token to see its effect on the preview, source, and conformance score. Restore the baseline and run QA again to verify the correction. REVIEW items remain subject to human assessment.', crop:[80,93,799,594,1440,810]},
  ];
  function render() {
    return `<section class="samsung-governance" data-samsung-governance aria-labelledby="governance-title">
      <div class="samsung-governance__stage">
        <header class="samsung-governance__heading"><span>2 Operating model</span><h2 id="governance-title">Define the automation boundary</h2></header>
        <div class="samsung-governance__panels">${steps.map((step,i)=>{
          const [x,y,w,h,sw,sh]=step.crop;
          return `<article class="samsung-governance__panel" data-governance-step="${i}">
            <div class="samsung-governance__visual"><div class="samsung-governance__crop" style="width:${Math.min(1,(w/h)/(1120/765))*100}%;aspect-ratio:${w}/${h}"><img src="assets/decks/EN · ${step.slide}.png" alt="Tokenproof validation tool: ${step.title}" loading="lazy" style="left:${-x/w*100}%;top:${-y/h*100}%;width:${sw/w*100}%;height:${sh/h*100}%"></div></div>
            <div class="samsung-governance__copy"><h3>${step.title}</h3><p>${step.text}</p><small>Public demo · Internal production screens are not disclosed.</small></div>
          </article>`;
        }).join('')}</div>
      </div>
    </section>`;
  }
  function mount(root) {
    const panels=[...root.querySelectorAll('[data-governance-step]')];
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let active=true, enabled=false, frame=0;
    function draw() {
      frame=0;
      if(!active)return;
      const progress=clamp(-root.getBoundingClientRect().top/Math.max(1,root.offsetHeight-innerHeight));
      const t=clamp((progress-.38)/.24), blend=t*t*(3-2*t);
      panels.forEach((panel,i)=>{
        panel.style.opacity=enabled?(i?blend:1-blend):1;
        panel.setAttribute('aria-hidden',String(enabled&&(i?blend<.5:blend>=.5)));
      });
    }
    function queue(){if(active&&!frame)frame=requestAnimationFrame(draw);}
    function layout(){
      if(!active)return;
      enabled=!motion.matches&&innerHeight>640;
      root.classList.toggle('samsung-governance--scroll',enabled);
      // Keep every caption readable when small screens or larger fonts cannot
      // fit a pinned scene. Both steps then follow the ordinary document flow.
      if(enabled&&root.querySelector('.samsung-governance__stage').scrollHeight>innerHeight+1){
        enabled=false;root.classList.remove('samsung-governance--scroll');
      }
      draw();
    }
    window.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',layout);
    motion.addEventListener('change',layout);
    layout();
    document.fonts.ready.then(layout);
    return ()=>{active=false;cancelAnimationFrame(frame);window.removeEventListener('scroll',queue);window.removeEventListener('resize',layout);motion.removeEventListener('change',layout);};
  }
  window.SamsungGovernance={render,mount};
})();
