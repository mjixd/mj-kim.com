/* Original Figma frame 2073 coordinates; each video replaces only its screen. */
window.DominoZoom = (() => {
  const phones = [
    ['overview',4464,2952,0,0,'Portfolio overview'],
    ['overview-secondary',7415,1078,0,0,'Buy order'],
    ['edit-accounts',8879,2220,0,0,'Edit investment accounts'],
    ['uncategorized',8879,5042,0,0,'Uncategorized assets'],
    ['watchlist',44,2350,0,0,'Investment watchlist'],
    ['currency',1529,562,0,0,'Currency settings'],
    ['account-drawer',44,5175,0,0,'Account navigation'],
    ['asset-selector',1524,6204,0,0,'Select visible assets'],
    ['assistant',7409,3898,0,0,'Portfolio assistant'],
    ['dividends',5939,5323,215,2372,'Dividend analysis'],
    ['markets',2994,1890,211,2372,'Market overview'],
    ['net-worth',2994,4712,216,2367,'Net worth analysis'],
    ['price-alert',1524,3382,216,2348,'Price alerts'],
    ['returns',5934,2500,213,2352,'Investment returns'],
    ['edit-assets',4459,132,0,0,'Edit portfolio assets'],
    ['calendar',4483,5774,210,2374,'Dividend calendar']
  ];
  const base = 'assets/domino/zoom/';
  const clamp = n => Math.max(0,Math.min(1,n));
  const smooth = n => { n=clamp(n);return n*n*(3-2*n); };
  let dispose = () => {};
  function render(){
    return `<section class="domino-zoom" data-domino-zoom aria-label="Explore Domino's portfolio tools">
      <div class="domino-zoom__sticky"><div class="domino-zoom__board">
      ${phones.map(([name,x,y,top,height,label]) => `<div class="domino-zoom__phone" data-domino-phone="${name}" ${name==='overview'?'data-domino-center':'data-domino-peripheral'} style="left:${x}px;top:${y}px">
        <img class="domino-zoom__buttons" src="${base}buttons.png" alt="" width="1300" height="645" loading="lazy">
        <img class="domino-zoom__body" src="${base+name}.png?v=2073-final" alt="${label}" width="1280" height="2642" loading="lazy" decoding="async">
        ${height?`<video data-src="${base+name}.mp4" muted playsinline loop preload="none" aria-label="${label} demonstration" style="top:${top/2642*100}%;height:${height/2642*100}%"></video>`:''}
      </div>`).join('')}</div>
      <button class="domino-zoom__control" type="button" data-domino-playback aria-label="Pause animations"></button>
      </div></section>`;
  }
  function mount(){
    dispose();
    const section=document.querySelector('[data-domino-zoom]');
    if(!section)return;
    const sticky=section.firstElementChild,board=sticky.firstElementChild;
    const peripheral=[...section.querySelectorAll('[data-domino-peripheral]')];
    const videos=[...section.querySelectorAll('video')],button=section.querySelector('[data-domino-playback]');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let dead=false,raf=0,progress=0,userPaused=motion.matches,blocked=false,visible=false;
    const pending=new WeakSet();
    const shouldPlay=()=>!dead && visible && !document.hidden && !userPaused && !blocked && (motion.matches || progress>.42);
    function controls(){
      const paused=userPaused||blocked;
      const label=paused?'Play animations':'Pause animations';
      button.setAttribute('aria-label',label);
      button.setAttribute('aria-pressed',String(!paused));
      button.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true">${paused?'<path d="M4 2v12l10-6z"/>':'<path d="M3 2h4v12H3zm6 0h4v12H9z"/>'}</svg><span>${label}</span>`;
    }
    function media(){
      const play=shouldPlay();
      videos.forEach(video=>{
        if(!play){video.pause();video.classList.remove('is-playing');return;}
        if(!video.src){video.src=video.dataset.src;video.muted=true;}
        if(!video.paused || pending.has(video))return;
        pending.add(video);
        const request=video.play();
        Promise.resolve(request).then(()=>{if(!shouldPlay())video.pause();}).catch(()=>{
          if(!shouldPlay())return;
          blocked=true;controls();media();
        }).finally(()=>pending.delete(video));
      });
    }
    function playing(event){
      if(!shouldPlay()){event.target.pause();return;}
      event.target.classList.add('is-playing');
    }
    function paint(){
      raf=0;if(dead)return;
      const rect=section.getBoundingClientRect(),w=sticky.clientWidth,h=sticky.clientHeight;
      visible=rect.top<h && rect.bottom>0;
      progress=motion.matches?1:clamp(-rect.top/Math.max(1,rect.height-h));
      const t=smooth(progress/.82),alpha=motion.matches?1:smooth((progress-.18)/.38);
      const start=Math.max(w*1.12/1300,h*1.8/2642);
      // Include the Figma shadows in the final composition bounds.
      const end=Math.min((w-48)/10635,(h-160)/9214);
      const scale=start+(end-start)*t;
      // Keep the balance readable within the intentional mobile close-up crop.
      const startX=4464+(w<768?440:650);
      const cx=startX+(5191.5-startX)*t,cy=3302+(4569-3302)*t;
      const targetY=96+(h/2+24-96)*t;
      board.style.transform=`translate(${w/2-cx*scale}px,${targetY-cy*scale}px) scale(${scale})`;
      peripheral.forEach(phone=>phone.style.opacity=alpha);
      media();
    }
    function schedule(){if(!raf)raf=requestAnimationFrame(paint);}
    function toggle(){userPaused=!(userPaused||blocked);blocked=false;controls();media();}
    function visibility(){if(document.hidden)media();else schedule();}
    function preference(){userPaused=motion.matches;blocked=false;section.classList.toggle('is-static',motion.matches);controls();paint();}
    button.addEventListener('click',toggle);
    videos.forEach(video=>video.addEventListener('playing',playing));
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    document.addEventListener('visibilitychange',visibility);
    motion.addEventListener('change',preference);
    preference();
    dispose=()=>{
      dead=true;cancelAnimationFrame(raf);
      window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);
      document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',preference);
      button.removeEventListener('click',toggle);
      videos.forEach(video=>{video.pause();video.removeEventListener('playing',playing);video.removeAttribute('src');video.load();});
      dispose=()=>{};
    };
  }
  return {render,mount,cleanup:()=>dispose()};
})();
