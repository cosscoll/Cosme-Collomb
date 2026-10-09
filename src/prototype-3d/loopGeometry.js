import * as THREE from 'three'

// One world, one hub and five true closed-loop route centre-lines.
// Every path begins AND ends at the exact same world-space centre.
export const HUB=new THREE.Vector3(0,2.6,2)
export const UP=new THREE.Vector3(0,1,0)
export const WIDTH=2.55
export const FLOOR=-1.80
export const GATES=[-70,-35,0,35,70].map(d=>d*Math.PI/180)
export const COLORS=['#a8a2ff','#95dada','#f6c6a6','#dac2f9','#a9e5cb']
export const BRIDGE_STEPS=56
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v))
export const ease=t=>{const n=clamp(t);return n*n*(3-2*n)}
export const easing=t=>.5-.5*Math.cos(Math.PI*clamp(t))

function radial(angle,r,lift=0,side=0){
  // Cross-track displacement stays within each path's sector and is
  // continuously reduced to zero at the shared central atrium.
  const d=new THREE.Vector3(Math.sin(angle),0,-Math.cos(angle))
  const right=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle))
  return HUB.clone().addScaledVector(d,r).addScaledVector(right,side)
    .addScaledVector(UP,lift)
}
export function makeLoop(index){
  if(!Number.isInteger(index)||index<0||index>=5)throw Error('Invalid project path '+index)
  const a=GATES[index]
  const control=[
    [0,0,0],[6,0,0],[12,.05,-.8],[20,.25,-2.2],
    [29,.65,-3.6],[39,1.2,-4.5],[49,1.9,-2.0],
    [54,2.35,3.2],[54,2.35,8.8],[49,2.15,14.4],
    [41,1.45,16],[33,1.1,13],[25,.65,8.7],
    [17,.28,4.5],[11,.08,1.3],[5,0,0],[0,0,0]
  ]
  const path=new THREE.CatmullRomCurve3(
    control.map(([r,lift,lateral])=>radial(a,r,lift,lateral)),
    false,'centripetal'
  )
  path.arcLengthDivisions=1300
  path.updateArcLengths()
  return path
}
export const LOOPS=Array.from({length:5},(_,i)=>makeLoop(i))
export const point=(path,u)=>path.getPointAt(clamp(u))
export const tangent=(path,u)=>path.getTangentAt(clamp(u)).normalize()
export function rightAt(path,u){
  const t=tangent(path,u)
  const right=new THREE.Vector3(-t.z,0,t.x)
  if(right.lengthSq()<.0001)right.set(1,0,0)
  return right.normalize()
}
export function framePoint(path,u,lateral=0,up=0){
  return point(path,u).addScaledVector(rightAt(path,u),lateral)
    .addScaledVector(UP,up)
}
export function findParamAtRadius(path,radius,{fromStart=true}={}){
  const steps=1000
  if(fromStart){
    for(let i=0;i<=steps;i++){
      const u=i/steps
      const p=point(path,u)
      if(Math.hypot(p.x-HUB.x,p.z-HUB.z)>=radius)return u
    }
  }else{
    for(let i=steps;i>=0;i--){
      const u=i/steps
      const p=point(path,u)
      if(Math.hypot(p.x-HUB.x,p.z-HUB.z)>=radius)return u
    }
  }
  throw Error('Loop never reaches radius '+radius)
}
export const ZONES=LOOPS.map(path=>({
  // The shared 11m hub remains OPEN; railings only start outside the hub.
  entrance:findParamAtRadius(path,11.5,{fromStart:true}),
  bridgeStart:findParamAtRadius(path,18,{fromStart:true}),
  bridgeEnd:findParamAtRadius(path,18,{fromStart:false}),
  exit:findParamAtRadius(path,11.5,{fromStart:false})
}))
export function geometryDiagnostics(){
  const defects=[]
  for(let i=0;i<5;i++){
    const p=LOOPS[i],z=ZONES[i]
    if(point(p,0).distanceTo(HUB)>1e-8||point(p,1).distanceTo(HUB)>1e-8)
      defects.push('Loop '+i+' not welded to hub')
    if(!(z.entrance<z.bridgeStart&&z.bridgeStart<z.bridgeEnd&&z.bridgeEnd<z.exit))
      defects.push('Loop '+i+' has invalid bridge order')
    const length=p.getLength()
    if(length<65||length>180)defects.push('Loop '+i+' invalid length '+length)
  }
  return defects
}
