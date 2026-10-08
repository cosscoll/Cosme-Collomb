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
  const start=startPosition.clone()
  const end=endPosition.clone()
  const heading=startHeading.clone().normalize()
  const arrival=endHeading.clone().normalize()
  const distance=start.distanceTo(end)
  // Cubic Bézier: exact world-space endpoints AND matching entry/exit tangents.
  // The former multi-point Catmull curve doubled back on some routes and made
  // its overlapping wall pass through the camera, as shown by the recording.
  const reach=Math.max(4.5,Math.min(20,distance*.32))
  const p1=start.clone().addScaledVector(heading,reach)
  const p2=end.clone().addScaledVector(arrival,-reach)
  const path=new THREE.CubicBezierCurve3(start,p1,p2,end)
  path.arcLengthDivisions=700
  return path
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
