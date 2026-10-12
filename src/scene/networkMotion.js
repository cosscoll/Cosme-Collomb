import { clamp, curvatureAt } from './spatialNetwork.js'

export const MAX_SPEED=12
export const MAX_STEP=.42
export const MAX_TURN_RATE=.68
export const ACCELERATION=9

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
  const step=Math.min(remaining,MAX_STEP,nextSpeed*dt)
  return {distance:distance+step,speed:step>=remaining?0:nextSpeed}
}
