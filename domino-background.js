window.DominoBackground = (() => {
  let dispose = () => {};
  function render(background) {
    return `<section class="band domino-background" data-domino-background>
      <div class="wrap">
        <div class="slide"><h2>Background</h2><p>${background}</p></div>
        <figure class="domino-background__figure" aria-label="Domino landscape investment chart from Figma frame 2074">
          <div class="domino-background__device">
            <img src="assets/domino/background/landscape-2074.png" width="3142" height="1800" alt="Domino's investment chart in a landscape iPhone mockup" loading="lazy" decoding="async">
            <div class="domino-background__screen">
              <video data-domino-background-video muted playsinline loop preload="none" aria-label="Domino investment chart demonstration"></video>
            </div>
          </div>
          <button class="domino-background__control" type="button" aria-label="Play chart demonstration"></button>
        </figure>
        <div class="domino-background__copy" data-domino-background-copy>
          <div><h3>Motivation</h3><p>Domino began as a mobile side project inspired by highly engaged Korean investors who used Excel to manage their assets. The goal was to bring the depth of desktop portfolio tools into a simpler, more accessible mobile experience.</p></div>
          <div><h3>Domino MVP: An Investment Tracker</h3><p>I designed the first 0→1 demo to establish portfolio tracking as the foundation for a comprehensive investment service. Users could manually enter holdings and average purchase prices, then view real-time price charts, portfolio valuations, asset performance trends, and total returns in one place.</p></div>
        </div>
      </div>
    </section>`;
  }
  function mount() {
    dispose();
    const section = document.querySelector('[data-domino-background]');
    if (!section) return;
    const video = section.querySelector('video');
    const screen = video.parentElement;
    const button = section.querySelector('button');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let dead = false, visible = false, userPaused = motion.matches, blocked = false, pending = null;
    const eligible = () => !dead && visible && !document.hidden && !userPaused && !blocked;
    function controls() {
      const paused = userPaused || blocked;
      const label = paused ? 'Play chart demonstration' : 'Pause chart demonstration';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(!paused));
      button.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${paused ? '<path d="M4 2v12l10-6z"/>' : '<path d="M3 2h4v12H3zm6 0h4v12H9z"/>'}</svg>`;
    }
    function unload() {
      pending = null;
      video.pause();
      screen.classList.remove('is-playing');
      if (video.hasAttribute('src')) { video.removeAttribute('src'); video.load(); }
    }
    function sync() {
      if (dead || !visible || document.hidden) { unload(); return; }
      if (!eligible()) { video.pause(); return; }
      if (!video.hasAttribute('src')) {
        video.src = matchMedia('(max-width: 820px)').matches ? 'assets/domino/background/chart-mobile.mp4' : 'assets/videos/domino-chart.mp4';
        video.muted = true;
      }
      if (!video.paused || pending) return;
      const token = {}; pending = token;
      Promise.resolve(video.play()).then(() => {
        if (pending === token && !eligible()) video.pause();
      }).catch(() => {
        if (pending !== token || !eligible()) return;
        blocked = true; controls(); sync();
      }).finally(() => { if (pending === token) pending = null; });
    }
    function playing() {
      if (!eligible()) { video.pause(); return; }
      screen.classList.add('is-playing');
    }
    function toggle() { userPaused = !(userPaused || blocked); blocked = false; controls(); sync(); }
    function preference() { userPaused = motion.matches; blocked = false; controls(); sync(); }
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(video);
    button.addEventListener('click', toggle);
    video.addEventListener('playing', playing);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', preference);
    controls();
    dispose = () => {
      dead = true; observer.disconnect(); unload();
      button.removeEventListener('click', toggle);
      video.removeEventListener('playing', playing);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', preference);
      dispose = () => {};
    };
  }
  return { render, mount, cleanup: () => dispose() };
})();
