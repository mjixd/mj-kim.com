/* 2016 Apple iOS 10: separate hardware/screen layers share one scroll timeline.
   Reference: https://web.archive.org/web/20160914234642/https://www.apple.com/ios/ios-10/ */
window.SiriStory = (() => {
  const base = 'assets/line/';
  const layers = [
    [-645,-70,520,'short'],[-323,-245,740,'review'],[0,-327,450,'sent'],
    [323,-175,620,'theme-b'],[645,-268,480,'alternate-review'],[-645,567,480,'theme-c'],
    [-323,392,600,'listening'],[0,585,360,'request'],[323,500,600,'alternate-sent'],[645,430,480,'long']
  ];
  const clamp = n => Math.max(0,Math.min(1,n));
  let dispose = () => {};
  function screen(state){
    return `<div class="siri-screen" data-siri-state="${state}"><img src="${base}siri-final-${state}.png" width="750" height="1334" alt="Original LINE SiriKit ${state} screen, 2016" decoding="async"></div>`;
  }
  function renderHero(){
    return `<section class="siri-hero" data-siri-hero aria-label="Siri for LINE, original 2016 interface designs">
      <div class="siri-hero-stage">
        <div class="siri-devices" aria-hidden="true">${layers.map(([x,y,travel,state])=>`<div class="siri-device" data-x="${x}" data-y="${y}" data-travel="${travel}"><img src="${base}apple-iphone-2016.png" alt="" width="702" height="1320">${screen(state)}</div>`).join('')}</div>
        <div class="siri-hero-title"><p>2016 · SiriKit</p><h1>Siri<br> for LINE</h1></div>
        <div class="siri-hero-scrim" aria-hidden="true"></div>
        <p class="siri-hero-note">Original LINE designs · Speak. Review. Send.</p>
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
        <p class="siri-voice-caption">Original LINE interface designs from the 2016 SiriKit exploration.</p>
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
        <div class="siri-chip-sequence" aria-hidden="true"><span>Speak</span><i></i><span>Review</span><i></i><span>Send</span></div>
        <button class="siri-chip-playback" type="button" data-siri-playback aria-label="Pause Siri demonstration">Pause animation</button>
      </div>
      <figure class="siri-chip-phone" aria-label="iPhone 7 with a reconstructed 2016 Siri waveform">
        <img src="${base}apple-iphone7-chip-2016.jpg" width="1104" height="1552" alt="Black iPhone 7, Apple 2016" loading="lazy">
        <div class="siri-chip-display" aria-hidden="true"></div>
        <div class="siri-chip-messages" aria-hidden="true">${['request','review','sent'].map(state=>`<img data-siri-message="${state}" src="${base}siri-final-${state}.png" alt="Original LINE ${state} screen" width="750" height="1334">`).join('')}</div>
        <div class="siri-chip-wave" data-siri-chip-wave role="img" aria-label="Animated multicolored Siri waveform"></div>
      </figure>
    </section>`;
  }
  function makeWave(container,width,height){
    const wave=new SiriWave({container,style:'ios9',width,height,ratio:2,
      cover:true,autostart:false,speed:.12,amplitude:1.4,pixelDepth:.08});
    for(let i=0;i<40;i++){wave.clear();wave.draw();}
    return wave;
  }
  function mountCover(){
    dispose();
    const container=document.querySelector('[data-siri-cover]');
    if(!container||!window.SiriWave)return;
    const wave=makeWave(container,1000,428),motion=matchMedia('(prefers-reduced-motion: reduce)');
    let visible=false;
    function sync(){if(visible&&!document.hidden&&!motion.matches)wave.start();else wave.stop();}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});
    observer.observe(container);document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
    dispose=()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);wave.dispose();dispose=()=>{};};
  }
  function renderCover(){return '<div class="kv wide siri-cover"><div data-siri-cover role="img" aria-label="Animated multicolored Siri waveform"></div></div>';}
  function mountChip(motion){
    const root=document.querySelector('[data-siri-chip]'),container=root?.querySelector('[data-siri-chip-wave]');
    if(!container||!window.SiriWave)return ()=>{};
    const wave=makeWave(container,462,332),messages=[...root.querySelectorAll('[data-siri-message]')];
    const button=root.querySelector('[data-siri-playback]');
    let visible=false,dead=false,paused=false,raf=0,last=0,elapsed=0;
    function paint(){
      const time=motion.matches?7900:elapsed%10800;
      const fade=(start,end)=>clamp((time-start)/650)*(1-clamp((time-end)/650));
      const weights=[fade(2500,4300),fade(4300,7300),fade(7300,9700)];
      const scene=time<2500?'listening':time<4300?'request':time<7300?'review':'sent';
      root.dataset.siriChipStage=scene;
      messages.forEach((img,i)=>{const alpha=weights[i];img.style.opacity=alpha;img.style.transform='translateY('+(1-alpha)*10+'px)';});
      container.style.opacity=String(1-clamp((time-2300)/650)+clamp((time-10000)/650));
      if(visible&&!paused&&!document.hidden&&!motion.matches&&time<3000)wave.start();else wave.stop();
    }
    function frame(now){raf=0;if(dead)return;if(last)elapsed+=Math.min(100,now-last);last=now;paint();raf=requestAnimationFrame(frame);}
    function sync(){
      cancelAnimationFrame(raf);raf=0;last=0;
      paint();
      if(visible&&!document.hidden&&!motion.matches&&!paused)raf=requestAnimationFrame(frame);
      button.hidden=motion.matches;
    }
    const observer=new IntersectionObserver(entries=>{const next=entries[0].isIntersecting;if(next&&!visible)elapsed=0;visible=next;sync();});
    observer.observe(root.querySelector('.siri-chip-phone'));
    function toggle(){paused=!paused;button.textContent=paused?'Play animation':'Pause animation';button.setAttribute('aria-label',(paused?'Play':'Pause')+' Siri demonstration');sync();}
    button.addEventListener('click',toggle);document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);sync();
    return ()=>{dead=true;cancelAnimationFrame(raf);observer.disconnect();button.removeEventListener('click',toggle);document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);wave.dispose();};
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
  return {renderHero,renderVoice,renderChip,renderCover,mount,mountCover,cleanup:()=>dispose()};
})();
