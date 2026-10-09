import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'
import {
  HUB,UP,WIDTH,FLOOR,LOOPS,ZONES,COLORS,BRIDGE_STEPS,
  point,tangent,rightAt,framePoint,clamp,ease,easing,
  geometryDiagnostics
} from './loopGeometry.js'
import './v2.css'

// A single persistent 3D world: FIVE distinct closed spatial loops physically
// welded to ONE atrium. No route swaps, camera resets, CSS portals or fades.
const $=id=>document.getElementById(id)
const ui={
  canvas:$('scene'),choices:$('choices'),phase:$('phase'),
  status:$('status'),percent:$('percent'),bar:$('progress'),
  hint:$('hint'),loc:$('loc'),error:$('error')
}
const phases={
  idle:['01 / CHOISIS UN CHEMIN','CHOISIS UN PROJET','Chaque voie part du carrefour et revient par un passage distinct.','CARREFOUR — 5 DIRECTIONS'],
  build:['02 / PONT EN CONSTRUCTION','CONSTRUCTION DU PONT','Le passage apparaît section par section. La caméra ne bouge pas.','CONSTRUCTION VISIBLE'],
  approach:['03 / VERS LE CARREFOUR','VERS LE PASSAGE','Approche continue jusqu’au seuil du tunnel sélectionné.','ACCÈS AU CHEMIN'],
  loop:['04 / PARCOURS EN BOUCLE','BOUCLE EN COURS','Déplacement sur une seule courbe 3D : passage par le projet puis retour.','CHEMIN DU PROJET'],
  finish:['05 / RETOUR AU CARREFOUR','ARRIVÉE AU CARREFOUR','La caméra rejoint le point de vue initial sans coupure ni saut.','CARREFOUR RETROUVÉ']
}
const scene=new THREE.Scene()
scene.background=new THREE.Color(0x071019)
scene.fog=new THREE.FogExp2(0x071019,.012)
let renderer
try{
  renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.setSize(window.innerWidth,window.innerHeight,false)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure=1.6
}catch(error){
  ui.error.hidden=false
  throw error
}
const camera=new THREE.PerspectiveCamera(67,window.innerWidth/window.innerHeight,.15,250)
const OVERVIEW=new THREE.Vector3(0,11.5,25)
camera.position.copy(OVERVIEW)
camera.lookAt(HUB.clone().add(new THREE.Vector3(0,-.8,-14)))
const INITIAL_ROTATION=camera.quaternion.clone()
const quatTarget=new THREE.Quaternion(),lookMatrix=new THREE.Matrix4()
const targetLook=new THREE.Vector3()
const tmpPos=new THREE.Vector3(),prevPos=OVERVIEW.clone(),tmpDir=new THREE.Vector3()
const light=new THREE.HemisphereLight(0xd1e6f9,0x152232,2.8)
scene.add(light)
scene.add(new THREE.AmbientLight(0x8bafc4,.4))
const sun=new THREE.DirectionalLight(0xb5d9ea,2.6)
sun.position.set(-15,23,8);scene.add(sun)
const hubLamp=new THREE.PointLight(0x7eebe2,65,34,2)
hubLamp.position.copy(HUB).addScaledVector(UP,8);scene.add(hubLamp)

