// Original procedural models. Three.js is served locally; no account or model service.
const view = document.getElementById('model-view');
const status = document.getElementById('model-status');
const rotationButtons = ['rotate-left','rotate-right','reset-view'].map(id=>document.getElementById(id));
function fallback() {
  view.dataset.rendering='fallback';
  view.innerHTML='<div class="model-fallback"><span aria-hidden="true">↗</span><strong>Start with your curiosity.</strong><p>3D preview isn’t available in this browser.<br>Choose any field to explore its challenge.</p></div>';
  status.textContent='3D preview unavailable. All fields and challenges are still ready.';
  rotationButtons.forEach(button=>button.disabled=true);
}
try {
  const T = await import('./vendor/three.module.js');
  const renderer = new T.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  view.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(34,1,.1,50);
  camera.position.set(4.8,3.05,6.4);camera.lookAt(0,1.05,0);
  scene.add(new T.HemisphereLight(0xffffff,0xb4acbf,3));
  const sun=new T.DirectionalLight(0xffffff,4.5);sun.position.set(-3,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.03;scene.add(sun);
  const fill=new T.DirectionalLight(0xc1c5ff,2);fill.position.set(4,3,-4);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.17}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.02;scene.add(ground);
  const material=(color,metalness=.2,roughness=.35)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const purple=material(0x7761b6,.3),silver=material(0xd9dce5,.65),black=material(0x25252a,0,.8),white=material(0xf7f7fa,.15),dark=material(0x37343d,.4);
  function part(group,geometry,mat,position) {const mesh=new T.Mesh(geometry,mat);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  function box(g,size,pos,mat){return part(g,new T.BoxGeometry(...size),mat,pos);}
  function rod(g,a,b,r,mat){const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const mesh=part(g,new T.CylinderGeometry(r,r,delta.length(),20),mat,av.add(bv).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;}
  function scooter(){
    const g=new T.Group();
    for(const x of [-1.12,1.12]){
      part(g,new T.TorusGeometry(.29,.075,16,48),black,[x,.37,0]);
      const hub=part(g,new T.CylinderGeometry(.20,.20,.16,32),silver,[x,.37,0]);hub.rotation.x=Math.PI/2;
      part(g,new T.TorusGeometry(.14,.018,10,32),purple,[x,.37,.09]);
      const axle=part(g,new T.CylinderGeometry(.045,.045,.20,16),dark,[x,.37,0]);axle.rotation.x=Math.PI/2;
    }
    box(g,[1.8,.14,.4],[-.12,.45,0],silver);
    box(g,[1.6,.03,.36],[-.15,.537,0],purple);
    for(let i=0;i<10;i++)box(g,[.015,.005,.29],[-.81+i*.14,.556,0],dark);
    rod(g,[-1.12,.37,0],[-.85,.51,0],.045,silver);
    rod(g,[.7,.47,0],[1.12,.7,0],.065,silver);
    rod(g,[1.12,.37,0],[1.12,.75,0],.055,dark);
    rod(g,[1.12,.68,0],[.72,2.42,0],.067,silver);
    rod(g,[.83,1.94,0],[.72,2.42,0],.073,purple);
    rod(g,[.72,2.42,-.53],[.72,2.42,.53],.049,silver);
    rod(g,[.72,2.42,-.56],[.72,2.42,-.32],.068,black);
    rod(g,[.72,2.42,.32],[.72,2.42,.56],.068,black);
    const display=box(g,[.14,.03,.16],[.72,2.48,0],dark);display.rotation.z=-.15;
    box(g,[.07,.004,.08],[.72,2.50,0],purple);
    rod(g,[-.5,.43,.16],[-.63,.02,.36],.025,dark);
    const cable=new T.CatmullRomCurve3([new T.Vector3(.69,2.36,.13),new T.Vector3(.54,1.6,.16),new T.Vector3(.96,.66,.13)]);
    part(g,new T.TubeGeometry(cable,24,.013,6,false),dark,[0,0,0]);
    return g;
  }
  function bridge(){
    const g=new T.Group();
    box(g,[3.5,.15,1.04],[0,1,0],white);
    for(const x of [-1.5,1.5]){box(g,[.24,.95,.76],[x,.48,0],silver);box(g,[.48,.10,1],[x,.05,0],white);}
    for(const z of [-.53,.53]){
      rod(g,[-1.72,1.12,z],[1.72,1.12,z],.035,silver);
      for(let i=0;i<6;i++){
        const x=-1.65+i*.55, next=x+.55;
        rod(g,[x,1.12,z],[next,1.12,z],.026,purple);
        rod(g,[x,1.12,z],[x+.275,1.78,z],.036,purple);
        rod(g,[x+.275,1.78,z],[next,1.12,z],.036,purple);
        if(i<5)rod(g,[x+.275,1.78,z],[x+.825,1.78,z],.03,silver);
      }
    }
    for(let i=0;i<7;i++)box(g,[.18,.005,.04],[-1.4+i*.45,1.08,0],purple);
    return g;
  }
  function logic(){
    const g=new T.Group();
    box(g,[2.7,.15,1.9],[0,.56,0],purple);
    for(const x of [-1.16,1.16])for(const z of [-.74,.74])rod(g,[x,.03,z],[x,.49,z],.09,silver);
    box(g,[1.1,.18,1.1],[0,.72,0],dark);box(g,[.9,.025,.9],[0,.824,0],silver);
    for(let i=0;i<8;i++){
      const d=-.44+i*.125;
      for(const side of [-1,1]){box(g,[.22,.035,.045],[side*.62,.72,d],silver);box(g,[.045,.035,.22],[d,.72,side*.62],silver);}
    }
    for(let i=0;i<4;i++){box(g,[.18,.14,.24],[-1,.72,-.54+i*.35],white);box(g,[.16,.03,.05],[-.78,.65,-.54+i*.35],silver);}
    for(let i=0;i<3;i++)box(g,[.26,.15,.28],[1,.72,-.48+i*.48],dark);
    for(let i=0;i<3;i++){const block=box(g,[.23,.23,.23],[-.38+i*.38,1.25+i*.23,0],white);block.rotation.y=.3;}
    return g;
  }
  const models={mechanical:scooter(),civil:bridge(),software:logic()};
  Object.values(models).forEach(m=>{scene.add(m);m.visible=false;});
  let current,angle=0,drag=null;
  function render(){if(!document.getElementById('field-selection').hidden){const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(4.8,3.05,6.4).multiplyScalar(w/h<.85?1.02:.82);camera.lookAt(0,1.1,0);camera.updateProjectionMatrix();renderer.render(scene,camera);}}
  function turn(delta){angle+=delta;current.rotation.y=angle;render();}
  function select(field){Object.values(models).forEach(m=>m.visible=false);current=models[field]||models.mechanical;current.visible=true;angle=-.2;current.rotation.y=angle;view.dataset.model=field;view.setAttribute('aria-label',`Interactive 3D ${field==='mechanical'?'scooter':field==='civil'?'bridge':'logic board'}. Drag horizontally or use left and right arrow keys to rotate.`);render();}
  window.addEventListener('fieldchange',e=>select(e.detail));
  rotationButtons[0].addEventListener('click',()=>turn(-Math.PI/8));rotationButtons[1].addEventListener('click',()=>turn(Math.PI/8));rotationButtons[2].addEventListener('click',()=>{angle=-.2;current.rotation.y=angle;render();});
  view.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turn(e.key==='ArrowLeft'?-.18:.18);}});
  view.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX};view.setPointerCapture(e.pointerId);});
  view.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;turn((e.clientX-drag.x)*.012);drag.x=e.clientX;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(event,()=>{drag=null;});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback();});
  new ResizeObserver(render).observe(view);
  select(document.querySelector('[data-field][aria-pressed=true]').dataset.field);
  view.dataset.rendering='webgl';status.textContent='Drag to turn. Arrow keys work, too.';
} catch(error) {fallback();}
