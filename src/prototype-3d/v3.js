import * as THREE from 'three'
import {PROJECTS_WITH_SLUGS as PROJECTS} from '../data/projects.js'
import {
  HUB,UP,LOOPS,ZONES,GATES,COLORS,BRIDGE_STEPS,
  clamp,easing,point,tangent,rightAt,framePoint,geometryDiagnostics
} from './loopGeometry.js'
import './v3.css'

// V3: One persistent *enclosed* space. Camera starts at human eye height
// INSIDE the same atrium that the five enclosed loop-tunnels return to.
// The roof, floor and walls are solid, depth-writing, non-transparent meshes.
const $=id=>document.getElementById(id)
const ui={canvas:$('scene'),choices:$('choices'),stage:$('stage'),status:$('status'),
  percent:$('percent'),track:$('track'),hint:$('hint'),error:$('error')}
const scene=new THREE.Scene()
scene.background=new THREE.Color(0x0a111c)
scene.fog=new THREE.FogExp2(0x0a111c,.025)
let renderer
try{
  renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.setSize(window.innerWidth,window.innerHeight,false)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure=1.45
}catch(error){ui.error.hidden=false;throw error}
const camera=new THREE.PerspectiveCamera(78,window.innerWidth/window.innerHeight,.10,125)
const START=HUB.clone()
camera.position.copy(START)
camera.lookAt(START.clone().add(new THREE.Vector3(0,0,-15)))
const initialQuaternion=camera.quaternion.clone()
const aimQuat=new THREE.Quaternion(),aimMatrix=new THREE.Matrix4(),aimPoint=new THREE.Vector3()
const lookDir=new THREE.Vector3(),lastEye=camera.position.clone()
const maxSpeed=.40
let maxObservedStep=0,travelCount=0,active=-1,phase='idle',progress=0
let routeU=0,visibleCount=0,loopStartAt=0
let stageElapsed=0
let lastTime=performance.now()
let frameCounter=0
let geometryHitCount=0
const durations={build:3.1,loop:17.2}
const paths=Array.from({length:5},()=>({static:[],bridge:null,doors:[],all:[]}))
const materialWall=new THREE.MeshStandardMaterial({
  vertexColors:true,metalness:.46,roughness:.58,
  side:THREE.DoubleSide,depthWrite:true,transparent:false,opacity:1
})
const materialHub=new THREE.MeshStandardMaterial({
  color:0x293a4b,metalness:.45,roughness:.71,
  side:THREE.DoubleSide,transparent:false,depthWrite:true
})
const materialFloor=new THREE.MeshStandardMaterial({
  color:0x25374b,metalness:.44,roughness:.64,
  side:THREE.DoubleSide,transparent:false,depthWrite:true
})
const metal=new THREE.MeshStandardMaterial({color:0x60778b,metalness:.82,roughness:.28})
const frameMats=COLORS.map(c=>new THREE.MeshBasicMaterial({color:c,transparent:false,depthWrite:true}))
const tinyLights=COLORS.map(c=>new THREE.MeshBasicMaterial({color:c,transparent:false,depthWrite:true}))
scene.add(new THREE.HemisphereLight(0xc9e1ff,0x09111d,2.05))
scene.add(new THREE.AmbientLight(0xa3bcd8,.62))
const roomLight=new THREE.PointLight(0xc4eff4,80,32,2)
roomLight.position.copy(HUB).addScaledVector(UP,4.15);scene.add(roomLight)
const roomFill=new THREE.PointLight(0x7598cb,38,24,2)
roomFill.position.copy(HUB).add(new THREE.Vector3(0,1.2,5.2));scene.add(roomFill)
const chamberFloor=-1.9,chamberCeiling=5.0,chamberRadius=13.15
const fullFloor=new THREE.Mesh(
  new THREE.CylinderGeometry(13.9,13.9,.46,96),materialFloor)
fullFloor.position.copy(HUB).addScaledVector(UP,chamberFloor-.24)
scene.add(fullFloor)
const fullCeiling=new THREE.Mesh(
  new THREE.CylinderGeometry(13.95,13.95,.38,96),materialHub)
