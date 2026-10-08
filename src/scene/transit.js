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
const renderT=t=>Math.max(.001,Math.min(.998,t))
export const PROJECT_INDEX_HUB=closestT(PATHS.routes[0],PROJECT_FORK_POSITION)
// The lookout stays several metres before the open end of the main tunnel.
// At the previous -.012 stop the camera saw the terminal wall rather than
// the five diverging paths.
export const PROJECT_LOOKOUT_T=PROJECT_INDEX_HUB-.065
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
  if(info.mode==='projects' && ['projects','detail'].includes(from.mode))
    return PROJECT_LOOKOUT_T
  if(info.mode==='projects') return info.mainHub+MAIN_ENTRY_OFFSET
  if(info.mode==='home')return .035
  return info.mainHub+MAIN_ENTRY_OFFSET
}
export function scrollT(info,{scrollY=0,total=1,junction=1,works=2,projectFork=2}={}){
  const fraction=clamp(scrollY/Math.max(1,total))
  if(info.mode==='detail'){
    const entrance=info.projectHub+PROJECT_ENTRY_OFFSET
    const far=.965
    if(fraction<=.63)return entrance+(far-entrance)*ease(fraction/.63)
    if(fraction<=.73)return far
    return far-(far-entrance)*ease((fraction-.73)/.27)
  }
  if(info.mode==='projects'){
    // Centre the camera precisely in the five-way atrium when its UI appears.
    const t=ease(scrollY/Math.max(1,projectFork))
    return info.mainHub+MAIN_ENTRY_OFFSET + t*(PROJECT_LOOKOUT_T-info.mainHub-MAIN_ENTRY_OFFSET)
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
  return {
    level:shortcut?'projects':'main',
    fromT:shortcut?from.projectHub:from.mainHub,
    toT:shortcut?to.projectHub:to.mainHub
  }
}
export function bridgeBuild(progress){
  const p=clamp(progress)
  return ease((p-.12)/.62)
}
export function sampleTransit(from,to,initialT,progress){
  const p=clamp(progress)
  const hub=junctionFor(from,to,initialT)
  const end=arrivalT(to,from)
  if(p<.35){
    const t=initialT+(hub.fromT-initialT)*ease(p/.35)
    return {path:from.path,t,reverse:hub.fromT<initialT,
      mode:from.mode,index:from.index,phase:'approach'}
  }
  if(p<TRANSIT_MID){
    return {path:from.path,t:hub.fromT,reverse:hub.fromT<initialT,
      mode:from.mode,index:from.index,phase:'assemble'}
  }
  const f=ease((p-TRANSIT_MID)/(1-TRANSIT_MID))
  // Closest sampled points on independently interpolated splines are not
  // mathematically identical. The old camera jumped up to 0.7 m at p=.52.
  // Carry the small junction mismatch into the incoming spline and fade it
  // away gradually *inside* the corridor as the new branch extends.
  const keepOffset=1-ease((p-TRANSIT_MID)/.21)
  const offset=keepOffset>0?
    from.path.getPointAt(renderT(hub.fromT)).sub(to.path.getPointAt(renderT(hub.toT)))
      .multiplyScalar(keepOffset):null
  return {path:to.path,t:hub.toT+(end-hub.toT)*f,offset,
    reverse:end<hub.toT,mode:to.mode,index:to.index,phase:'cross'}
}
// Use this for all physical transit positions, including look-ahead and
// regression tests. Reading sample.path directly would ignore hub alignment.
export function samplePosition(sample,target){
  const t=renderT(sample.t)
  const point=sample.path.getPointAt(t,target)
  if(sample.offset)point.add(sample.offset)
  return point
}
