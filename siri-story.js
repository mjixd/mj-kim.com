/* 2016 Apple iOS 10: separate hardware/screen layers share one scroll timeline.
   Reference: https://web.archive.org/web/20160914234642/https://www.apple.com/ios/ios-10/ */
window.SiriStory = (() => {
  const base = 'assets/line/';
  const layers = [
    [-645,-70,520,'request'],[-323,-245,740,'review'],[0,-327,450,'sent'],
    [323,-175,620,'request'],[645,-268,480,'review'],[-645,567,480,'sent'],
    [-323,392,600,'request'],[0,585,360,'review'],[323,500,600,'sent'],[645,430,480,'request']
  ];
  const clamp = n => Math.max(0,Math.min(1,n));
  let dispose = () => {};
  function screen(state){
    return `<div class="siri-screen" data-siri-state="${state}">
      <div class="siri-status"><span>••••• ◉</span><span>9:41 AM</span><span>100% ▰</span></div>
      <p class="siri-request">Send a LINE to Nancy<br>saying &quot;I'll be five minutes late&quot;</p>
      <span class="siri-edit">tap to edit</span>
      <p class="siri-response">${state==='request'?'Listening…':state==='review'?"Here's your LINE message:":'Your LINE message has been sent.'}</p>
      ${state==='request'?'':`<div class="siri-message"><div class="siri-message-brand">● LINE</div><div class="siri-message-content"><span>To: Nancy</span><p>I'll be five minutes late</p></div><div class="siri-message-actions">${state==='review'?'<span>Cancel</span><strong>Send</strong>':'<span>Sent</span>'}</div></div>`}
      <svg class="siri-mic" viewBox="0 0 24 32" aria-hidden="true"><rect x="8" y="2" width="8" height="18" rx="4"/><path d="M4 13v4a8 8 0 0 0 16 0v-4M12 25v5M7 30h10"/></svg>
    </div>`;
  }
  function renderHero(){
    return `<section class="siri-hero" data-siri-hero aria-label="Siri for LINE, reconstructed 2016 interface">
      <div class="siri-hero-stage">
        <div class="siri-devices" aria-hidden="true">${layers.map(([x,y,travel,state])=>`<div class="siri-device" data-x="${x}" data-y="${y}" data-travel="${travel}"><img src="${base}apple-iphone-2016.png" alt="" width="702" height="1320">${screen(state)}</div>`).join('')}</div>
        <div class="siri-hero-title"><p>2016 · SiriKit</p><h1>Siri<br> for LINE</h1></div>
        <div class="siri-hero-scrim" aria-hidden="true"></div>
        <p class="siri-hero-note">Interface reconstruction · Speak. Review. Send.</p>
      </div>
    </section>`;
  }
  function renderVoice(){
    return `<section class="siri-voice" data-siri-voice aria-labelledby="siri-voice-title">
      <div class="wrap siri-voice-inner">
        <span class="siri-eyebrow">Siri for LINE</span>
        <h2 id="siri-voice-title">A message starts<br>with your voice.</h2>
        <p class="siri-voice-lead">Say who it is for and what you want to say. Siri turns the request into a LINE message you can review before sending.</p>
        <blockquote>“Send a LINE to Nancy<br>saying ‘I'll be five minutes late.’”</blockquote>
        <div class="siri-voice-steps">
          <div><span>01</span><h3>Speak naturally.</h3><p>Name the app, the person, and the message in a single request.</p></div>
          <div><span>02</span><h3>Review the message.</h3><p>Keep the recipient and message together, so the intent stays visible.</p></div>
          <div><span>03</span><h3>Stay in control.</h3><p>Confirm Send or choose Cancel. A sent state makes the outcome clear.</p></div>
        </div>
        <p class="siri-voice-caption">2016 SiriKit interaction reconstruction for LINE.</p>
        <p class="siri-source">Hardware and background: Apple, 2016 · <a href="https://web.archive.org/web/20160914234642/https://www.apple.com/ios/ios-10/" target="_blank" rel="noopener noreferrer">iOS 10</a> · <a href="https://web.archive.org/web/20161019050542/apple.com/ios/home/" target="_blank" rel="noopener noreferrer">Siri reference</a></p>
      </div>
    </section>`;
  }
  function renderChip(){
    // Original 2016 iPhone 7 chip hero, with a new black display layer over the demo.
    // https://web.archive.org/web/20161018184700/apple.com/iphone-7/
    return `<section class="siri-chip" data-siri-chip aria-labelledby="siri-chip-title">
      <div class="wrap siri-chip-copy">
        <span class="siri-eyebrow">SiriKit · Voice messaging</span>
        <h2 id="siri-chip-title">Say it to Siri.<br>Send it with LINE.</h2>
        <p>A name. A message. One spoken request.</p>
      </div>
      <figure class="siri-chip-phone" aria-label="iPhone 7 with a reconstructed 2016 Siri waveform">
        <img src="${base}apple-iphone7-chip-2016.jpg" width="1104" height="1552" alt="Black iPhone 7, Apple 2016" loading="lazy">
        <div class="siri-chip-display" aria-hidden="true"></div>
        <div class="siri-chip-wave" data-siri-chip-wave role="img" aria-label="Animated multicolored Siri waveform"></div>
      </figure>
    </section>`;
  }
  function mountChip(motion){
    const container=document.querySelector('[data-siri-chip-wave]');
    if(!container || !window.SiriWave)return ()=>{};
    // Fixed, bounded backing store; CSS scales it with the original phone geometry.
    const wave=new SiriWave({container,style:'ios9',width:462,height:332,ratio:2,
      cover:true,autostart:false,speed:.12,amplitude:1.4,pixelDepth:.08});
    // Render a fully formed still immediately, including reduced-motion page entry.
    for(let frame=0;frame<40;frame++){wave.clear();wave.draw();}
    let visible=false,dead=false;
    function sync(){
      if(dead)return;
      if(visible && !document.hidden && !motion.matches)wave.start();else wave.stop();
    }
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});
    observer.observe(container);
    document.addEventListener('visibilitychange',sync);
    motion.addEventListener('change',sync);
    return ()=>{dead=true;observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);wave.dispose();};
  }
  function mount(){
    dispose();
    const root=document.querySelector('[data-siri-hero]');if(!root)return;
    const stage=root.firstElementChild,devices=[...root.querySelectorAll('.siri-device')];
    const title=root.querySelector('.siri-hero-title'),scrim=root.querySelector('.siri-hero-scrim');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const disposeChip=mountChip(motion);
    let raf=0,dead=false;
    function paint(){
      raf=0;if(dead)return;
      const w=stage.clientWidth,h=stage.clientHeight,r=root.getBoundingClientRect();
      const still=motion.matches || h<600;
      root.classList.toggle('is-static',still);
      const p=still?0:clamp(-r.top/Math.max(1,root.offsetHeight-h));
      const scale=Math.max(.42,Math.min(1,w/1440));
      devices.forEach(device=>{
        const x=+device.dataset.x*(w<736?1.3:1),y=+device.dataset.y;
        device.style.transform=`translate3d(${(x-175.5)*scale}px,${(y-421-device.dataset.travel*p)*scale}px,0) scale(${scale})`;
      });
      title.style.transform=`translate(-50%,calc(-50% + ${(30-220*p)*scale}px))`;
      title.style.opacity=String(1-clamp(p/.65));
      scrim.style.opacity=String(clamp((p-.68)/.32));
    }
    function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);motion.addEventListener('change',schedule);
    paint();
    dispose=()=>{dead=true;disposeChip();cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);motion.removeEventListener('change',schedule);dispose=()=>{};};
  }
  return {renderHero,renderVoice,renderChip,mount,cleanup:()=>dispose()};
})();