fullCeiling.position.copy(HUB).addScaledVector(UP,chamberCeiling+.17)
scene.add(fullCeiling)
const ceilingInset=new THREE.Mesh(
  new THREE.TorusGeometry(12.7,.065,7,104),
  new THREE.MeshBasicMaterial({color:0x537788}))
ceilingInset.position.copy(HUB).addScaledVector(UP,chamberCeiling-.04)
ceilingInset.rotation.x=Math.PI/2
scene.add(ceilingInset)
const hubFloorRing=new THREE.Mesh(
  new THREE.TorusGeometry(11.9,.075,6,110),
  new THREE.MeshBasicMaterial({color:0x5d989f}))
hubFloorRing.position.copy(HUB).addScaledVector(UP,chamberFloor+.07)
hubFloorRing.rotation.x=Math.PI/2
scene.add(hubFloorRing)

// The hub wall has precisely cut doorway sectors. Doors are openings in the
// geometry, not transparent holes in an otherwise invisible cylinder.
const wallPositions=[],wallIndices=[]
for(let i=0;i<180;i++){
  const angle=-Math.PI+Math.PI*2*(i+.5)/180
  const nearGate=GATES.some(g=>{
    const delta=Math.atan2(Math.sin(angle-g),Math.cos(angle-g))
    return Math.abs(delta)<.265
  })
  if(nearGate)continue
  const a=-Math.PI+Math.PI*2*i/180
  const b=-Math.PI+Math.PI*2*(i+1)/180
  const k=wallPositions.length/3
  for(const t of [a,b]){
    wallPositions.push(
      HUB.x+chamberRadius*Math.sin(t),HUB.y+chamberFloor,
      HUB.z-chamberRadius*Math.cos(t))
    wallPositions.push(
      HUB.x+chamberRadius*Math.sin(t),HUB.y+chamberCeiling,
      HUB.z-chamberRadius*Math.cos(t))
  }
  wallIndices.push(k,k+1,k+2,k+2,k+1,k+3)
}
const hubWallGeometry=new THREE.BufferGeometry()
hubWallGeometry.setAttribute('position',new THREE.Float32BufferAttribute(wallPositions,3))
hubWallGeometry.setIndex(wallIndices)
hubWallGeometry.computeVertexNormals()
const hubWall=new THREE.Mesh(hubWallGeometry,materialHub)
scene.add(hubWall)

