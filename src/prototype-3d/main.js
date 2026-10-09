import * as THREE from 'three'
import './style.css'

// An isolated proof of concept: all camera positions, decks and bridge
// pieces are sampled from ONE arc-length-parametrised 3D curve.
// There is no router switch, hidden corridor replacement or teleport.
const el=id=>document.getElementById(id)
const canvas=el('world')
const ui={
  start:el('start'),back:el('return'),status:el('status'),
  hint:el('hint'),phase:el('phase'),progress:el('progress'),
  percent:el('percent'),position:el('position'),error:el('error')
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v))
const ease=t=>{const x=clamp(t);return x*x*(3-2*x)}
const easeTravel=t=>.5-.5*Math.cos(Math.PI*clamp(t))
const V=(x,y,z)=>new THREE.Vector3(x,y,z)
const UP=V(0,1,0)
const COLOR={
  midnight:0x070d16,teal:0x9df8df,steel:0x455d78,blue:0x729ab1,
  orange:0xeac7ab,rail:0x8eece8,white:0xe9f6fc
}
const path=new THREE.CatmullRomCurve3([
  V(0,2.15,7.5),V(0,2.15,4),V(0,2.15,-2),
  V(0,2.20,-9.5),V(0,2.35,-15.5),
  V(1.55,2.85,-22),V(4.3,3.6,-30.5),V(3.4,3.45,-38),
  V(0,2.25,-45),V(0,2.15,-52),V(0,2.15,-60)
],false,'centripetal')
path.arcLengthDivisions=1800
path.updateArcLengths()
const pathLength=path.getLength()
function closestParam(point){
  let best=0,bestDist=Infinity
  for(let i=0;i<=1200;i++){
    const u=i/1200
    const dist=path.getPointAt(u).distanceToSquared(point)
    if(dist<bestDist){best=u;bestDist=dist}
  }
  return best
}
const bridgeFrom=closestParam(V(0,2.35,-15.5))
const bridgeTo=closestParam(V(0,2.25,-45))
const bridgeSegments=64
const routeSample=u=>path.getPointAt(clamp(u))
const tangent=u=>path.getTangentAt(clamp(u)).normalize()
function sideAt(u){
  const d=tangent(u)
  return V(-d.z,0,d.x).normalize()
}
function framePoint(u,lateral=0,height=0){
  return routeSample(u).addScaledVector(sideAt(u),lateral).addScaledVector(UP,height)
}
const scene=new THREE.Scene()
scene.background=new THREE.Color(COLOR.midnight)
scene.fog=new THREE.FogExp2(COLOR.midnight,.018)
let renderer
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55))
  renderer.setSize(window.innerWidth,window.innerHeight,false)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure=1.45
}catch(error){
  ui.error.hidden=false
  ui.status.textContent='WEBGL INDISPONIBLE'
  throw error
}
const camera=new THREE.PerspectiveCamera(65,window.innerWidth/window.innerHeight,.12,220)
camera.position.copy(routeSample(0))
camera.up.copy(UP)
camera.lookAt(routeSample(.045))
const initialQuaternion=camera.quaternion.clone()
scene.add(new THREE.HemisphereLight(0xbacfe8,0x18233b,2.2))
scene.add(new THREE.AmbientLight(0xa8cae7,.32))
const sun=new THREE.DirectionalLight(0xe3edf8,2.4)
sun.position.set(-12,20,-2)
scene.add(sun)
function light(x,y,z,color,intensity,range){
  const l=new THREE.PointLight(color,intensity,range,2)
  l.position.set(x,y,z);scene.add(l)
}
light(0,8,-6,COLOR.teal,62,25)
light(2,9,-33,0x6b9ff2,60,28)
light(0,8,-54,0xeebbc7,75,25)

