/* One scroll position owns both the hardware seek and the interface reveal. */
(() => {
  let dispose = () => {};
  const source = 'assets/samsung/unfold.mp4';
  function render() {
    return `<section class="samsung-story" data-samsung-story aria-labelledby="samsung-story-title">
      <div class="samsung-story__stage">
        <div class="samsung-story__layout">
          <div class="samsung-story__copy">
            <span class="samsung-story__eyebrow">Samsung · B2B mobile experience</span>
            <h2 id="samsung-story-title">From monitoring<br>to on-site control.</h2>
            <p>Reframing complex operations into a mobile flow for immediate decisions and action.</p>
          </div>
          <div class="samsung-story__visual">
            <img class="samsung-story__interface" src="assets/samsung/EN-15-ai-office.png" width="850" height="1726" loading="lazy" alt="AI Office mobile interface with room filters and controls for lights, blinds, and connected devices">
            <video muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          </div>
        </div>
        <p class="samsung-story__credit">Hardware imagery: <a href="https://www.samsung.com/sec/smartphones/galaxy-z-fold8/" target="_blank" rel="noopener noreferrer">Samsung Galaxy Z Fold8</a> · AI Office interface: Minjung Kim</p>
      </div>
    </section>`;
  }
  function mount() {
    dispose();
    const root = document.querySelector('[data-samsung-story]');
    if (!root) return;
    const video = root.querySelector('video');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, near = false, enabled = false, failed = false, ready = false, raf = 0, target = 0, requested = -1;
    const clamp = value => Math.min(1, Math.max(0, value));
    function seek() {
      if (!active || !ready || video.seeking || video.readyState < 1) return;
      if (Math.abs(video.currentTime - target) > .025 && Math.abs(requested - target) > .025) {
        requested = target; video.currentTime = target;
      }
    }
    function draw() {
      raf = 0;
      if (!active) return;
      const progress = enabled ? clamp(-root.getBoundingClientRect().top / Math.max(1, root.offsetHeight - innerHeight)) : 1;
      const reveal = clamp((progress - .62) / .23);
      const eased = reveal * reveal * (3 - 2 * reveal);
      const usable = enabled && ready;
      root.style.setProperty('--hardware-opacity', usable ? 1 - eased : 0);
      root.style.setProperty('--interface-opacity', usable ? eased : 1);
      target = Number.isFinite(video.duration) ? Math.min(video.duration - .05, clamp(progress / .64) * video.duration) : 0;
      seek();
    }
    function queue() { if (!raf) raf = requestAnimationFrame(draw); }
    function release() {
      ready = false; requested = -1;
      if (video.hasAttribute('src')) {
        video.pause(); video.removeAttribute('src'); video.load();
      }
    }
    function reconcile() {
      if (!active) return;
      enabled = innerWidth > 820 && innerHeight >= 700 && !motion.matches;
      root.classList.toggle('samsung-story--motion', enabled);
      if (enabled && near && !document.hidden && !failed) {
        if (!video.hasAttribute('src')) { video.src = source; video.load(); }
      } else release();
      draw();
    }
    function loaded() { if (active && video.hasAttribute('src')) { ready = true; draw(); } }
    function error() { failed = true; release(); draw(); }
    const observer = new IntersectionObserver(entries => { near = entries[0].isIntersecting; reconcile(); }, { rootMargin: '300px 0px' });
    observer.observe(root);
    video.addEventListener('loadeddata', loaded);
    video.addEventListener('seeked', seek);
    video.addEventListener('error', error);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    motion.addEventListener('change', reconcile);
    reconcile();
    dispose = () => {
      active = false; cancelAnimationFrame(raf); observer.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
      motion.removeEventListener('change', reconcile);
      video.removeEventListener('loadeddata', loaded);
      video.removeEventListener('seeked', seek);
      video.removeEventListener('error', error);
      release(); dispose = () => {};
    };
  }
  window.SamsungStory = { render, mount, cleanup: () => dispose() };
})();
