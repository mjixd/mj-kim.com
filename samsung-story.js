/* Native scroll position owns every phase, including reverse and interruption. */
(() => {
  let disposers = [];
  const source = 'assets/samsung/unfold-workspace.mp4';
  const two = 'assets/samsung/fold-two.png';
  const three = 'assets/samsung/fold-three.png';
  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const image = (src, count, className, loading) => `<img class="${className}" src="${src}" width="974" height="747" loading="${loading}" alt="SmartThings Pro ${count}-window workspace on an unfolded Galaxy Z Fold8">`;
  function render() {
    return `<section class="samsung-story samsung-story--hero" data-samsung-story aria-label="Samsung unfolding workspace">
      <div class="samsung-story__stage">
        <div class="samsung-story__visual">
          <img class="samsung-story__poster" src="assets/samsung/fold-start.png" width="1000" height="616" alt="" aria-hidden="true" fetchpriority="high">
          <video muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <img class="samsung-story__interface" src="assets/samsung/unfold-workspace-end.png" width="646" height="452" loading="eager" alt="SmartThings Pro two-window workspace on an unfolded Galaxy Z Fold8">
        </div>
      </div>
    </section>
    <section class="band" aria-labelledby="samsung-story-title">
      <div class="slide wrap">
        <h2 id="samsung-story-title">From monitoring to on-site control.</h2>
        <p>Connected devices and visitor workflows, together in one workspace.</p>
        <p><a href="https://play.google.com/store/apps/details?id=com.samsung.space.pnpt.stpm&amp;hl=en" target="_blank" rel="noopener noreferrer">SmartThings Pro Mobile</a> connects workplace access, room and seat reservations, calendar syncing, visitor invitations, support requests, and lighting and temperature control. Available to users authorized by their company’s administrator, the experience adapts to each space’s enabled services and operating policies.</p>
      </div>
    </section>`;
  }
  function renderWorkspace() {
    return `<section class="samsung-story samsung-story--workspace" data-samsung-workspace aria-labelledby="samsung-workspace-title">
      <div class="samsung-story__stage">
        <div class="samsung-story__copy">
          <span class="samsung-story__eyebrow">An adaptable workspace</span>
          <h2 id="samsung-workspace-title">Two tasks. Room for one more.</h2>
          <p>Manage devices and visitor access side by side. Bring a third view into the same workspace, keeping the controls familiar as priorities change.</p>
        </div>
        <div class="samsung-story__visual">
          ${image(two, 'two', 'samsung-story__two', 'lazy')}
          ${image(three, 'three', 'samsung-story__three', 'lazy')}
        </div>
        <p class="samsung-story__credit">Adaptive layout exploration using SmartThings Pro mobile screens and the SmartThings interface.</p>
      </div>
    </section>`;
  }
  function mountScene(root) {
    const video = root.querySelector('video');
    const workspace = root.hasAttribute('data-samsung-workspace');
    const visual = root.querySelector('.samsung-story__visual');
    let startScale = 1, startY = 0;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, near = false, enabled = false, failed = false, ready = false, raf = 0, target = 0, requested = -1;
    function seek() {
      if (!active || !video || !ready || video.seeking || video.readyState < 1) return;
      if (Math.abs(video.currentTime - target) > .025 && Math.abs(requested - target) > .025) {
        requested = target; video.currentTime = target;
      }
    }
    function draw() {
      raf = 0;
      if (!active) return;
      const progress = enabled ? clamp(-root.getBoundingClientRect().top / Math.max(1, root.offsetHeight - innerHeight)) : 1;
      if (workspace) {
        const blend = enabled ? ease((progress - .34) / .32) : 0;
        root.style.setProperty('--two-opacity', enabled ? 1 - blend : 1);
        root.style.setProperty('--three-opacity', enabled ? blend : 1);
        return;
      }
      const moving = enabled && !failed;
      const reveal = moving ? ease((progress - .58) / .16) : 1;
      const zoom = moving ? ease((progress - .74) / .20) : 1;
      root.style.setProperty('--poster-opacity', moving && !ready ? 1 - reveal : 0);
      root.style.setProperty('--hardware-opacity', moving && ready && reveal < 1 ? 1 : 0);
      root.style.setProperty('--interface-opacity', reveal);
      root.style.setProperty('--interface-scale', startScale + (1 - startScale) * zoom);
      root.style.setProperty('--interface-y', (startY * (1 - zoom)) + '%');
      target = Number.isFinite(video.duration) ? Math.max(0, Math.min(video.duration - .05, clamp(progress / .58) * video.duration)) : 0;
      seek();
    }
    function queue() { if (!raf) raf = requestAnimationFrame(draw); }
    function release() {
      ready = false; requested = -1;
      if (video?.hasAttribute('src')) {
        video.pause(); video.removeAttribute('src'); video.load();
      }
    }
    function reconcile() {
      if (!active) return;
      enabled = innerWidth > 820 && innerHeight >= 700 && !motion.matches;
      root.classList.toggle('samsung-story--motion', enabled);
      if (video) {
        // Register the cropped end frame to the video's contained pixels before enlarging it.
        const { width, height } = visual.getBoundingClientRect();
        const videoScale = Math.min(width / 1396, height / 860);
        const endScale = Math.min(width / 646, height / 452);
        startScale = videoScale / endScale;
        startY = ((18 + 452 / 2) - 860 / 2) * videoScale / height * 100;
      }
      if (video) {
        if (enabled && near && !document.hidden && !failed) {
          if (!video.hasAttribute('src')) { video.src = source; video.load(); }
        } else release();
      }
      draw();
    }
    function loaded() { if (active && video.hasAttribute('src')) { ready = true; draw(); } }
    function error() { if (!active) return; failed = true; release(); draw(); }
    const observer = video ? new IntersectionObserver(entries => { near = entries[0].isIntersecting; reconcile(); }, { rootMargin: '300px 0px' }) : null;
    observer?.observe(root);
    video?.addEventListener('loadeddata', loaded);
    video?.addEventListener('seeked', seek);
    video?.addEventListener('error', error);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    motion.addEventListener('change', reconcile);
    reconcile();
    return () => {
      active = false; cancelAnimationFrame(raf); observer?.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
      motion.removeEventListener('change', reconcile);
      video?.removeEventListener('loadeddata', loaded);
      video?.removeEventListener('seeked', seek);
      video?.removeEventListener('error', error);
      release();
    };
  }
  function cleanup() { disposers.forEach(dispose => dispose()); disposers = []; }
  function mount() {
    cleanup();
    disposers = [...document.querySelectorAll('[data-samsung-story],[data-samsung-workspace]')].map(mountScene);
  }
  window.SamsungStory = { render, renderWorkspace, mount, cleanup };
})();