const deckMaterial=new THREE.MeshStandardMaterial({
  color:0x25374d,roughness:.62,metalness:.56,side:THREE.DoubleSide
})
const bridgeMaterial=new THREE.MeshStandardMaterial({
  color:0x436279,roughness:.36,metalness:.68,
  emissive:0x18353c,emissiveIntensity:.38,side:THREE.DoubleSide
})
const steelMaterial=new THREE.MeshStandardMaterial({
  color:0x7892a8,metalness:.74,roughness:.27
})
const lightMaterial=new THREE.MeshBasicMaterial({color:COLOR.teal})
const paleMaterial=new THREE.MeshBasicMaterial({color:0xbddced})
const orangeMaterial=new THREE.MeshBasicMaterial({color:COLOR.orange})
const collisionMeshes=[]
const staticPieces=[]
const bridgePieces=[]
const WIDTH=4.55
const FLOOR=-1.78
// Every deck and rail is anchored to the camera's exact centreline. There
// are no opaque end caps or "walls" intersecting the middle of this tube.
function beamBetween(a,b,material,radius=.04){
  const v=b.clone().sub(a),length=v.length()
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,7),material)
  mesh.position.copy(a).add(b).multiplyScalar(.5)
  mesh.quaternion.setFromUnitVectors(UP,v.normalize())
  collisionMeshes.push(mesh)
  return mesh
}
function deckBetween(u0,u1,material){
  const pts=[
    framePoint(u0,-WIDTH/2,FLOOR),framePoint(u0,WIDTH/2,FLOOR),
    framePoint(u1,-WIDTH/2,FLOOR),framePoint(u1,WIDTH/2,FLOOR)
  ]
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(
    pts.flatMap(p=>p.toArray()),3))
  geometry.setIndex([0,2,1,1,2,3])
  geometry.computeVertexNormals()
  const mesh=new THREE.Mesh(geometry,material)
  collisionMeshes.push(mesh)
  return mesh
}
function archAt(u,material){
  const points=[]
  for(let i=0;i<=18;i++){
    const theta=Math.PI*i/18
    const lateral=Math.cos(theta)*WIDTH*.55
    const height=FLOOR+4.95*Math.sin(theta)
    points.push(framePoint(u,lateral,height))
  }
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal')
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,54,.041,6,false),material)
  collisionMeshes.push(mesh)
  return mesh
}
function span(u0,u1,{bridge=false,arch=false}={}){
  const g=new THREE.Group()
  const surface=bridge?bridgeMaterial:deckMaterial
  g.add(deckBetween(u0,u1,surface))
  const side=WIDTH/2
  for(const sign of [-1,1]){
    const lateral=sign*side
    g.add(beamBetween(framePoint(u0,lateral,FLOOR+.22),
      framePoint(u1,lateral,FLOOR+.22),steelMaterial,.041))
    g.add(beamBetween(framePoint(u0,lateral,FLOOR+1.12),
      framePoint(u1,lateral,FLOOR+1.12),lightMaterial,.024))
    if(bridge){
      g.add(beamBetween(framePoint(u0,lateral,FLOOR),
        framePoint(u0,lateral,FLOOR+1.12),steelMaterial,.055))
    }
  }
  if(arch)g.add(archAt(u0,bridge?orangeMaterial:paleMaterial))
  return g
}
// Static approaches and destination are connected to the exact two sample
// points from which the bridge grows. No visibility swap occurs in flight.
const staticCount=34
for(let i=0;i<staticCount;i++){
  const a=bridgeFrom*i/staticCount
  const b=bridgeFrom*(i+1)/staticCount
  const g=span(a,b,{arch:i%6===0})
  scene.add(g);staticPieces.push(g)
}
for(let i=0;i<staticCount;i++){
  const a=bridgeTo+(1-bridgeTo)*i/staticCount
  const b=bridgeTo+(1-bridgeTo)*(i+1)/staticCount
  const g=span(a,b,{arch:i%5===0})
  scene.add(g);staticPieces.push(g)
}
for(let i=0;i<bridgeSegments;i++){
  const a=bridgeFrom+(bridgeTo-bridgeFrom)*i/bridgeSegments
  const b=bridgeFrom+(bridgeTo-bridgeFrom)*(i+1)/bridgeSegments
  const g=span(a,b,{bridge:true,arch:i%7===0})
  g.visible=false
  scene.add(g)
  bridgePieces.push(g)
}
function makePlatform(center,radius,accent){
  const geo=new THREE.CylinderGeometry(radius,radius,.45,84,1,false)
  const mat=new THREE.MeshStandardMaterial({color:0x203147,metalness:.63,roughness:.4})
  const mesh=new THREE.Mesh(geo,mat)
  mesh.position.copy(center).addScaledVector(UP,FLOOR-.24)
  scene.add(mesh)
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius-.16,.052,9,96),new THREE.MeshBasicMaterial({color:accent}))
  rim.position.copy(center).addScaledVector(UP,FLOOR+.04)
  rim.rotation.x=-Math.PI/2
  scene.add(rim)
}
const hubCenter=V(0,2.15,-1.9)
makePlatform(hubCenter,10.35,0x4b8799)
makePlatform(V(0,2.15,-59.5),7.4,0xdfbaa2)
function makeGate(center,direction,color,active=false){
  const gate=new THREE.Mesh(
    new THREE.TorusGeometry(active?2.8:2.2,active?.075:.042,8,76),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:active?.93:.42}))
  gate.position.copy(center)
  gate.quaternion.setFromUnitVectors(V(0,0,1),direction)
  scene.add(gate)
  const lamp=new THREE.Mesh(new THREE.IcosahedronGeometry(.20,1),
    new THREE.MeshBasicMaterial({color}))
  lamp.position.copy(center).addScaledVector(UP,active?3.4:2.75)
  scene.add(lamp)
}
const angles=[-70,-35,0,35,70]
const gateColors=[0x6d93ab,0x92aacb,0x9df8df,0xb5a5d4,0x849bb9]
for(let i=0;i<angles.length;i++){
  const degrees=angles[i]*Math.PI/180
  const forward=V(Math.sin(degrees),0,-Math.cos(degrees))
  const p=V(0,2.15,-1.9).addScaledVector(forward,8.8)
  makeGate(p,forward,gateColors[i],i===2)
  if(i!==2){
    // Stub ends stay OPEN and are outside the active route. These four
    // galleries are scenery only; this proof validates the centre one.
    const end=p.clone().addScaledVector(forward,7)
    const g=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,7,6),steelMaterial)
    g.position.copy(p).add(end).multiplyScalar(.5).addScaledVector(UP,FLOOR+.1)
    g.quaternion.setFromUnitVectors(UP,forward)
    // No opaque floor/wall is put across the playable main route.
    scene.add(g)
  }
}
const projectCenter=V(0,2.15,-67.5)
const object=new THREE.Group()
const gem=new THREE.Mesh(
  new THREE.IcosahedronGeometry(2.65,1),
  new THREE.MeshStandardMaterial({color:0x9ce3ee,metalness:.5,roughness:.11,
    emissive:0x24869d,emissiveIntensity:.65,flatShading:true}))