const deckMat=new THREE.MeshStandardMaterial({
  color:0x1b3249,metalness:.55,roughness:.5,side:THREE.DoubleSide
})
const bridgeMats=COLORS.map(hex=>new THREE.MeshStandardMaterial({
  color:new THREE.Color(hex).multiplyScalar(.49),metalness:.58,roughness:.37,
  emissive:new THREE.Color(hex).multiplyScalar(.09),side:THREE.DoubleSide
}))
const metalMat=new THREE.MeshStandardMaterial({color:0x819caf,metalness:.67,roughness:.32})
const archMats=COLORS.map(hex=>new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.75}))
const labelMats=COLORS.map(hex=>new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.9}))
const floorH=FLOOR,halfW=WIDTH/2
const builtRoutes=Array.from({length:5},()=>null)
const entryMeshes=Array.from({length:5},()=>[])
const collisionParts=Array.from({length:5},()=>[])
const projectMarkers=[]
const postGeometry=new THREE.CylinderGeometry(.036,.045,1,6)
const archGeometry=new THREE.TorusGeometry(WIDTH*.64,.032,6,44,Math.PI)
const markerGeometry=new THREE.TorusGeometry(2.8,.095,10,70)
const floorMat=new THREE.MeshStandardMaterial({color:0x20374c,metalness:.58,roughness:.42})
function beam(a,b,material,radius=.032){
  const vec=b.clone().sub(a),length=vec.length()
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,5),material)
  obj.position.copy(a).add(b).multiplyScalar(.5)
  obj.quaternion.setFromUnitVectors(UP,vec.normalize())
  return obj
}
function deck(a,b,m){
  const vertices=[
    framePoint(a.path,a.u,-halfW,floorH),
    framePoint(a.path,a.u,halfW,floorH),
    framePoint(b.path,b.u,-halfW,floorH),
    framePoint(b.path,b.u,halfW,floorH)
  ]
  const geom=new THREE.BufferGeometry()
  geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3))
  geom.setIndex([0,2,1,1,2,3])
  geom.computeVertexNormals()
  const obj=new THREE.Mesh(geom,m)
  return obj
}
function piece(index,u0,u1,{bridge=false,arch=false}={}){
  const p=LOOPS[index],g=new THREE.Group()
  const a={path:p,u:u0},b={path:p,u:u1}
  g.add(deck(a,b,bridge?bridgeMats[index]:deckMat))
  for(const sign of [-1,1]){
    g.add(beam(
      framePoint(p,u0,sign*halfW,floorH+.16),
      framePoint(p,u1,sign*halfW,floorH+.16),metalMat,.029
    ))
    g.add(beam(
      framePoint(p,u0,sign*halfW,floorH+1.10),
      framePoint(p,u1,sign*halfW,floorH+1.10),archMats[index],.023
    ))
    if(bridge){
      g.add(beam(framePoint(p,u0,sign*halfW,floorH+.16),
        framePoint(p,u0,sign*halfW,floorH+1.1),metalMat,.036))
    }
  }
  if(arch){
    // Open arch: no crossbeam or end cap ever blocks the camera centreline.
    const a=framePoint(p,u0,0,floorH+3)
    const arc=new THREE.Mesh(archGeometry,archMats[index])
    arc.position.copy(a)
    const forward=tangent(p,u0)
    const right=rightAt(p,u0)
    const basis=new THREE.Matrix4().makeBasis(right,UP,forward.clone().negate())
    arc.quaternion.setFromRotationMatrix(basis)
    g.add(arc)
  }
  collisionParts[index].push({u0,u1,objects:g.children.slice()})
  return g
}
function renderSpan(index,start,end,segments,{isBridge=false}={}){
  const group=new THREE.Group()
  for(let i=0;i<segments;i++){
    const u0=start+(end-start)*i/segments
    const u1=start+(end-start)*(i+1)/segments
    group.add(piece(index,u0,u1,{bridge:isBridge,arch:i%(isBridge?9:5)===0}))
  }
  scene.add(group)
  return group
}
const hubDisc=new THREE.Mesh(
  new THREE.CylinderGeometry(12.2,12.4,.43,80),
  new THREE.MeshStandardMaterial({color:0x1a3044,metalness:.65,roughness:.42}))
hubDisc.position.copy(HUB).addScaledVector(UP,floorH-.24)
scene.add(hubDisc)
const hubRim=new THREE.Mesh(new THREE.TorusGeometry(11.8,.08,7,100),
  new THREE.MeshBasicMaterial({color:0x8cdddc}))
hubRim.position.copy(HUB).addScaledVector(UP,floorH+.025)
hubRim.rotation.x=-Math.PI/2
scene.add(hubRim)
const hubSignal=new THREE.Mesh(new THREE.IcosahedronGeometry(.68,1),
  new THREE.MeshBasicMaterial({color:0xb9f3e4}))
