import * as THREE from 'three'

// A physically connected bridge from the eye's current forward direction to
// the entry tangent of the destination. Built as one continuous 360° shell.
const clamp=(n)=>Math.max(0,Math.min(1,n))
export const smooth=(n)=>{const t=clamp(n);return t*t*(3-2*t)}
export function bridgeGrowth(progress){
  const p=clamp(progress)
  if(p<.19)return .025+.36*smooth(p/.19)
  return .385+.615*smooth((p-.19)/.61)
}
export function bridgeTravel(progress){
  const p=clamp(progress)
  if(p<.19)return 0
  return smooth((p-.19)/.75)
}
export function createBridgeCurve(startPosition,startHeading,endPosition,endHeading){
  const origin=startPosition.clone()
  const finish=endPosition.clone()
  const heading=startHeading.clone().normalize()
  const arrival=endHeading.clone().normalize()
  const distance=origin.distanceTo(finish)
  const push=Math.max(5,Math.min(16,distance*.22))
  const front=origin.clone().addScaledVector(heading,push)
  const back=finish.clone().addScaledVector(arrival,-push)
  const center=front.clone().lerp(back,.5)
  // The two tangents are not connected by a hard corner. Extra points create
  // a gentle sweep suitable for a tunnel with no holes or teleportation.
  const curve=new THREE.CatmullRomCurve3([
    origin,
    origin.clone().addScaledVector(heading,push*.48),
    front,
    center,
    back,
    finish.clone().addScaledVector(arrival,-push*.48),
    finish
  ],false,'centripetal')
  curve.arcLengthDivisions=600
  return curve
}
export function bridgeDrawCount(geometry,progress,radialSegments=40){
  const total=geometry.index.count
  const trianglesPerRing=radialSegments*6
  const rows=Math.floor(total/trianglesPerRing)
  const visible=Math.max(0,Math.min(rows,Math.floor(rows*bridgeGrowth(progress))))
  return visible*trianglesPerRing
}
export function bridgeConnectionDistance(curve,start,end){
  return Math.max(curve.getPointAt(0).distanceTo(start),
    curve.getPointAt(1).distanceTo(end))
}
