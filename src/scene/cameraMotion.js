// Smooth scroll-driven camera motion in metres rather than raw spline units.
// No browser dependencies so movement limits can be regression-tested.
export const MAX_SCROLL_STEP_METRES = 0.42
export const MAX_SCROLL_SPEED_MPS = 15
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x))

export function followScrollT(current,target,pathLength,deltaSeconds){
  if(!Number.isFinite(target))return current
  if(current===null||!Number.isFinite(current))return target
  const dt=clamp(deltaSeconds,0,.12)
  if(!dt)return current
  const ease=1-Math.exp(-4.8*dt)
  const maxStep=Math.min(MAX_SCROLL_STEP_METRES,MAX_SCROLL_SPEED_MPS*dt)
  const maxT=maxStep/Math.max(1,pathLength)
  return current+clamp((target-current)*ease,-maxT,maxT)
}
