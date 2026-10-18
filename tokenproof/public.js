/* Keep public entry points on the browser-only validation workflow. */
(() => {
  const labels={dashboardLoad:'Reset building demo',backgroundOpen:'Background',backgroundUpload:'Upload image',backgroundRemove:'Remove image',analyze:'Run QA',restore:'Restore baseline',download:'QA report',reset:'Load error sample'};
  for(const [id,label] of Object.entries(labels)){const button=document.getElementById(id);if(button)button.textContent=label;}
})();
