/* Original frames: 615:12145 → 12328 → 12373; 12639 → 13388 → 13455.
   A single elapsed clock owns each demonstration, including pause and interruption. */
(() => {
  const asset = (file, size = 24, extra = '') => `<span class="mw-asset ${extra}" style="width:${size}px;height:${size}px;background-image:url('assets/meta/workflow/${file}')"></span>`;
  const part = name => `data-workflow-part="${name}"`;
  const nav = () => `<div class="mw-nav">${['dbce4.svg','944cf.svg','bfa46.svg','0ac98.svg','c55c5.svg'].map(f=>asset(f,22)).join('')}</div><div class="mw-system">${asset('c8f28.svg',24)}<i></i></div>`;
  const search = text => `<div class="mw-search"><span>⌕</span>${text}</div>`;
  const notes = '<ul><li>Long-term career goals 🚀</li><li>Expectation guidances</li></ul>';
  function home() {
    return `<div class="mw-home"><header>${asset('cc97b.png',36)}<b>Home</b>${asset('e2d8e.svg',38)}</header>${search('Search')}
      <div class="mw-contacts">${[['61c18.svg','Create<br>Room'],['58ef2.svg','Kay<br>Murphy'],['fb0c8.svg','Sabina<br>Kui'],['caba4.svg','Henry<br>Zhou'],['88cac.svg','Dina<br>Tolenti']].map(([a,n])=>`<div>${asset(a,56)}<small>${n}</small></div>`).join('')}</div>
      <div class="mw-upcoming"><div class="mw-highlight" ${part('highlight')}></div><h4>Upcoming</h4><div class="mw-meeting">${asset('ddece.svg',56)}<div><b>11:00 AM - 11:30 AM</b><small>Steve : MJ Check-In</small></div><span>•••</span></div><div class="mw-actions"><button data-demo-action="details">Details</button><button>Join Now</button></div></div>
      <div class="mw-events">${[['22e94.svg','1:00 PM - 1:30 PM','Emily and MJ weekly 1:1'],['24377.png','3:30 PM - 4:00 PM','Sync with MVP'],['7b010.png','5:30 PM - 6:00 PM','Team Happy Hour'],['c8a85.png','6:00 PM - 6:30 PM','Umbrella brainstorming session']].map(([a,t,n])=>`<div class="mw-meeting">${asset(a,56)}<div><b>${t}</b><small>${n}</small></div></div>`).join('')}</div>${nav()}</div>`;
  }
  function sheet() {
    return `<div class="mw-dim"></div><div class="mw-sheet" ${part('sheet')}><i class="mw-handle"></i><div class="mw-sheet-label">Event Details ${asset('0e472.svg',24)}</div><div class="mw-pair">${asset('67dfd.png',56)}${asset('dc8f1.png',56)}</div><h4>Steve : MJ Check-In</h4><p class="mw-date">Fri, Mar 19, 2021 11:00 AM - 11:30 AM</p><button class="mw-note" data-demo-action="edit">${notes}<div class="mw-written"><span ${part('typing')}></span><i class="mw-cursor" ${part('cursor')}></i></div><small>Saved 2 days ago by Steve</small></button><div class="mw-sheet-actions"><button>${asset('eb04f.svg',20)}Going</button><button class="mw-blue">Join Meeting</button></div><div class="mw-edit-actions"><span>◯ Preview</span><button>Cancel</button><button class="mw-blue">Save</button></div></div><div class="mw-keyboard" aria-hidden="true">${['qwertyuiop','asdfghjkl','⇧zxcvbnm⌫'].map(row=>`<div>${[...row].map(k=>`<span>${k}</span>`).join('')}</div>`).join('')}<div><span>?123</span><span>☻</span><span class="mw-space"></span><span>.</span><span>↵</span></div></div>`;
  }
  function discovery() {
    const cards = [['0d8a5.png','Steve Gervais','Director of Design',`${notes}<ul><li>Project Impact A to Z</li><li>Demonstrated solid leadership skills</li></ul>`,'Today at 2:00 PM'],['7389f.png','Kay Murphy','Product Designer','Mid-cycle review: ML ideas into opportunities for growth.','Tuesday at 2:00 PM'],['ff712.png','Jacob Jones','Software Engineer','Let’s discuss how might we session results🔥','No meeting within 2 weeks']];
    const rows = cards.concat(cards).map(([a,n,r,t,d])=>`<article>${asset(a,36)}<div><b>${n}</b><small>${r}</small><div class="mw-card-body">${t}</div><small>Next Meeting <em>• ${d}</em></small></div></article>`).join('');
    return `<div class="mw-discovery"><header><b>Your 1:1s</b><span class="mw-plus">+</span></header>${search('Name, Date, Type of 1:1')}<button class="mw-filter" data-demo-action="filter"><span ${part('filter-label')}>All 38</span>${asset('edb54.svg',12)}</button><div class="mw-notes-clip"><div class="mw-notes" ${part('notes')}>${rows}</div></div>${nav()}</div><div class="mw-dim"></div><div class="mw-categories" ${part('filter-menu')}><i class="mw-handle"></i><h4>Select 1:1 Type</h4>${[['#0a7cff','Regular Check-In','Discuss everyday work'],['#ff8049','Mid-Cycle Check-In','Make sure performance is on track'],['#a557f4','Performance Conversation','Discuss PSC results'],['#48c75c','Career Conversation','Discuss long-term growth and goals']].map(([color,n,d])=>`<button data-demo-action="category"><i style="background:${color}"></i><div><b>${n}</b><small>${d}</small></div>${asset('a4cdd.svg',24)}</button>`).join('')}<div class="mw-category-cancel">Cancel</div></div>`;
  }
  window.metaWorkflowHTML = (solution, index) => `<div class="solution-scene" data-scene="${index}" aria-label="${solution.title}"${index ? ' hidden' : ''}><div class="mw-phone" aria-label="Animated prototype: ${solution.title}"><div class="mw-screen">${index===3?discovery():home()}${index===1||index===2?sheet():''}<span class="mw-touch" aria-hidden="true"></span></div></div></div>`;
  window.bindMetaWorkflow = visual => {
    const scenes = [...visual.querySelectorAll('.solution-scene')], media = matchMedia('(prefers-reduced-motion: reduce)');
    let active = 0, elapsed = 0, last = 0, frame = 0, visible = false, disposed = false;
    const clamp = x => Math.max(0, Math.min(1, x));
    const phase = (t,start,duration) => clamp((t-start)/duration);
    const ease = p => 1-Math.pow(1-p,3);
    const find = selector => scenes[active].querySelector(selector);
    function touch(x,y,p) {
      const el=find('.mw-touch'); el.style.left=x+'px';el.style.top=y+'px';el.style.opacity=String(p>0&&p<1?.6*Math.sin(p*Math.PI):0);el.style.transform=`translate(-50%,-50%) scale(${.6+p*.6})`;
    }
    function draw(ms) {
      const t=ms%7000, reduced=media.matches;
      if(active===0){find('.mw-highlight').style.opacity=String(reduced?.65:.3+.5*(.5+.5*Math.sin(t/900)));touch(0,0,0);return;}
      if(active===1||active===2){
        const open=active===2?1:ease(phase(t,1000,200));
        const expand=active===2?ease(phase(t,1000,300)):0;
        const sheet=find('.mw-sheet');sheet.style.height=(431+287*expand)+'px';sheet.style.transform=`translateY(${(1-open)*500}px)`;sheet.style.opacity=String(open>0?1:0);
        find('.mw-dim').style.opacity=String(.35*open);
        find('.mw-note').style.height=(96+108*expand)+'px';
        find('.mw-sheet-actions').style.opacity=String(1-expand);
        find('.mw-edit-actions').style.opacity=String(expand);
        find('.mw-keyboard').style.transform=`translateY(${(1-expand)*280}px)`;
        const text='Project Impact A to Z\nDemonstrated solid leadership skills';
        find('[data-workflow-part="typing"]').textContent=active===2?text.slice(0,Math.floor(phase(t,1550,2400)*text.length)):'';
        find('.mw-cursor').style.opacity=String(expand*(reduced?1:(Math.floor(t/480)%2?0:1)));
        touch(active===1?96:170,active===1?418:555,phase(t,700,400));
      }else{
        const scroll=ease(phase(t,400,1400));find('.mw-notes').style.transform=`translateY(${-145*scroll}px)`;
        const open=ease(phase(t,2600,200))*(1-ease(phase(t,4300,200)));
        const menu=find('.mw-categories');menu.style.transform=`translateY(${(1-open)*500}px)`;menu.style.opacity=String(open>0?1:0);menu.style.visibility=open>0?'visible':'hidden';
        find('.mw-dim').style.opacity=String(.35*open);
        find('[data-workflow-part="filter-label"]').textContent=t>=4500?'Career Conversation':'All 38';
        find('.mw-categories button:last-of-type').classList.toggle('mw-chosen',t>=4000);
        touch(332,t<3000?173:610,phase(t,t<3000?2250:3950,400));
      }
    }
    function tick(now){frame=0;if(disposed||!visible||document.hidden||media.matches)return;elapsed+=last?Math.min(now-last,80):0;last=now;draw(elapsed);frame=requestAnimationFrame(tick);}
    function sync(){cancelAnimationFrame(frame);frame=0;last=0;if(media.matches){draw(5200);return;}if(visible&&!document.hidden&&!disposed)frame=requestAnimationFrame(tick);}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0});observer.observe(visual);
    const resize=new ResizeObserver(()=>{const r=visual.getBoundingClientRect();visual.style.setProperty('--mw-scale',Math.min((r.width-32)/360,r.height*.875/783));});resize.observe(visual);
    function activate(index){if(index!==active){active=index;elapsed=0;}draw(media.matches?5200:elapsed);sync();}
    function click(event){const action=event.target.closest('[data-demo-action]')?.dataset.demoAction;if(!action)return;if(action==='details'&&active===1)elapsed=1000;if(action==='edit'&&active===2)elapsed=1000;if(action==='filter'&&active===3)elapsed=2600;if(action==='category'&&active===3)elapsed=4300;draw(media.matches?5200:elapsed);}
    visual.addEventListener('click',click);document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);draw(0);
    return {activate,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();visual.removeEventListener('click',click);document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);}};
  };
})();
