/* 2016 Apple iOS 10: separate hardware/screen layers share one scroll timeline.
   Reference: https://web.archive.org/web/20160914234642/https://www.apple.com/ios/ios-10/ */
window.SiriStory = (() => {
  const base = 'assets/line/';
  const layers = [
    [-645,-70,520,'short'],[-323,-245,740,'sky'],[0,-327,450,'sent'],
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
        <div class="siri-hero-title"><p>Apple x LINE</p><h1>Siri<br> for LINE</h1></div>
        <div class="siri-hero-scrim" aria-hidden="true"></div>
        <p class="siri-hero-note">Original LINE designs · Speak. Review. Send.</p>
      </div>
    </section>`;
  }
  function renderVoice(){
    return `<section class="siri-voice" data-siri-voice aria-labelledby="siri-voice-title">
      <div class="wrap siri-voice-inner">
        <h2 id="siri-voice-title">A message starts<br>with your voice.</h2>
        <p class="siri-voice-lead">Say who it is for and what you want to say. Siri turns the request into a LINE message you can review before sending.</p>
        <div class="siri-theme-pair" data-siri-themes>
          ${[['seasonal-chat','Cherry-blossom LINE chat'],['final-sky','Sky-themed Siri message review']].map(([file,label])=>`<figure class="siri-theme-phone" aria-label="${label}"><img class="siri-theme-hardware" src="${base}apple-iphone-2016.png" alt="Black iPhone" width="702" height="1320" loading="lazy"><div class="siri-theme-screen"><img src="${base}siri-${file}.png" alt="${label}" width="750" height="1334" loading="lazy"><div class="siri-theme-petals" data-siri-petals aria-hidden="true"></div></div></figure>`).join('')}
        </div>
        <p class="siri-theme-description">Cherry-blossom and sky themes carry LINE’s familiar visual identity into the conversation.</p>
        <button class="siri-petals-toggle" type="button" data-petals-toggle aria-pressed="false">Pause petals</button>
        <div class="siri-voice-steps">
          <div><h3>Speak naturally.</h3><p>Name the app, the person, and the message in a single request.</p></div>
          <div><h3>Review the message.</h3><p>Keep the recipient and message together, so the intent stays visible.</p></div>
          <div><h3>Stay in control.</h3><p>Confirm Send or choose Cancel. A sent state makes the outcome clear.</p></div>
        </div>
        <p class="siri-voice-caption">Original LINE interface designs from the 2016 SiriKit exploration.</p>
        <p class="siri-source">Petal animation: <a href="https://lottiefiles.com/free-animation/cherry-flowers-p7WIofua7Q" target="_blank" rel="noopener noreferrer">Syed Asim Ali Shah</a> · Branch-free adaptation · <a href="https://lottiefiles.com/page/license" target="_blank" rel="noopener noreferrer">Lottie Simple License</a></p>
        <p class="siri-source">Hardware and background: Apple, 2016 · <a href="https://web.archive.org/web/20160914234642/https://www.apple.com/ios/ios-10/" target="_blank" rel="noopener noreferrer">iOS 10</a> · <a href="https://web.archive.org/web/20161019050542/apple.com/ios/home/" target="_blank" rel="noopener noreferrer">Siri reference</a></p>
      </div>
    </section>`;
  }
  function renderChip(){
    // Original 2016 iPhone 7 chip hero, with a new black display layer over the demo.
    // https://web.archive.org/web/20161018184700/apple.com/iphone-7/
    return `<section class="siri-chip" data-siri-chip aria-labelledby="siri-chip-title">
      <div class="wrap siri-chip-copy">
        <h2 id="siri-chip-title">Say it to Siri.<br>Send it with LINE.</h2>
        <p>A name. A message. One spoken request.</p>
        <button class="siri-chip-playback" type="button" data-siri-playback aria-label="Pause Siri demonstration"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg></button>
      </div>
      <figure class="siri-chip-phone" aria-label="iPhone 7 demonstrating a spoken request and LINE message review">
        <img src="${base}apple-iphone7-chip-2016.jpg" width="1104" height="1552" alt="Black iPhone 7, Apple 2016" loading="lazy">
        <div class="siri-chip-display" aria-hidden="true"></div>
        <div class="siri-chip-ui" aria-label="Original 2016 Siri and LINE interface">
          <img class="siri-chip-background" data-siri-background src="${base}siri-layer-background.png" alt="" width="750" height="1334">
          <img class="siri-chip-status" data-siri-status src="${base}siri-layer-status.png" alt="iPhone status bar" width="725" height="19">
          <div class="siri-chip-request" data-siri-request aria-label="Send Nancy a line message can you get the notebook off my desk?"></div>
          <img class="siri-chip-edit" data-siri-edit src="${base}siri-layer-edit.png" alt="tap to edit" width="147" height="32">
          <img class="siri-chip-response" data-siri-response src="${base}siri-layer-response.png" alt="Here’s your LINE message:" width="494" height="37">
          <img class="siri-chip-card" data-siri-card src="${base}siri-layer-card.png" alt="LINE message to Nancy: Can you get the notebook off my desk? Cancel or Send." width="694" height="434">
        </div>
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
    const wave=makeWave(container,462,332);
    const request=root.querySelector('[data-siri-request]');
    const background=root.querySelector('[data-siri-background]'),edit=root.querySelector('[data-siri-edit]');
    const response=root.querySelector('[data-siri-response]'),card=root.querySelector('[data-siri-card]');
    // Text and typography transcribed from the original PSD +txt request layer.
    const utterance='“Send Nancy a line message can \nyou get the notebook off my \ndesk?”';
    const button=root.querySelector('[data-siri-playback]');
    let visible=false,dead=false,paused=false,raf=0,last=0,elapsed=0;
    function paint(){
      const time=motion.matches?8500:elapsed%12000;
      const exit=1-clamp((time-10200)/800);
      const typed=Math.floor(clamp((time-1500)/3100)*utterance.length);
      const text=time>=11000?'':utterance.slice(0,typed);
      if(request.textContent!==text)request.textContent=text;
      root.dataset.siriChipStage=time<1500||time>=11000?'listening':time<5300?'request':'review';
      background.style.opacity=String(clamp((time-1400)/1000)*exit);
      request.style.opacity=String(exit);
      edit.style.opacity=String(clamp((time-4700)/350)*exit);
      response.style.opacity=String(clamp((time-4950)/450)*exit);
      const rise=clamp((time-5300)/1000),eased=1-Math.pow(1-rise,4);
      card.style.opacity=String(clamp(rise*3)*exit);
      card.style.transform='translateY('+((1-eased)*65)+'%)';
      container.style.opacity=String((1-clamp((time-1600)/900))+clamp((time-11000)/650));
      if(visible&&!paused&&!document.hidden&&!motion.matches&&(time<2500||time>=11000))wave.start();else wave.stop();
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
    function toggle(){paused=!paused;button.innerHTML=paused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';button.setAttribute('aria-label',(paused?'Play':'Pause')+' Siri demonstration');sync();}
    button.addEventListener('click',toggle);document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);sync();
    return ()=>{dead=true;cancelAnimationFrame(raf);observer.disconnect();button.removeEventListener('click',toggle);document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);wave.dispose();};
  }
  function mountPetals(motion){
    const root=document.querySelector('[data-siri-themes]');
    if(!root || !window.lottie)return ()=>{};
    const button=document.querySelector('[data-petals-toggle]');
    let visible=false,paused=false,dead=false;
    const animations=[...root.querySelectorAll('[data-siri-petals]')].map((container,index)=>{
      const animation=lottie.loadAnimation({container,renderer:'svg',loop:true,autoplay:false,
        path:base+'cherry-petals.json',name:'siri-petals-'+index,
        rendererSettings:{preserveAspectRatio:'xMidYMid slice'}});
      animation.setSpeed(.65);
      animation.addEventListener('DOMLoaded',()=>{if(dead)return;animation.goToAndStop(index*45,true);sync();});
      return animation;
    });
    function sync(){
      if(dead)return;
      const play=visible&&!document.hidden&&!motion.matches&&!paused;
      animations.forEach(animation=>play?animation.play():animation.pause());
      root.dataset.playing=String(play);
      button.hidden=motion.matches;
    }
    function toggle(){paused=!paused;button.textContent=paused?'Play petals':'Pause petals';button.setAttribute('aria-pressed',String(paused));sync();}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05});
    observer.observe(root);button.addEventListener('click',toggle);
    document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);sync();
    return ()=>{dead=true;observer.disconnect();button.removeEventListener('click',toggle);document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);animations.forEach(animation=>animation.destroy());};
  }
  function mount(){
    dispose();
    const root=document.querySelector('[data-siri-hero]');if(!root)return;
    const stage=root.firstElementChild,devices=[...root.querySelectorAll('.siri-device')];
    const title=root.querySelector('.siri-hero-title'),scrim=root.querySelector('.siri-hero-scrim');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const disposeChip=mountChip(motion);
    const disposePetals=mountPetals(motion);
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
    dispose=()=>{dead=true;disposeChip();disposePetals();cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);motion.removeEventListener('change',schedule);dispose=()=>{};};
  }
  return {renderHero,renderVoice,renderChip,renderCover,mount,mountCover,cleanup:()=>dispose()};
})();
