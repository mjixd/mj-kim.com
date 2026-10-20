/* One live prototype retains its state while readers explore the explanations. */
(() => {
  function render() {
    return `<section class="samsung-governance" data-samsung-governance aria-labelledby="governance-title">
      <div class="samsung-governance__stage">
        <header class="samsung-governance__heading"><h2 id="governance-title">AI-readable system</h2><p>Defining the automation boundary.<br>Change a token. Inspect the result. Restore the baseline.</p></header>
        <div class="samsung-governance__prototype"><iframe src="tokenproof/" title="Tokenproof interactive validation prototype" loading="lazy"></iframe></div>
        <div class="samsung-governance__demo-note"><span>Interactive public prototype · REVIEW items require human assessment.</span><a href="tokenproof/" target="_blank" rel="noopener noreferrer">Open prototype in a full window</a></div>
        <div class="samsung-governance__panels">
          <article class="samsung-governance__copy"><h3>Shared tokens. Verified in the UI.</h3><p>Shared tokens and DESIGN.md turn design standards into checks against generated HTML/CSS and the rendered interface. Deterministic checks produce a conformance score; decisions that require judgment remain open for human review.</p></article>
          <article class="samsung-governance__copy"><h3>Expose errors. Verify the fix.</h3><p>Change a token to see its effect on the preview, source, and conformance score. Restore the baseline and run QA again to verify the correction. REVIEW items remain subject to human assessment.</p></article>
        </div>
      </div>
    </section>`;
  }
  function mount(root) {
    const frame=root.querySelector('iframe');
    let observer;
    function resize(){if(frame.contentDocument?.body)frame.style.height=frame.contentDocument.body.scrollHeight+'px';}
    function loaded(){observer?.disconnect();resize();observer=new ResizeObserver(resize);observer.observe(frame.contentDocument.body);}
    frame.addEventListener('load',loaded);
    if(frame.contentDocument?.readyState==='complete'&&frame.contentDocument.body?.children.length)loaded();
    return()=>{frame.removeEventListener('load',loaded);observer?.disconnect();};
  }
  window.SamsungGovernance={render,mount};
})();