hubSignal.position.copy(HUB).addScaledVector(UP,4)
scene.add(hubSignal)
function makeLabel(text,color){
  const canvas=document.createElement('canvas')
  canvas.width=512;canvas.height=128
  const ctx=canvas.getContext('2d')
  ctx.clearRect(0,0,512,128)
  ctx.fillStyle='rgba(8,19,31,.88)'
  ctx.fillRect(3,10,506,104)
  ctx.strokeStyle=color
  ctx.lineWidth=4;ctx.strokeRect(5,12,502,100)
  ctx.fillStyle='#eff8ff'
  ctx.font='700 38px Arial'
  ctx.textAlign='center';ctx.textBaseline='middle'
  const short=text.length>20?text.slice(0,19)+'…':text
  ctx.fillText(short,256,63)
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true}))
  sprite.scale.set(7.2,1.8,1)
  return sprite
}
for(let i=0;i<5;i++){
  const path=LOOPS[i],z=ZONES[i]
  // Two distinct stubs: one DEPARTURE and one RETURN, both open to the hub.
  // Their end caps do not exist; the 56-piece bridge fills the gap later.
  entryMeshes[i].push(renderSpan(i,z.entrance,z.bridgeStart,9))
  entryMeshes[i].push(renderSpan(i,z.bridgeEnd,z.exit,9))
  const gateU=(z.entrance+z.bridgeStart)/2
  const gate=new THREE.Mesh(markerGeometry,archMats[i])
  gate.position.copy(point(path,gateU)).addScaledVector(UP,.3)
  gate.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent(path,gateU))
  scene.add(gate)
  const title=makeLabel(PROJECTS[i].title,COLORS[i])
  title.position.copy(point(path,gateU)).addScaledVector(UP,6)
  scene.add(title)
  const far=point(path,.51)
  const sculpture=new THREE.Group()
  sculpture.position.copy(far).addScaledVector(UP,7.5)
  const gem=new THREE.Mesh(new THREE.IcosahedronGeometry(2.1,1),
    new THREE.MeshStandardMaterial({
      color:new THREE.Color(COLORS[i]),emissive:new THREE.Color(COLORS[i]),
      emissiveIntensity:.44,metalness:.39,roughness:.23,flatShading:true
    }))
  sculpture.add(gem)
  const halo=new THREE.Mesh(new THREE.TorusGeometry(3.3,.043,6,65),
    new THREE.MeshBasicMaterial({color:COLORS[i]}))
  sculpture.add(halo)
  scene.add(sculpture)
  projectMarkers.push(sculpture)
  const destinationLight=new THREE.PointLight(COLORS[i],48,22,2)
  destinationLight.position.copy(far).addScaledVector(UP,5)
  scene.add(destinationLight)
}
const starPos=new Float32Array(300*3)
for(let i=0;i<300;i++){
  const angle=i*2.399963
  const radius=20+(i*17%95)
  starPos[i*3]=Math.cos(angle)*radius
  starPos[i*3+1]=12+(i*11%35)
  starPos[i*3+2]=13+Math.sin(angle)*radius
}
const starGeo=new THREE.BufferGeometry()
starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3))
scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({
  size:.18,color:0xc5e8f7,opacity:.55,transparent:true,sizeAttenuation:true
})))

