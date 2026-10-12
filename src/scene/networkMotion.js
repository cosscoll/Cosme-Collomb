import * as THREE from 'three'
import { clamp, curvatureAt, orientationAt } from './spatialNetwork.js'

export const MAX_SPEED=24
export const MAX_STEP=.42
export const MAX_TURN_RATE=1.1
export const ACCELERATION=24
const MAX_ROTATION_STEP=.09
const before=new THREE.Quaternion(),after=new THREE.Quaternion()

export function advanceMotion(distance,target,speed,delta,edge=null,curveDistance=distance) {
  const dt=clamp(delta,0,.055)
  const remaining=Math.max(0,target-distance)
  if(remaining<1e-6)return {distance:target,speed:0}
  // Anticipate the tightest bend several metres ahead before entering it.
  let curvature=0
  if(edge)for(const ahead of [0,1.5,3,5])curvature=Math.max(curvature,curvatureAt(edge,curveDistance+ahead))
  const cruise=Math.min(MAX_SPEED,MAX_TURN_RATE/Math.max(.001,curvature))
  const wanted=Math.min(cruise,Math.sqrt(2*ACCELERATION*remaining))
  const nextSpeed=speed+clamp(wanted-speed,-ACCELERATION*dt,ACCELERATION*dt)
  let step=Math.min(remaining,MAX_STEP,nextSpeed*dt)
  // Bound the full rendered quaternion, including the roll on inclined
  // galleries, rather than relying on heading curvature alone. Reduce the
  // distance along the physical curve; never lag or rotate the eye in place.
  if(edge&&step>0){
    orientationAt(edge,curveDistance,before)
    orientationAt(edge,curveDistance+step,after)
    if(before.angleTo(after)>MAX_ROTATION_STEP){
      let low=0,high=step
      for(let i=0;i<9;i++){
        const mid=(low+high)/2
        orientationAt(edge,curveDistance+mid,after)
        if(before.angleTo(after)>MAX_ROTATION_STEP)high=mid
        else low=mid
      }
      step=low
    }
  }
  return {distance:distance+step,speed:step>=remaining?0:Math.min(nextSpeed,dt>0?step/dt:nextSpeed)}
}
