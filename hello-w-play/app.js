(() => {
  'use strict';
  const G = window.HelloWGame;
  const $ = id => document.getElementById(id);
  const arrows = {N:'↑',E:'→',S:'↓',W:'←',J:'⤴'};
  const directions = {N:'north',E:'east',S:'south',W:'west',J:'jump'};
  const fields = {
    mechanical: {name:'Mechanical engineering', level:0, object:'An everyday ride.', detail:'A closer look at how things move.', summary:'Start with movement. Find a path, one step at a time.', question:'What can a scooter teach me about motion, balance, and mechanical engineering?'},
    civil: {name:'Civil engineering', level:1, object:'A connection worth building.', detail:'Small pieces. Stronger together.', summary:'Start with a structure. Add the missing link to connect a path.', question:'How do civil engineers decide where a bridge needs support, and what could I build to learn about it?'},
    software: {name:'Software engineering', level:2, object:'Small instructions. Big possibilities.', detail:'See the logic behind everyday technology.', summary:'Start with a sequence. Give your idea a set of instructions.', question:'How do software engineers turn a sequence of instructions into something that works in the real world?'}
  };
  let selectedField = 'mechanical', exploring = false;
  let facing = 'N';
  const chapters = [
    {concept:'SPATIAL THINKING',title:'Every path starts <br>with one move.',description:'Move the purple ball along the white blocks. Find your way to the purple destination.',hint:'There’s no rush. Try a direction.',insight:'You broke a big journey into small steps. That’s the beginning of an algorithm.',question:'I found a path by trying one move at a time. How do software engineers break a bigger problem into small steps?'},
    {concept:'PROBLEM SOLVING',title:'A gap is an <br>invitation to build.',description:'Something is missing. Find the gap, add a block, and help your ball continue its journey.',hint:'A missing piece doesn’t have to be the end.',insight:'You changed the path instead of giving up on it. Sometimes the solution is to change the conditions.',question:'I had to add a missing block to finish the path. How do you decide whether to work around a problem or change the system?'},
    {concept:'SEQUENCING',title:'Think ahead. <br>Then try it out.',description:'This time, plan your moves first. Add directions to your sequence, then run it and see what happens.',hint:'A sequence is a plan your ball can follow.',insight:'Your sequence is a small program. Notice the repeating pair of moves. Could a loop make it shorter?',question:'My sequence repeated the same pair of moves. How could I turn that pattern into a loop in a real program?'}
  ];
  let state = G.createState(0), queue = [], running = false, timer = null, runVersion = 0, activeCommand = -1;
  const completed = new Set();
  let cameraVersion = 0, cameraWanted = false, cameraStream = null;
  const project = (x,y) => [400+(x-y)*62,205+(x+y)*31-(x-y+4)*12];
  const diamond = (x,y) => `${x},${y-31} ${x+62},${y} ${x},${y+31} ${x-62},${y}`;

  function tile(x,y,goal,gap) {
    const [px,py] = project(x,y);
    if (gap) return `<g class="bridge-target" data-gap="true" role="button" tabindex="0" aria-label="Add missing bridge block"><polygon points="${diamond(px,py)}" fill="#ded5ee" fill-opacity=".6" stroke="#907ab6" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${px}" y="${py+5}" text-anchor="middle" fill="#8972b0" font-size="23">+</text></g>`;
    return `<g><polygon points="${px-62},${py} ${px},${py+31} ${px},${py+55} ${px-62},${py+24}" fill="${goal?'#60489f':'#e1dce9'}"/><polygon points="${px},${py+31} ${px+62},${py} ${px+62},${py+24} ${px},${py+55}" fill="${goal?'#49377f':'#cfc7dd'}"/><polygon class="tile-top" points="${diamond(px,py)}" fill="${goal?'#8a72c5':'#fff'}"/>${goal?`<ellipse class="goal-ring" cx="${px}" cy="${py}" rx="17" ry="8"/>`:''}</g>`;
  }
  function drawBoard() {
    const previous = $('ball')?.dataset.position.split(',').map(Number);
    const level = G.LEVELS[state.level];
    const tiles = [...level.tiles];
    if (level.gap) tiles.push(level.gap);
    tiles.sort((a,b) => a[0]+a[1]-b[0]-b[1]);
    let floor = '';
    for (let x=0;x<5;x++) for (let y=0;y<5;y++) {
      const px=400+(x-y)*62, py=276+(x+y)*31;
      floor += `<circle cx="${px}" cy="${py}" r="1.4" fill="#c9bfd8" opacity=".6"/>`;
    }
    const [bx,by] = project(...state.position);
    $('board').innerHTML = `<defs><radialGradient id="ball-shade" cx="32%" cy="23%" r="80%"><stop stop-color="#a48bdd"/><stop offset=".6" stop-color="#7355b4"/><stop offset="1" stop-color="#51368c"/></radialGradient><filter id="floor-shadow" x="-30%" width="160%" y="-70%" height="240%"><feGaussianBlur stdDeviation="16"/></filter></defs><ellipse cx="400" cy="421" rx="221" ry="34" fill="#9883b8" opacity=".12" filter="url(#floor-shadow)"/>${floor}${tiles.map(([x,y])=>tile(x,y,x===level.goal[0]&&y===level.goal[1],Boolean(level.gap&&x===level.gap[0]&&y===level.gap[1]&&!state.bridge))).join('')}<g id="ball" transform="translate(${bx} ${by})" data-position="${state.position.join(',')}"><ellipse cy="1" rx="19" ry="8" fill="#564077" opacity=".19"/><circle cy="-20" r="21" fill="url(#ball-shade)"/></g>`;
    if(previous && previous.join(',')!==state.position.join(',') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const [px,py]=project(...previous);
      $('ball').animate([{transform:'translate('+px+'px,'+py+'px)'},{transform:'translate('+bx+'px,'+by+'px)'}],{duration:220,easing:'ease-out'});
    }
    $('board').setAttribute('aria-label',`Challenge ${state.level+1}. Ball at column ${state.position[0]+1}, row ${state.position[1]+1}. ${state.steps} moves.${state.won?' Destination reached.':''}`);
    $('board').dataset.position=state.position.join(',');
    $('board').dataset.steps=state.steps;
    $('board').dataset.won=state.won;
    $('position').textContent=state.won?`Destination reached · ${state.steps} moves`:`${state.steps===0?'Start':'On your way'} · ${state.steps} moves`;
  }
  function render(motion='none') {
    drawBoard();
    window.dispatchEvent(new CustomEvent('gameviewchange',{detail:{state,motion}}));
    $('jump').disabled=running||state.won;
    $('jump').setAttribute('aria-label',state.level===2?'Queue jump':'Jump');
    document.querySelectorAll('[data-level]').forEach(button=>{
      const n=Number(button.dataset.level);
      button.setAttribute('aria-pressed',n===state.level?'true':'false');
      button.classList.toggle('completed',completed.has(n));
    });
    $('undo').disabled=running||!state.history.length;
    document.querySelectorAll('[data-direction]').forEach(button=>{
      button.disabled=running||state.won;
      button.setAttribute('aria-label',`${state.level===2?'Queue':'Move'} ${directions[button.dataset.direction]}`);
    });
    $('bridge-tools').hidden=state.level!==1;
    $('build-bridge').disabled=state.bridge||state.won;
    $('build-bridge').textContent=state.bridge?'✓ Block added':'＋ Add the missing block';
    $('program-tools').hidden=state.level!==2;
    $('queue').innerHTML=queue.map((d,i)=>`<li${i===activeCommand?' class="active"':''} aria-label="Step ${i+1}: ${directions[d]}">${arrows[d]}</li>`).join('');
    $('queue-count').textContent=`${queue.length} / 24`;
    $('run').textContent=running?'■ Stop':'▶ Run sequence';
    $('run').disabled=!running&&!queue.length;
    $('clear-queue').disabled=running||!queue.length;
    $('remove-command').disabled=running||!queue.length;
    $('success').hidden=!state.won;
    $('feedback').hidden=state.won;
    $('insight').textContent=chapters[state.level].insight;
    $('next').innerHTML=state.level===2?'Turn this into a question <span aria-hidden="true">↗</span>':'Try the next idea <span aria-hidden="true">→</span>';
  }
  function say(text) { $('feedback').textContent=text; }
  function stopRun() {
    runVersion++; clearTimeout(timer); timer=null; running=false; activeCommand=-1;
  }
  function selectLevel(level) {
    stopRun(); state=G.createState(level);queue=[];facing='N';
    const c=chapters[level];
    $('concept').textContent=c.concept;
    $('challenge-title').innerHTML=c.title;
    $('challenge-description').textContent=c.description;
    say(c.hint);render();
  }
  function attempt(direction) {
    if(direction!=='J')facing=direction;
    const next=direction==='J'?G.jump(state,facing):G.move(state,direction), moved=next!==state;
    state=next;
    if(state.won) completed.add(state.level);
    else say(moved?'One small step. What comes next?':direction==='J'?'No landing block two spaces ahead. Try another direction.':state.level===1&&!state.bridge?'There’s no block there yet. Add the bridge, or jump across.':'There’s no block in that direction. Try another way.');
    return moved;
  }
  function input(direction) {
    if(!exploring||running||state.won)return;
    if(state.level===2) {
      if(queue.length>=24){say('Your sequence has 24 moves. Remove a step or run it.');return;}
      queue.push(direction);say('Plan ready? Run your sequence to try it.');
    } else attempt(direction);
    render(state.level===2?'none':direction==='J'?'jump':'move');
  }
  function runQueue() {
    if(running){stopRun();say('Stopped here. Run again to try your sequence from the start.');render();return;}
    if(!queue.length)return;
    stopRun();state=G.createState(2);facing='N';running=true;
    const version=runVersion;let cursor=0;
    const step=()=>{
      if(version!==runVersion||!running)return;
      activeCommand=cursor;
      const command=queue[cursor], moved=attempt(command);cursor++;
      if(!moved||state.won||cursor===queue.length){
        running=false;timer=null;
        if(!state.won)say(!moved?`Step ${cursor} meets a gap. Edit your sequence and try again.`:'Your sequence ended before the destination. Add more steps and try again.');
        render(command==='J'?'jump':'move');return;
      }
      say(`Running step ${cursor} of ${queue.length}…`);render(command==='J'?'jump':'move');timer=setTimeout(step,550);
    };
    render();timer=setTimeout(step,250);
  }
  function addBridge() {
    if(state.level!==1||state.bridge||state.won)return;
    state=G.buildBridge(state);say('A new possibility. Your path is connected now.');render();
  }
  document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>selectLevel(Number(b.dataset.level))));
  document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>input(b.dataset.direction)));
  $('jump').addEventListener('click',()=>input('J'));
  $('reset').addEventListener('click',()=>selectLevel(state.level));
  $('undo').addEventListener('click',()=>{if(running)return;state=G.undo(state);say('One step back. Try another direction.');render();});
  $('build-bridge').addEventListener('click',addBridge);
  $('board').addEventListener('click',e=>{if(e.target.closest('[data-gap]'))addBridge();});
  $('board').addEventListener('keydown',e=>{if(e.target.closest('[data-gap]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();addBridge();}});
  $('run').addEventListener('click',runQueue);
  $('clear-queue').addEventListener('click',()=>{if(!running){queue=[];activeCommand=-1;render();}});
  $('remove-command').addEventListener('click',()=>{if(!running){queue.pop();activeCommand=-1;render();}});
  $('next').addEventListener('click',()=>state.level===2?openMentor():selectLevel(state.level+1));
  window.addEventListener('keydown',e=>{
    if(!exploring||$('mentor-dialog').open||e.target.matches('input,textarea,select,[contenteditable=true]')||e.ctrlKey||e.metaKey||e.altKey)return;
    const direction={ArrowUp:'N',ArrowRight:'E',ArrowDown:'S',ArrowLeft:'W',w:'N',d:'E',s:'S',a:'W'}[e.key];
    if(direction){e.preventDefault();input(direction);}
    if(e.code==='Space'&&!e.target.closest('button,a')){e.preventDefault();if(!e.repeat)input('J');}
  });

  function closeCamera(message='Camera off. You’re back in the virtual space.') {
    cameraWanted=false;cameraVersion++;
    if(cameraStream)cameraStream.getTracks().forEach(track=>track.stop());
    cameraStream=null;$('camera').srcObject=null;
    $('stage').classList.remove('camera-active');$('stage-label').textContent='YOUR EXPLORATION';
    $('camera-toggle').setAttribute('aria-pressed','false');$('camera-toggle').querySelector('span').textContent='Camera overlay';
    $('camera-status').hidden=false;$('camera-status').textContent=message;
  }
  async function startCamera() {
    if(cameraWanted){closeCamera();return;}
    if(!navigator.mediaDevices?.getUserMedia){closeCamera('Camera isn’t available here. You can play every challenge in the virtual space.');return;}
    cameraWanted=true;const version=++cameraVersion;
    $('camera-toggle').setAttribute('aria-pressed','true');$('camera-toggle').querySelector('span').textContent='Cancel camera';
    $('camera-status').hidden=false;$('camera-status').textContent='Allow camera access to use your surroundings as a backdrop. No recording or spatial tracking.';
    let stream;
    try {
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(!cameraWanted||version!==cameraVersion){stream.getTracks().forEach(t=>t.stop());return;}
      cameraStream=stream;$('camera').srcObject=stream;
      await $('camera').play();
      if(!cameraWanted||version!==cameraVersion)return;
      $('stage').classList.add('camera-active');$('stage-label').textContent='CAMERA OVERLAY';
      $('camera-toggle').querySelector('span').textContent='Camera off';
      $('camera-status').textContent='Camera backdrop is on. The puzzle stays on screen; it does not track surfaces. Nothing is recorded or uploaded.';
    } catch(error) {
      if(stream)stream.getTracks().forEach(t=>t.stop());
      if(version===cameraVersion)closeCamera('Camera couldn’t start. Your virtual game is ready to play.');
    }
  }
  $('camera-toggle').addEventListener('click',startCamera);
  window.addEventListener('pagehide',()=>{stopRun();render();closeCamera();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(running){stopRun();say('Paused while you were away. Run starts your sequence again.');render();}if(cameraWanted)closeCamera('Camera stopped while this page was in the background.');}});

  function openMentor() {
    if(running){stopRun();say('Stopped for a moment of reflection.');render();}
    $('question').value=fields[selectedField].question;$('question-preview').hidden=true;
    document.querySelector('.dialog-intro').textContent=`What would you ask someone working in ${fields[selectedField].name.toLowerCase()}?`;
    $('mentor-dialog').showModal();
  }
  $('open-mentor').addEventListener('click',openMentor);$('ask-mentor').addEventListener('click',openMentor);
  $('close-mentor').addEventListener('click',()=>$('mentor-dialog').close());
  document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{
    $('question').value=b.dataset.prompt==='work'?fields[selectedField].question:'I enjoyed this small engineering challenge. What would be a good first project to try next, and what helped you get started?';
    $('question-preview').hidden=true;$('question').focus();
  }));
  $('question').addEventListener('input',()=>{$('question-preview').hidden=true;});
  $('preview-question').addEventListener('click',()=>{
    const question=$('question').value.trim();
    if(!question){$('question').focus();$('question').setCustomValidity('Add a question to preview.');$('question').reportValidity();$('question').setCustomValidity('');return;}
    $('preview-text').textContent=question;$('question-preview').hidden=false;
  });
  document.querySelectorAll('[data-field]').forEach(button=>button.addEventListener('click',()=>{
    selectedField=button.dataset.field;
    const field=fields[selectedField];
    document.querySelectorAll('[data-field]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    $('field-summary').textContent=field.summary;
    $('object-name').textContent=field.object;
    $('object-detail').textContent=field.detail;
    window.dispatchEvent(new CustomEvent('fieldchange',{detail:selectedField}));
  }));
  function startExploring(focus=true){
    exploring=true;
    $('field-selection').hidden=true;$('game-content').hidden=false;
    $('selected-field').textContent=fields[selectedField].name;
    $('game-eyebrow').textContent='A SMALL START IN '+fields[selectedField].name.toUpperCase();
    selectLevel(fields[selectedField].level);
    if(focus){$('game-title').focus();window.scrollTo(0,0);}
  }
  $('start-exploring').addEventListener('click',()=>startExploring());
  $('change-field').addEventListener('click',()=>{
    stopRun();closeCamera();exploring=false;
    $('game-content').hidden=true;$('field-selection').hidden=false;
    document.querySelector(`[data-field="${selectedField}"]`).focus();
    window.scrollTo(0,0);
  });
  window.helloWGameSnapshot=()=>state;
  selectLevel(0);
  if(document.documentElement.classList.contains('embedded-game')){
    startExploring(false);
    if(window.parent!==window)new ResizeObserver(()=>{
      window.parent.postMessage({type:'hello-w-resize',height:Math.ceil(document.body.getBoundingClientRect().height)+8},location.origin);
    }).observe(document.body);
  }
})();
