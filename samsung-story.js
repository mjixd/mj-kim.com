/* Native scroll position owns every phase, including reverse and interruption. */
(() => {
  let disposers = [];
  const source = 'assets/samsung/unfold-ai-workspace.mp4?v=masters-20261019';
  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  function render() {
    return `<section class="samsung-story samsung-story--hero" data-samsung-story aria-label="Samsung unfolding workspace">
      <div class="samsung-story__stage">
        <h2 class="samsung-story__heading">From monitoring<br> to on-site control.</h2>
        <div class="samsung-story__visual">
          <img class="samsung-story__poster" src="assets/samsung/fold-start.png" width="1000" height="616" alt="" aria-hidden="true" fetchpriority="high">
          <video muted playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
          <img class="samsung-story__interface" src="assets/samsung/ai-agent-open-4x.png?v=masters-20261019" width="3896" height="2988" loading="eager" alt="SmartThings Pro device controls and AI Agent on an unfolded Galaxy Z Fold8">
        </div>
      </div>
    </section>
    <section class="band samsung-story__overview" aria-label="SmartThings Pro Mobile overview">
      <div class="slide wrap">
        <p>Connected devices and visitor workflows, together in one workspace.</p>
        <p>Samsung’s <a href="https://play.google.com/store/apps/details?id=com.samsung.space.pnpt.stpm&amp;hl=en" target="_blank" rel="noopener noreferrer">SmartThings Pro Mobile</a> connects workplace access, room and seat reservations, calendar syncing, visitor invitations, support requests, and lighting and temperature control. Available to users authorized by their company’s administrator, the experience adapts to each space’s enabled services and operating policies.</p>
      </div>
    </section>`;
  }
  function renderWorkspace() {
    return SamsungWorkspace.render();
  }
  function mountScene(root) {
    const video = root.querySelector('video');
    const visual = root.querySelector('.samsung-story__visual');
    const stage = root.querySelector('.samsung-story__stage');
    const overview = root.nextElementSibling?.matches('.samsung-story__overview') ? root.nextElementSibling : null;
    let mobile = false;
    let startScale = 1, startY = 0, maxScale = 1;
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
      const progress = enabled ? clamp(-root.getBoundingClientRect().top / Math.max(1, root.offsetHeight - (mobile ? stage.offsetHeight : innerHeight))) : 1;
      const moving = enabled && !failed;
      const reveal = moving ? ease((progress - .76) / .08) : 1;
      const zoom = moving ? ease((progress - .84) / .14) : 1;
      root.style.setProperty('--poster-opacity', moving && !ready ? 1 - reveal : 0);
      root.style.setProperty('--hardware-opacity', moving && ready && reveal < 1 ? 1 : 0);
      root.style.setProperty('--interface-opacity', reveal);
      root.style.setProperty('--interface-scale', moving ? startScale + (maxScale - startScale) * zoom : .9);
      root.style.setProperty('--interface-y', (startY * (1 - zoom)) + '%');
      target = Number.isFinite(video.duration) ? Math.max(0, Math.min(video.duration - .05, clamp(progress / .76) * video.duration)) : 0;
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
      mobile = innerWidth <= 820;
      enabled = (mobile || (innerWidth > 820 && innerHeight >= 700)) && !motion.matches;
      root.classList.toggle('samsung-story--motion', enabled);
      // Keep the explanation beside the mobile scene throughout the scroll.
      if (overview) {
        if (mobile && enabled && overview.parentElement !== stage) stage.append(overview);
        else if ((!mobile || !enabled) && overview.parentElement === stage) root.after(overview);
      }
      if (video) {
        // Match the straight-on terminal video frame before handing off to the 4x master.
        const { width, height } = visual.getBoundingClientRect();
        const videoScale = Math.min(width / 1396, height / 860);
        const endScale = Math.min(width / 974, height / 747);
        startScale = videoScale / endScale;
        // Keep the whole device framed at the endpoint, including a small vertical inset.
        maxScale = mobile ? .9 : Math.min(1, innerWidth * .6 / (974 * endScale), Math.max(1, height - 32) / (747 * endScale)) * .9;
        startY = (height - 860 * videoScale + (56 + 747 / 2) * videoScale - height / 2) / height * 100;
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
      if (overview?.parentElement === stage) root.after(overview);
    };
  }
  function cleanup() { disposers.forEach(dispose => dispose()); disposers = []; }
  function mount() {
    cleanup();
    disposers = [...document.querySelectorAll('[data-samsung-story]')].map(mountScene);
    document.querySelectorAll('[data-samsung-workspace]').forEach(root => disposers.push(SamsungWorkspace.mount(root)));
    document.querySelectorAll('[data-samsung-governance]').forEach(root => disposers.push(SamsungGovernance.mount(root)));
  }
  window.SamsungStory = { render, renderWorkspace, mount, cleanup };
})();
