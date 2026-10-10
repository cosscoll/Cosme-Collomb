import { PATHS, MAIN_HUBS, PROJECT_HUBS, PROJECT_FORK_POSITION,
  projectOutboundT, detailTravelT, closestT } from './geometry.js'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

export const TRANSIT_DURATION=4200
export const TRANSIT_MID=.52
export const ease=t=>{
  const v=Math.max(0,Math.min(1,t))
  return v*v*(3-2*v)
}
const clamp=v=>Math.max(0,Math.min(1,v))
export const PROJECT_INDEX_HUB=closestT(PATHS.routes[0],PROJECT_FORK_POSITION)
// The lookout stays several metres before the open end of the main tunnel.
// At the previous -.012 stop the camera saw the terminal wall rather than
// the five diverging paths.
// The crossroads is at the physical end of the shared corridor. Parking
// backwards from this point forced an unwanted 180-degree reversal after
// every completed project loop.
export const PROJECT_LOOKOUT_T=PROJECT_INDEX_HUB
export const PROJECT_ENTRY_OFFSET=.105
export const MAIN_ENTRY_OFFSET=.105
const detailMainHubs=PATHS.details.map(p=>closestT(p,[0,0,-30]))

export function routeInfo(pathname='/'){
  const detailIndex=PROJECTS.findIndex(p=>pathname==='/projets/'+p.slug)
  if(detailIndex>=0)return {
    mode:'detail',index:detailIndex,path:PATHS.details[detailIndex],
    mainHub:detailMainHubs[detailIndex],projectHub:PROJECT_HUBS[detailIndex],
    pathName:pathname
  }
  const idx=pathname==='/parcours'||pathname==='/experience'?1:
    pathname==='/contact'?2:0
  return {
    mode:pathname==='/projets'?'projects':idx===1?'experience':idx===2?'contact':'home',
    index:idx,path:PATHS.routes[idx],mainHub:MAIN_HUBS[idx],
    projectHub:idx===0?PROJECT_INDEX_HUB:null,pathName:pathname
  }
}
export function usesProjectHub(from,to){
  return ['projects','detail'].includes(from.mode) &&
    ['projects','detail'].includes(to.mode)
}
export function transitionAnchor(info,from,to){
  if(usesProjectHub(from,to))return info.projectHub
  return info.mainHub
}
export function arrivalT(info,from){
  if(info.mode==='detail')return Math.min(.965,info.projectHub+PROJECT_ENTRY_OFFSET)
  if(info.mode==='projects')return PROJECT_LOOKOUT_T
  if(info.mode==='home')return .025
  return info.mainHub+MAIN_ENTRY_OFFSET
}
export function scrollT(info,{scrollY=0,total=1,junction=1,works=2,projectFork=2}={}){
  const fraction=clamp(scrollY/Math.max(1,total))
  if(info.mode==='detail'){
    // The physical route is a forward-only loop. Scrolling must never make
    // the camera backtrack or execute a sudden 180-degree reversal.
    const entrance=info.projectHub+PROJECT_ENTRY_OFFSET
    return entrance+(1-entrance)*ease(fraction)
  }
  if(info.mode==='projects'){
    // Stay in the real open crossroads, facing the project entrances.
    // Do not slide the camera back down the entrance tunnel when the page
    // scroll state resets at the end of a project.
    return PROJECT_LOOKOUT_T
  }
  if(info.mode==='home'){
    if(scrollY<=junction)return .025+ease(scrollY/Math.max(1,junction))*(info.mainHub+.012-.025)
    if(scrollY<works)return info.mainHub+.012+ease((scrollY-junction)/Math.max(1,works-junction))*.025
    return info.mainHub+.037+ease((scrollY-works)/Math.max(1,total-works))*(.955-info.mainHub-.037)
  }
  return info.mainHub+MAIN_ENTRY_OFFSET+ease(fraction)*(.955-info.mainHub-MAIN_ENTRY_OFFSET)
}
export function junctionFor(from,to,initialT){
  const projectModes=new Set(['home','projects','detail'])
  // Every destination shares the trunk. Project-to-project shortcuts use
  // the actual second junction instead of a fabricated Bézier connector.
  const shortcut=projectModes.has(from.mode)&&projectModes.has(to.mode)&&
    (from.mode!=='home'||initialT>(from.mainHub+PROJECT_INDEX_HUB)*.5)&&
    (to.mode!=='home'||from.mode==='projects')
  // Once a project has passed the far end of its OUTBOUND corridor,
  // reaching the fork means continuing ahead to t=1 on the return arm.
  // Heading backwards to the original projectHub would undo the loop.
  const returningToFork=shortcut && from.mode==='detail' &&
    initialT>.76 && ['projects','detail'].includes(to.mode)
  return {
    level:shortcut?'projects':'main',
    fromT:returningToFork?1:shortcut?from.projectHub:from.mainHub,
    toT:shortcut?to.projectHub:to.mainHub
  }
}
export function bridgeBuild(progress){
  const p=clamp(progress)
  return ease((p-.10)/.41)
}
export function sampleTransit(from,to,initialT,progress){
  const p=clamp(progress)
  const hub=junctionFor(from,to,initialT)
  const end=arrivalT(to,from)
  // A finished project already has a dedicated FORWARD return corridor.
  // Use the full 4.2 s flight to approach the real fork, rather than
  // arriving after 52% and rotating in place for the remaining 48%.
  // On the final frame hand over to the shared project junction at the
  // *exact same 3D location*, without a reverse leg.
  if(from.mode==='detail' && to.mode==='projects' &&
    initialT>.76 && hub.fromT>.999){
    if(p<1)return {path:from.path,t:initialT+(1-initialT)*ease(p),
      mode:from.mode,index:from.index,reverse:false,phase:'forward-return'}
    return {path:to.path,t:PROJECT_INDEX_HUB,mode:to.mode,index:to.index,
      reverse:false,phase:'arrived'}
  }
  // Approach the real intersection continuously until the bridge is ready.
  // The former .35-.52 pause froze the camera for ~700 ms mid-navigation.
  if(p<TRANSIT_MID){
    const t=initialT+(hub.fromT-initialT)*ease(p/TRANSIT_MID)
    return {path:from.path,t,reverse:hub.fromT<initialT,
      mode:from.mode,index:from.index,
      phase:p<.35?'approach':'assemble'}
  }
  const f=ease((p-TRANSIT_MID)/(1-TRANSIT_MID))
  // Both routes belong to the same intersection, but their independent
  // Catmull–Rom splines can differ by decimetres at the sampled joint.
  // Align the *physical* camera position exactly there and gently remove
  // that alignment as the destination corridor begins. No position filter
  // or "catch-up" lag is needed, so finishing a trip cannot snap again.
  const join=from.path.getPointAt(clamp(hub.fromT))
    .sub(to.path.getPointAt(clamp(hub.toT)))
  // Drive the correction by DISTANCE along the new branch, rather than
  // time. The assembled 3D wall can then use the same offset per section,
  // so the viewer is moving down the true centre of the bridge.
  const alignment=1-ease(f/.35)
  return {path:to.path,t:hub.toT+(end-hub.toT)*f,
    offset:join.multiplyScalar(alignment),
    reverse:end<hub.toT,mode:to.mode,index:to.index,phase:'cross'}
}

// Physical camera world position: the interpolation belongs to the route,
// NOT a second, independently damped camera that can lag behind a page swap.
export function transitPoint(sample,target){
  // A hub can be the true endpoint of an incoming route (t=1).
  // Artificially clamping at .998 froze the camera before the crossing
  // and created a visible gap when switching to the next corridor.
  const t=clamp(sample.t)
  const point=sample.path.getPointAt(t,target)
  if(sample.offset)point.add(sample.offset)
  return point
}
