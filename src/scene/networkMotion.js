import * as THREE from 'three'
import { clamp, curvatureAt, orientationAt, headingAt } from './spatialNetwork.js'

export const MAX_SPEED=36
export const MAX_STEP=.9
export const MAX_TURN_RATE=1.1
export const ACCELERATION=48
const MAX_ROTATION_STEP=.09
const before=new THREE.Quaternion(),after=new THREE.Quaternion()
const headingBefore=new THREE.Vector3(),headingAfter=new THREE.Vector3()

export function advanceMotion(distance,target,speed,delta,edge=null,curveDistance=distance) {
  const dt=clamp(delta,0,.055)
  const remaining=Math.max(0,target-distance)
  if(remaining<1e-6)return {distance:target,speed:0}
  // Anticipate braking distance instead of crawling at the speed of a bend
  // that is still several metres away. The current curve limit remains hard.
  let cruise=MAX_SPEED
  if(edge)for(const ahead of [0,2,5,10,18]){
    const curveSpeed=MAX_TURN_RATE/Math.max(.001,curvatureAt(edge,curveDistance+ahead))
    cruise=Math.min(cruise,Math.sqrt(curveSpeed*curveSpeed+2*ACCELERATION*ahead))
  }
  const wanted=Math.min(cruise,Math.sqrt(2*ACCELERATION*remaining))
  const nextSpeed=Math.min(cruise,speed+clamp(wanted-speed,-ACCELERATION*dt,ACCELERATION*dt))
  let step=Math.min(remaining,MAX_STEP,nextSpeed*dt)
  // Bound the full rendered quaternion, including the roll on inclined
  // galleries, rather than relying on heading curvature alone. Reduce the
  // distance along the physical curve; never lag or rotate the eye in place.
  if(edge&&step>0){
    orientationAt(edge,curveDistance,before)
    headingAt(edge,curveDistance,headingBefore)
    const safeStep=distance=>{
      orientationAt(edge,curveDistance+distance,after)
      headingAt(edge,curveDistance+distance,headingAfter)
      return before.angleTo(after)<=MAX_ROTATION_STEP&&headingBefore.angleTo(headingAfter)<=MAX_TURN_RATE*dt
    }
    if(!safeStep(step)){
      let low=0,high=step
      for(let i=0;i<9;i++){
        const mid=(low+high)/2
        if(!safeStep(mid))high=mid
        else low=mid
      }
      step=low
    }
  }
  return {distance:distance+step,speed:step>=remaining?0:Math.min(nextSpeed,dt>0?step/dt:nextSpeed)}
}
