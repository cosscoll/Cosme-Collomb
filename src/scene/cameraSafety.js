import * as THREE from 'three'

const clamp=(x,min,max)=>Math.min(max,Math.max(min,x))

// A portrait screen sees a much narrower corridor than a desktop display.
// Keep the wide-angle projection from cutting through nearby walls in turns.
export function corridorFov(aspect,bridgeBoost=0){
  const ratio=clamp(aspect,.35,2.7)
  const portrait=Math.max(0,1-ratio)
  const wide=Math.max(0,ratio-1.9)
  return clamp(45-8*portrait-2*wide,39,45)+bridgeBoost
}

// Aim along the ACTUAL curved centreline a few metres ahead, never at a
// remote tangent projected through a bend or through the outside of a tube.
// A THREE.CurvePath uses arc-length coordinates in getPointAt/getTangentAt.
export function corridorHeading(path,t,reverse=false,target=new THREE.Vector3()){
  const u=clamp(t,0,1)
  const step=Math.min(.048,Math.max(.006,3.25/Math.max(1,path.getLength())))
  let next=clamp(u+(reverse?-step:step),0,1)
  if(Math.abs(next-u)<.00001){
    // At an open route end, retain its actual tangent rather than turning
    // toward the previous point and looking through the terminal wall.
    path.getTangentAt(u,target)
    if(reverse)target.negate()
    return target.normalize()
  }
  path.getPointAt(next,target)
  target.sub(path.getPointAt(u))
  if(target.lengthSq()<.000001){
    path.getTangentAt(u,target)
    if(reverse)target.negate()
  }
  return target.normalize()
}

// The camera must remain close to the visible spline centreline; avoid a
// pointer or head-bob displacement ever taking it near a narrow branch skin.
export function safeEyeOffset(aspect,x,y,elapsed){
  const mobile=aspect<.8
  const horizontal=mobile?0:clamp(x,-1,1)*.085
  const vertical=mobile?0:-clamp(y,-1,1)*.055
  return {horizontal,vertical:vertical+Math.sin(elapsed*.28)*.012}
}


// Turn only in the OPEN physical chamber around a junction. A time-based
// rotation starts turning from far down a corridor on long journeys and
// visibly points the visitor through still-opaque walls.
export const JUNCTION_TURN_METRES = 4.35
export function junctionTurnWeight(distanceMetres,afterJunction=false){
  const d=clamp(Math.abs(distanceMetres)/JUNCTION_TURN_METRES,0,1)
  const near=1-d*d*(3-2*d)
  return afterJunction ? 1-.5*near : .5*near
}
