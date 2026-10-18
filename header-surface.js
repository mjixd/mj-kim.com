/* Header contrast follows the surface beneath it; the page theme remains user-owned. */
(() => {
  const nav = document.getElementById('nav');
  if (!nav) return;
  let pending = 0;
  function backgroundAtHeader() {
    const y = Math.min(innerHeight - 1, nav.getBoundingClientRect().bottom - 1);
    const under = document.elementsFromPoint(innerWidth / 2, y).find(el => !nav.contains(el) && el !== nav);
    const layers = [];
    for (let el = under; el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (c && (c[3] ?? 1) > 0) layers.push(c);
    }
    let rgb = [255, 255, 255];
    for (const c of layers.reverse()) rgb = rgb.map((v, i) => v * (1 - (c[3] ?? 1)) + c[i] * (c[3] ?? 1));
    return rgb;
  }
  function update() {
    pending = 0;
    const rgb = backgroundAtHeader();
    const dark = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < 145;
    nav.style.setProperty('--nav-bg', `rgb(${rgb.map(Math.round).join(',')})`);
    nav.style.setProperty('--nav-text', dark ? '#f5f5f5' : '#171717');
    nav.style.setProperty('--nav-muted', dark ? '#d0d0d0' : '#555555');
  }
  function schedule() { if (!pending) pending = requestAnimationFrame(update); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', schedule);
  addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new MutationObserver(schedule).observe(document.querySelector('main'), { childList: true });
  schedule();
})();