let stage='idle',stageTime=0,active=-1,progress=0,visibleCount=0
let loopU=0,maxStep=0,totalCollisions=0,tripCounter=0
let selectedSections=null
let lastPosition=camera.position.clone()
let pixelAnimations=0
const durations={build:3.6,approach:2.45,loop:13.0,finish:2.45}
function refreshUI(){
  const [step,status,hint,loc]=phases[stage]
  ui.phase.textContent=step
  ui.status.textContent=active>=0?PROJECTS[active].title.toUpperCase()+' · '+status:status
  ui.hint.textContent=hint
  ui.loc.textContent=loc
  const pct=Math.round(progress*100)
  ui.percent.textContent=pct+' %'
  ui.bar.style.width=pct+'%'
  const busy=stage!=='idle'
  for(const button of ui.choices.querySelectorAll('button')){
    button.disabled=busy
    button.classList.toggle('current',Number(button.dataset.path)===active)
  }
}
function enterStage(name){
  stage=name;stageTime=0;progress=0
  refreshUI()
}
function createBridge(index){
  if(builtRoutes[index])return builtRoutes[index]
  const z=ZONES[index]
  const group=renderSpan(index,z.bridgeStart,z.bridgeEnd,BRIDGE_STEPS,{isBridge:true})
  for(const item of group.children)item.visible=false
  builtRoutes[index]={group,sections:[...group.children],visible:0}
  return builtRoutes[index]
}
function selectPath(index){
  if(stage!=='idle'||index<0||index>=5)return false
  active=index
  tripCounter++
  selectedSections=createBridge(index)
  visibleCount=selectedSections.visible
  progress=0
  enterStage(visibleCount===BRIDGE_STEPS?'approach':'build')
  return true
}
const choices=PROJECTS.map((p,i)=>{
  const button=document.createElement('button')
  button.className='choice'
  button.style.setProperty('--accent',COLORS[i])
  button.dataset.path=String(i)
  button.type='button'
  button.innerHTML='<span class="number">0'+(i+1)+'</span><strong></strong><span class="arrow">↗</span>'
  button.querySelector('strong').textContent=p.title
  button.addEventListener('click',()=>selectPath(i))
  ui.choices.appendChild(button)
  return button
})
refreshUI()
function aimAt(tgt,dt){
  targetLook.copy(camera.position).add(tgt)
  lookMatrix.lookAt(camera.position,targetLook,UP)
  quatTarget.setFromRotationMatrix(lookMatrix)
  camera.quaternion.rotateTowards(quatTarget,Math.min(.16,dt*1.65))
}
function approachPoint(t){
  // Smooth spatial approach in the open hub; exactly same endpoint as u=0.
  // We NEVER change scene or snap at this stage boundary.
  const center=HUB
  const f=easing(t)
  return OVERVIEW.clone().lerp(center,f)
}
function sampleCamera(u,dt){
  loopU=clamp(u)
  camera.position.copy(point(LOOPS[active],loopU))
  const head=tangent(LOOPS[active],loopU)
  aimAt(head,dt)
}
function track(){
  const distance=camera.position.distanceTo(lastPosition)
  maxStep=Math.max(maxStep,distance)
  lastPosition.copy(camera.position)
  // The camera must never cross generated solid pieces. Explicit collider
  // checks run against *local sections* at a reduced frequency to keep
  // software WebGL responsive. No caps or opaque end walls exist.
  if(active>=0&&stage==='loop'&&pixelAnimations%9===0){
    const ray=new THREE.Raycaster()
    const aheadU=Math.min(1,loopU+.002)
    const a=point(LOOPS[active],loopU),b=point(LOOPS[active],aheadU)
    const vec=b.clone().sub(a)
    if(vec.lengthSq()>.0000001){
      ray.set(a,vec.normalize());ray.far=vec.length()
      const near=collisionParts[active]
        .filter(part=>part.u0<loopU+.023&&part.u1>loopU-.023)
        .flatMap(part=>part.objects)
      scene.updateMatrixWorld(true)
      if(ray.intersectObjects(near,false).length)totalCollisions++
    }
  }
}
function render(time){
  const dt=Math.min(.045,Math.max(0,(time-lastClock)/1000))
  lastClock=time;pixelAnimations++
  if(stage==='build'){
    stageTime+=dt
    progress=clamp(stageTime/durations.build)
    const n=Math.floor(BRIDGE_STEPS*easing(progress))
    for(let i=selectedSections.visible;i<n;i++)
      selectedSections.sections[i].visible=true
    selectedSections.visible=n;visibleCount=n
    if(progress>=1){
      selectedSections.sections.forEach(item=>item.visible=true)
      selectedSections.visible=BRIDGE_STEPS;visibleCount=BRIDGE_STEPS
      enterStage('approach')
    }
  }else if(stage==='approach'){
    stageTime+=dt
    progress=clamp(stageTime/durations.approach)
    camera.position.copy(approachPoint(progress))
    const head=tangent(LOOPS[active],0)
    aimAt(head,dt)
    if(progress>=1){
      // Exact same HUB coordinates; zero positional discontinuity.
      camera.position.copy(HUB)
      enterStage('loop')
    }
  }else if(stage==='loop'){
    stageTime+=dt
    progress=clamp(stageTime/durations.loop)
    sampleCamera(easing(progress),dt)
    if(progress>=1){
      camera.position.copy(HUB)
      loopU=1
      enterStage('finish')
    }
  }else if(stage==='finish'){
    stageTime+=dt
    progress=clamp(stageTime/durations.finish)
    camera.position.copy(approachPoint(1-progress))
    camera.quaternion.rotateTowards(INITIAL_ROTATION,Math.min(.15,dt*1.75))
    if(progress>=1){
      // The exact starting coordinates are already at the endpoint of
      // the continuous approach curve; no hidden transition exists.
      camera.position.copy(OVERVIEW)
      // Orientation converges while physically stationary if necessary.
      if(camera.quaternion.angleTo(INITIAL_ROTATION)<.035){
        enterStage('idle')
        active=-1
        refreshUI()
      }
    }
  }
  if(stage==='idle'){
    // Eye pose and camera position remain fixed, no animation loop reset.
    camera.quaternion.rotateTowards(INITIAL_ROTATION,Math.min(.04,dt*1.75))
    hubSignal.rotation.y+=dt*.35
  }
  for(let i=0;i<projectMarkers.length;i++){
    projectMarkers[i].rotation.y+=dt*(.1+.03*i)
  }
  track()
  if(pixelAnimations%7===0)refreshUI()
  renderer.render(scene,camera)
}
let lastClock=performance.now()
renderer.setAnimationLoop(render)
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth,window.innerHeight,false)
})
const pathErrors=geometryDiagnostics()
if(pathErrors.length)console.error('Five-loop geometries invalid:',pathErrors)
window.__v2Proof={
  get stage(){return stage},
  get selected(){return active},
  get camera(){return camera.position.toArray()},
  get quaternion(){return camera.quaternion.toArray()},
  get original(){return OVERVIEW.toArray()},
  get center(){return HUB.toArray()},
  get progress(){return progress},
  get loopU(){return loopU},
  get maxStep(){return maxStep},
  get collisions(){return totalCollisions},
  get pieces(){return visibleCount},
  get tripCount(){return tripCounter},
  get projects(){return PROJECTS.map(p=>p.title)},
  get diagnostics(){return pathErrors},
  get loops(){return LOOPS.map(p=>({start:point(p,0).toArray(),end:point(p,1).toArray(),length:p.getLength()}))},
  selectPath,
  speedUp(value=1){if(value>0&&value<=2.0)for(const k of ['build','approach','loop','finish'])durations[k]=({build:3.6,approach:2.45,loop:13,finish:2.45})[k]/value},
  version:'V2-5-physical-loops'
}