// Roof section is a real closed horseshoe: walls + ceiling + an opaque floor.
// Inward-facing double-sided geometry guarantees correct visual occlusion.
const HALF_WIDTH=2.85
const PROFILE=[
  [-1,-1.88],[-1,1.55],[-.96,2.15],[-.83,2.78],
  [-.56,3.27],[0,3.53],[.56,3.27],[.83,2.78],
  [.96,2.15],[1,1.55],[1,-1.88]
]
const N=PROFILE.length
const palette=PROFILE.map((v,i)=>{
  if(i===0||i===N-1)return new THREE.Color(0x30465a)
  if(i===1||i===N-2)return new THREE.Color(0x344b61)
  if(i===2||i===N-3)return new THREE.Color(0x283c51)
  return new THREE.Color(0x40566a)
})
function tubeGeometry(path,u0,u1,steps=3){
  const coords=[],colors=[],indices=[]
  for(let step=0;step<=steps;step++){
    const u=u0+(u1-u0)*step/steps
    const center=point(path,u),right=rightAt(path,u)
    for(let k=0;k<N;k++){
      const [x,y]=PROFILE[k]
      const p=center.clone().addScaledVector(right,x*HALF_WIDTH).addScaledVector(UP,y)
      coords.push(p.x,p.y,p.z)
      const color=palette[k]
      colors.push(color.r,color.g,color.b)
    }
  }
  for(let j=0;j<steps;j++)for(let k=0;k<N;k++){
    const next=(k+1)%N
    const a=j*N+k,b=j*N+next,c=(j+1)*N+k,d=(j+1)*N+next
    indices.push(a,c,b,b,c,d)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3))
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
function archLine(i,u){
  const curvePts=PROFILE.slice(1,-1).map(([x,y])=>
    framePoint(LOOPS[i],u,x*HALF_WIDTH,y))
  const curve=new THREE.CatmullRomCurve3(curvePts,false,'centripetal')
  return new THREE.Mesh(new THREE.TubeGeometry(curve,28,.038,5,false),frameMats[i])
}
function rail(i,u0,u1,sign){
  const a=framePoint(LOOPS[i],u0,sign*HALF_WIDTH*.88,2.27)
  const b=framePoint(LOOPS[i],u1,sign*HALF_WIDTH*.88,2.27)
  const v=b.clone().sub(a),len=v.length()
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.028,.028,len,5),tinyLights[i])
  mesh.position.copy(a).add(b).multiplyScalar(.5)
  mesh.quaternion.setFromUnitVectors(UP,v.normalize())
  return mesh
}
function shellSection(i,u0,u1,{rib=false}={}){
  const g=new THREE.Group()
  const wall=new THREE.Mesh(tubeGeometry(LOOPS[i],u0,u1,3),materialWall)
  g.add(wall)
  g.add(rail(i,u0,u1,-1),rail(i,u0,u1,1))
  if(rib)g.add(archLine(i,u0))
  return g
}
function shellSpan(i,a,b,count,{build=false}={}){
  const group=new THREE.Group(),parts=[]
  for(let j=0;j<count;j++){
    const u0=a+(b-a)*j/count,u1=a+(b-a)*(j+1)/count
    const section=shellSection(i,u0,u1,{rib:j%7===0})
    if(build)section.visible=false
    group.add(section)
    parts.push(section)
  }
  scene.add(group)
  paths[i].all.push(group)
  return {group,parts}
}
function capDoor(i,u){
  const center=point(LOOPS[i],u).addScaledVector(UP,.85)
  const geometry=new THREE.PlaneGeometry(5.76,5.40)
  const panel=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    color:0x1d2939,metalness:.63,roughness:.43,side:THREE.DoubleSide,
    transparent:false,depthWrite:true}))
  panel.position.copy(center)
  panel.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent(LOOPS[i],u))
  const line=new THREE.Mesh(
    new THREE.BoxGeometry(4.55,.10,.06),frameMats[i])
  line.position.set(0,.0,.045)
  panel.add(line)
  scene.add(panel)
  paths[i].doors.push(panel)
  return panel
}
function billboard(text,color){
  const c=document.createElement('canvas');c.width=512;c.height=128
  const ctx=c.getContext('2d')
  ctx.fillStyle='#142233';ctx.fillRect(0,0,512,128)
  ctx.lineWidth=3;ctx.strokeStyle=color;ctx.strokeRect(3,3,506,122)
  ctx.fillStyle='#ecf8ff';ctx.font='700 33px Arial'
  ctx.textBaseline='middle';ctx.textAlign='center'
  const name=text.length>22?text.slice(0,21)+'…':text
  ctx.fillText(name,256,64)
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace
  const mat=new THREE.SpriteMaterial({map,transparent:true,depthTest:true})
  const sprite=new THREE.Sprite(mat);sprite.scale.set(5.8,1.45,1)
  return sprite
}
const destinationMarkers=[]
for(let i=0;i<5;i++){
  const p=LOOPS[i],z=ZONES[i]
  paths[i].static.push(shellSpan(i,z.entrance,z.bridgeStart,14))
  paths[i].static.push(shellSpan(i,z.bridgeEnd,z.exit,14))
  capDoor(i,z.bridgeStart)
  capDoor(i,z.bridgeEnd)
  const doorway=point(p,z.entrance)
  const frame=archLine(i,z.entrance)
  scene.add(frame)
  const projectLabel=billboard('0'+(i+1)+'  '+PROJECTS[i].title,COLORS[i])
  projectLabel.position.copy(doorway).addScaledVector(UP,4.24)
  scene.add(projectLabel)
  const entranceLight=new THREE.PointLight(COLORS[i],22,18,2)
  entranceLight.position.copy(doorway).addScaledVector(UP,2.5)
  scene.add(entranceLight)
  const destination=point(p,.52)
  const marker=archLine(i,.52)
  destinationMarkers.push(marker);marker.visible=false
  scene.add(marker)
  const lamp=new THREE.PointLight(COLORS[i],22,17,2)
  lamp.position.copy(destination).addScaledVector(UP,2.4)
  scene.add(lamp)
}
function makeBridge(i){
  if(paths[i].bridge)return paths[i].bridge
  paths[i].bridge=shellSpan(i,ZONES[i].bridgeStart,ZONES[i].bridgeEnd,
    BRIDGE_STEPS,{build:true})
  return paths[i].bridge
}
const stages={
  idle:['VOUS ÊTES DANS LE CARREFOUR','CHOISISSEZ UN TUNNEL',
    'Cinq passages réels et fermés. Sélectionnez un chemin pour construire son prolongement.'],
  building:['CONSTRUCTION DU PASSAGE','LE TUNNEL SE CONSTRUIT',
    'La caméra reste immobile pendant la construction des murs, du plafond et du sol.'],
  turning:['ORIENTATION VERS LE TUNNEL','ENTRÉE EN PRÉPARATION',
    'La caméra pivote naturellement depuis le carrefour, sans translation artificielle.'],
  travelling:['À L’INTÉRIEUR DU TUNNEL','PARCOURS EN COURS',
    'Les murs opaques masquent les autres chemins et la suite du trajet.'],
  returning:['RETOUR AU CARREFOUR','BOUCLE TERMINÉE',
    'La caméra retrouve sa direction initiale au même emplacement physique.']
}
function refresh(){
  const [stage,status,hint]=stages[phase]
  ui.stage.textContent=stage
  ui.status.textContent=active<0?status:PROJECTS[active].title+' · '+status
  ui.hint.textContent=hint
  ui.percent.textContent=Math.floor(progress*100)+' %'
  ui.track.style.width=(progress*100)+'%'
  for(const button of ui.choices.querySelectorAll('button')){
    button.disabled=phase!=='idle'
    button.classList.toggle('current',active===Number(button.dataset.path))
  }
}
function stage(name){
  phase=name;progress=0;stageElapsed=0;refresh()
}
function selectPath(i){
  if(phase!=='idle'||!Number.isInteger(i)||i<0||i>=5)return false
  active=i;travelCount++
  makeBridge(i)
  const built=paths[i].bridge.parts.every(g=>g.visible)
  stage(built?'turning':'building')
  return true
}
for(let i=0;i<5;i++){
  const b=document.createElement('button')
  b.className='choice';b.type='button';b.dataset.path=String(i)
  b.style.setProperty('--accent',COLORS[i])
  b.innerHTML='<span class="number">0'+(i+1)+'</span><strong></strong><span class="arrow">→</span>'
  b.querySelector('strong').textContent=PROJECTS[i].title
  b.addEventListener('click',()=>selectPath(i))
  ui.choices.appendChild(b)
}
function facing(dir,dt,speed=1.6){
  aimPoint.copy(camera.position).add(dir)
  aimMatrix.lookAt(camera.position,aimPoint,UP)
  aimQuat.setFromRotationMatrix(aimMatrix)
  camera.quaternion.rotateTowards(aimQuat,Math.min(.10,dt*speed))
  return camera.quaternion.angleTo(aimQuat)
}
function safeAdvance(dt,duration,fn){
  const candidate=clamp(progress+dt/duration)
  if(fn(candidate).distanceTo(camera.position)<=maxSpeed)return candidate
  let lo=progress,hi=candidate
  for(let iter=0;iter<13;iter++){
    const mid=(lo+hi)/2
    if(fn(mid).distanceTo(camera.position)<=maxSpeed)lo=mid
    else hi=mid
  }
  return lo
}
function wallRayProbe(i,u){
  if(!paths[i].bridge||paths[i].bridge.parts.some(x=>!x.visible))
    return {left:false,right:false,roof:false,floor:false}
  const origin=point(LOOPS[i],u)
  const sideways=rightAt(LOOPS[i],u)
  const directions={
    left:sideways.clone().negate(),right:sideways,roof:UP.clone(),floor:UP.clone().negate()
  }
  scene.updateMatrixWorld(true)
  const colliders=paths[i].all.flatMap(g=>g.children)
  const ray=new THREE.Raycaster()
  const output={}
  for(const [name,d] of Object.entries(directions)){
    ray.set(origin,d);ray.near=.015;ray.far=name==='roof'?5.5:4
    const hit=ray.intersectObjects(colliders,true).filter(p=>p.object.material===materialWall)[0]
    output[name]=Boolean(hit&&hit.distance<=(name==='roof'?5.2:3.8))
  }
  return output
}
function frame(time){
  const dt=Math.min(.045,Math.max(0,(time-lastTime)/1000))
  lastTime=time;frameCounter++
  if(phase==='building'){
    stageElapsed+=dt
    progress=clamp(stageElapsed/durations.build)
    const sections=paths[active].bridge.parts
    const count=Math.floor(BRIDGE_STEPS*easing(progress))
    for(let j=0;j<count;j++)sections[j].visible=true
    visibleCount=count
    if(progress>=1){
      sections.forEach(x=>x.visible=true);visibleCount=BRIDGE_STEPS
      paths[active].doors.forEach(door=>{door.visible=false})
      stage('turning')
    }
  }else if(phase==='turning'){
    stageElapsed+=dt
    const error=facing(tangent(LOOPS[active],0),dt,1.28)
    progress=1-Math.min(1,error/2)
    if(error<.015&&stageElapsed>.35)stage('travelling')
  }else if(phase==='travelling'){
    progress=safeAdvance(dt,durations.loop,
      fraction=>point(LOOPS[active],easing(fraction)))
    routeU=easing(progress)
    camera.position.copy(point(LOOPS[active],routeU))
    facing(tangent(LOOPS[active],routeU),dt,1.7)
    if(progress>=1){
      // The spline closes at exactly HUB; there is no camera move here.
      stage('returning')
    }
  }else if(phase==='returning'){
    stageElapsed+=dt
    camera.quaternion.rotateTowards(initialQuaternion,Math.min(.095,dt*1.4))
    const error=camera.quaternion.angleTo(initialQuaternion)
    progress=1-Math.min(1,error/2)
    if(error<.015&&stageElapsed>.5){
      stage('idle')
      active=-1
      routeU=0
      refresh()
    }
  }
  const step=camera.position.distanceTo(lastEye)
  maxObservedStep=Math.max(maxObservedStep,step)
  lastEye.copy(camera.position)
  if(frameCounter%12===0)refresh()
  renderer.render(scene,camera)
}
renderer.setAnimationLoop(frame)
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth,window.innerHeight,false)
})
const diagnostics=geometryDiagnostics()
if(diagnostics.length)console.error('Invalid V3 spatial topology:',diagnostics)
refresh()
window.__v3Proof={
  get phase(){return phase},
  get selected(){return active},
  get built(){return visibleCount},
  get camera(){return camera.position.toArray()},
  get quaternion(){return camera.quaternion.toArray()},
  get origin(){return START.toArray()},
  get loopU(){return routeU},
  get completed(){return travelCount},
  get maxStep(){return maxObservedStep},
  get defects(){return diagnostics},
  get materialsOpaque(){return !materialWall.transparent&&materialWall.opacity===1&&materialWall.depthWrite},
  get hubRoofOpaque(){return !materialHub.transparent&&materialHub.depthWrite},
  get hasHubWalls(){return hubWallGeometry.index.count>150},
  get cameraInside(){return camera.position.y>HUB.y+chamberFloor&&camera.position.y<HUB.y+chamberCeiling},
  get fiveChoices(){return ui.choices.querySelectorAll('button').length},
  get loops(){return LOOPS.map(x=>({start:point(x,0).toArray(),end:point(x,1).toArray()}))},
  get wallHits(){return active>=0&&phase==='travelling'?wallRayProbe(active,routeU):null},
  testOcclusion(i=0,u=.38){return wallRayProbe(i,u)},
  get version(){return 'V3-immersion-opaque-interiors'},
  selectPath,
  speedUp(factor){
    if(factor>=1&&factor<=3)durations.loop=17.2/factor
  }
}