object.add(gem)
const outerRing=new THREE.Mesh(
  new THREE.TorusGeometry(4.3,.07,12,84),
  new THREE.MeshBasicMaterial({color:0xd6d8f1,transparent:true,opacity:.64}))
object.add(outerRing)
object.position.copy(projectCenter).addScaledVector(UP,.85)
scene.add(object)
for(const sign of [-1,1]){
  const column=new THREE.Mesh(new THREE.CylinderGeometry(.32,.48,10,9),
    new THREE.MeshStandardMaterial({color:0x526b87,metalness:.72,roughness:.35}))
  column.position.set(sign*5.35,5.5,-63.5)
  scene.add(column)
}
makeGate(V(0,2.15,-56.5),V(0,0,-1),0xeac7ab,true)
const stars=new Float32Array(250*3)
for(let i=0;i<250;i++){
  const angle=i*2.39996
  const r=24+(i*17%64)
  stars[3*i]=Math.cos(angle)*r
  stars[3*i+1]=6+(i*19%34)
  stars[3*i+2]=12-(i*29%116)
}
const starGeometry=new THREE.BufferGeometry()
starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3))
scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({
  size:.15,sizeAttenuation:true,color:0xc3e7fd,transparent:true,opacity:.72
})))

let stage='idle'
let elapsed=0
let pathU=0
let constructed=0
let returnRequested=false
const outwardSeconds=9.5
const bridgeSeconds=3.5
const targetQuat=new THREE.Quaternion()
const targetMatrix=new THREE.Matrix4()
const look=new THREE.Vector3()
const current=new THREE.Vector3()
const next=new THREE.Vector3()
let previousPoint=routeSample(0)
let maxFrameDistance=0
let lastFrameDistance=0
let frameCount=0
const traveledSamples=[]
function setStage(value){
  stage=value
  elapsed=0
  const labels={
    idle:['01 / AU CARREFOUR','PRÊT À EXPLORER','Le pont est construit dans le décor, puis emprunté sans déplacement instantané.','CARREFOUR — 5 ACCÈS'],
    constructing:['02 / CONSTRUCTION EN 3D','LE PONT SE CONSTRUIT','Les éléments du tablier, les garde-corps et les arches apparaissent de proche en proche.','CONSTRUCTION EN COURS'],
    outbound:['03 / TRAVERSÉE PHYSIQUE','TRAVERSÉE DU PONT','La caméra avance sur le trajet utilisé pour générer le pont. Aucun mur ne ferme le passage.','SUR LE MÊME CHEMIN'],
    arrived:['04 / PROJET ATTEINT','ARRIVÉE AU PROJET','Le parcours se termine à une vraie extrémité ouverte. Le retour utilise exactement la même courbe.','PROJET — DESTINATION'],
    turning:['05 / DEMI-TOUR SUR PLACE','LA CAMÉRA SE RETOURNE','Aucun changement de position pendant ce demi-tour : la caméra pivote avant de repartir.','PRÉPARATION DU RETOUR'],
    returning:['06 / RETOUR PHYSIQUE','RETOUR AU CARREFOUR','La caméra retraverse le même pont, dans l’autre sens, sans raccourci.','CHEMIN DU RETOUR'],
    turnHome:['07 / ORIENTATION AU CARREFOUR','RETOUR TERMINÉ','La caméra retrouve sa position d’origine avant de regarder de nouveau les cinq directions.','CARREFOUR — RETROUVÉ'],
    finished:['01 / AU CARREFOUR','LE MÊME CARREFOUR','Les cinq accès sont toujours visibles. Relance le parcours pour revoir la construction.','CARREFOUR — 5 ACCÈS']
  }
  const copy=labels[value]
  ui.phase.textContent=copy[0]
  ui.status.textContent=copy[1]
  ui.hint.textContent=copy[2]
  ui.position.textContent=copy[3]
  ui.start.hidden=!(value==='idle'||value==='finished')
  ui.return.hidden=value!=='arrived'
  ui.return.disabled=value!=='arrived'
  ui.start.textContent=value==='finished'?'Rejouer la construction ↗':'Construire le pont ↗'
}
function showProgress(amount){
  const pct=Math.floor(100*clamp(amount))
  ui.progress.style.width=pct+'%'
  ui.percent.textContent=pct+' %'
}
function enablePieces(count){
  const nextCount=Math.max(0,Math.min(bridgeSegments,count))
  if(nextCount===constructed)return
  bridgePieces.forEach((g,i)=>{g.visible=i<nextCount})
  constructed=nextCount
}
function start(){
  if(stage!=='idle'&&stage!=='finished')return
  pathU=0
  enablePieces(0)
  previousPoint.copy(routeSample(0))
  setStage('constructing')
  showProgress(0)
}
function requestReturn(){
  if(stage!=='arrived')return
  returnRequested=true
  setStage('turning')
  showProgress(0)
}
ui.start.addEventListener('click',start)
ui.return.addEventListener('click',requestReturn)
function faceHeading(direction,dt){
  // Rotate at bounded angular velocity; the camera cannot spin instantly
  // at the end of either trip, or when the tangent changes near a curve.
  look.copy(camera.position).add(direction)
  targetMatrix.lookAt(camera.position,look,UP)
  targetQuat.setFromRotationMatrix(targetMatrix)
  const angle=camera.quaternion.angleTo(targetQuat)
  const alpha=angle>0?Math.min(1,dt*4,.035+dt*2,dt*2.5/angle):1
  camera.quaternion.slerp(targetQuat,alpha)
  return angle
}
function cameraAt(u,headingSign,dt){
  pathU=clamp(u)
  current.copy(routeSample(pathU))
  camera.position.copy(current)
  const head=tangent(pathU).multiplyScalar(headingSign)
  faceHeading(head,dt)
  lastFrameDistance=camera.position.distanceTo(previousPoint)
  maxFrameDistance=Math.max(maxFrameDistance,lastFrameDistance)
  previousPoint.copy(camera.position)
  if(frameCount%10===0)traveledSamples.push({u:pathU,position:camera.position.toArray(),stage})
}
function centerlineCollisionCount(){
  // Test using the fully updated world transforms of all physical 3D meshes.
  scene.updateMatrixWorld(true)
  // An actual swept eye-line vs the deck and rails: the bridge is included
  // even while visually unbuilt. No mesh may cut through the camera route.
  const raycaster=new THREE.Raycaster()
  raycaster.near=.0001
  let collisions=0
  const chunk=.002
  for(let i=0;i<1/chunk;i++){
    const a=routeSample(i*chunk)
    const b=routeSample((i+1)*chunk)
    const d=b.clone().sub(a)
    const len=d.length()
    if(!len)continue
    d.divideScalar(len)
    raycaster.set(a,d)
    raycaster.far=len
    // Explicitly test all created triangle meshes; invalid bridges fail.
    const intersections=raycaster.intersectObjects(collisionMeshes,false)
    if(intersections.length)collisions++
  }
  return collisions
}
const collisionCount=centerlineCollisionCount()
window.__prototypeProof={
  get state(){return stage},
  get u(){return pathU},
  get camera(){return camera.position.toArray()},
  get quaternion(){return camera.quaternion.toArray()},
  get startingPoint(){return routeSample(0).toArray()},
  get destinationPoint(){return routeSample(1).toArray()},
  get constructed(){return constructed},
  get totalPieces(){return bridgePieces.length},
  get collisions(){return collisionCount},
  get bridgeJoints(){
    const start=framePoint(bridgeFrom,0,FLOOR)
    const end=framePoint(bridgeTo,0,FLOOR)
    return {start:start.toArray(),end:end.toArray(),segments:bridgeSegments}
  },
  get maxFrameDistance(){return maxFrameDistance},
  get samples(){return traveledSamples.slice()},
  get pathLength(){return pathLength},
  start,requestReturn,
  version:'proof-bridge-v1'
}
setStage('idle')
let lastTime=performance.now()
function animate(time){
  const dt=Math.min(.05,Math.max(0,(time-lastTime)/1000))
  lastTime=time
  frameCount++
  if(stage==='constructing'){
    elapsed+=dt
    const fraction=clamp(elapsed/bridgeSeconds)
    enablePieces(Math.floor(bridgeSegments*ease(fraction)))
    showProgress(fraction)
    if(fraction>=1){
      enablePieces(bridgeSegments)
      setStage('outbound')
    }
  }else if(stage==='outbound'){
    elapsed+=dt
    const fraction=clamp(elapsed/outwardSeconds)
    cameraAt(easeTravel(fraction),1,dt)
    showProgress(fraction)
    if(fraction>=1){setStage('arrived');showProgress(1)}
  }else if(stage==='arrived'){
    object.rotation.y+=dt*.33
    outerRing.rotation.y+=dt*.46
  }else if(stage==='turning'){
    elapsed+=dt
    const angle=faceHeading(tangent(1).negate(),dt)
    if(angle<.015 && elapsed>.5){
      setStage('returning')
    }
  }else if(stage==='returning'){
    elapsed+=dt
    const fraction=clamp(elapsed/outwardSeconds)
    cameraAt(1-easeTravel(fraction),-1,dt)
    showProgress(fraction)
    if(fraction>=1){
      setStage('turnHome')
    }
  }else if(stage==='turnHome'){
    elapsed+=dt
    // Align the original quaternion while stationary at precisely u=0.
    const angle=camera.quaternion.angleTo(initialQuaternion)
    camera.quaternion.slerp(initialQuaternion,angle>0?
      Math.min(1,dt*3,dt*2.5/angle):1)
    if(angle<.012 && elapsed>.5){
      camera.position.copy(routeSample(0))
      camera.quaternion.copy(initialQuaternion)
      setStage('finished')
      showProgress(1)
    }
  }
  renderer.render(scene,camera)
}
renderer.setAnimationLoop(animate)
window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth,window.innerHeight,false)
})
