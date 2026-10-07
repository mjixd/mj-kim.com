// Real-time block rendering; game.js remains the authority for movement and winning.
const host=document.getElementById('block-scene'), stage=document.getElementById('stage');
try {
  const T=await import('./vendor/three.module.js');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  host.removeAttribute('aria-hidden');renderer.domElement.setAttribute('aria-hidden','true');
  host.appendChild(renderer.domElement);
  const gapButton=document.createElement('button');gapButton.className='scene-gap';gapButton.type='button';gapButton.textContent='+';gapButton.setAttribute('aria-label','Add missing bridge block');gapButton.hidden=true;host.appendChild(gapButton);
  gapButton.addEventListener('click',()=>document.getElementById('build-bridge').click());
  let gapPosition=null;
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-5,5,4,-4,.1,60);
  camera.position.set(7,6.5,9);camera.lookAt(0,1,0);
  scene.add(new T.HemisphereLight(0xffffff,0x777984,2.5));
  const key=new T.DirectionalLight(0xffffff,4);key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-5});key.shadow.normalBias=.018;scene.add(key);
  const rim=new T.DirectionalLight(0xa698ff,1.4);rim.position.set(5,4,-5);scene.add(rim);
  const white=new T.MeshStandardMaterial({color:0xffffff,roughness:.38});
  const purple=new T.MeshStandardMaterial({color:0x6040ba,roughness:.3});
  const ballMaterial=new T.MeshPhysicalMaterial({color:0x6330c1,roughness:.17,metalness:.16,clearcoat:1,clearcoatRoughness:.12});
  const cube=new T.BoxGeometry(.985,.275,.985),tiles=new T.Group();scene.add(tiles);
  const ball=new T.Mesh(new T.SphereGeometry(.42,40,28),ballMaterial);ball.castShadow=true;scene.add(ball);
  const shadow=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({opacity:.32}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.285;shadow.receiveShadow=true;scene.add(shadow);
  const height=(x,y)=>(x-y+4)*.28;
  const point=([x,y])=>new T.Vector3(x-2,height(x,y)+.42,y-2);
  let signature='', frame=0, version=0, ready=false, failed=false;
  function draw(){if(failed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const half=aspect<1?4.9:3.7;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.render(scene,camera);
    if(gapPosition){const p=gapPosition.clone().project(camera);gapButton.style.left=((p.x+1)/2*w)+'px';gapButton.style.top=((-p.y+1)/2*h)+'px';}
  }
  function terrain(state){
    const next=state.level+':'+state.bridge;if(next===signature)return;signature=next;
    while(tiles.children.length){const old=tiles.children[0];tiles.remove(old);if(old.geometry!==cube){old.geometry.dispose();old.material.dispose();}}
    const level=window.HelloWGame.LEVELS[state.level];
    const path=[...level.tiles];if(state.bridge&&level.gap)path.push(level.gap);
    for(const [x,y] of path){
      const count=x-y+5;
      for(let n=0;n<count;n++){
        const isGoal=x===level.goal[0]&&y===level.goal[1]&&n===count-1;
        const mesh=new T.Mesh(cube,isGoal?purple:white);mesh.position.set(x-2,n*.28-.14,y-2);mesh.castShadow=true;mesh.receiveShadow=true;tiles.add(mesh);
      }
    }
    if(level.gap&&!state.bridge){
      const outline=new T.LineSegments(new T.EdgesGeometry(cube),new T.LineBasicMaterial({color:0xa58cdb}));
      outline.position.set(level.gap[0]-2,height(...level.gap)-.14,level.gap[1]-2);tiles.add(outline);
    }
  }
  function update({state,motion='none'}){
    if(failed)return;
    version++;cancelAnimationFrame(frame);terrain(state);
    const fallbackGap=document.querySelector('#board [data-gap]');
    if(fallbackGap){fallbackGap.removeAttribute('data-gap');fallbackGap.setAttribute('data-gap-fallback','true');fallbackGap.setAttribute('tabindex','-1');fallbackGap.setAttribute('aria-hidden','true');}
    const level=window.HelloWGame.LEVELS[state.level];
    gapPosition=level.gap&&!state.bridge?point(level.gap).add(new T.Vector3(0,-.42,0)):null;
    gapButton.hidden=!gapPosition;
    if(gapPosition)gapButton.setAttribute('data-gap','true');else gapButton.removeAttribute('data-gap');
    const target=point(state.position), from=ball.position.clone(), currentVersion=version;
    const animate=ready&&(motion==='move'||motion==='jump')&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    ready=true;
    if(!animate){ball.position.copy(target);draw();return;}
    const start=performance.now(),duration=motion==='jump'?430:200;
    function tick(now){if(currentVersion!==version)return;const t=Math.min(1,(now-start)/duration),ease=t*t*(3-2*t);ball.position.lerpVectors(from,target,ease);if(motion==='jump')ball.position.y+=Math.sin(Math.PI*t)*1.05;ball.rotation.z-=.06;draw();if(t<1)frame=requestAnimationFrame(tick);}
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener('gameviewchange',e=>update(e.detail));
  new ResizeObserver(draw).observe(host);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;version++;cancelAnimationFrame(frame);stage.classList.remove('has-3d');host.hidden=true;
    gapButton.removeAttribute('data-gap');const gap=document.querySelector('#board [data-gap-fallback]');if(gap){gap.setAttribute('data-gap','true');gap.setAttribute('tabindex','0');gap.removeAttribute('aria-hidden');}
  });
  window.addEventListener('pagehide',()=>{version++;cancelAnimationFrame(frame);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){version++;cancelAnimationFrame(frame);}else if(window.helloWGameSnapshot)update({state:window.helloWGameSnapshot()});});
  stage.classList.add('has-3d');
  if(window.helloWGameSnapshot)update({state:window.helloWGameSnapshot()});
} catch(error){host.hidden=true;stage.classList.remove('has-3d');}
