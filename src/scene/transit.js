import { PATHS, MAIN_HUBS, PROJECT_HUBS, PROJECT_FORK_POSITION,
  projectOutboundT, detailTravelT, closestT } from './geometry.js'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

export const TRANSIT_DURATION=5000
export const TRANSIT_MID=.45
export const ease=t=>{
  const v=Math.max(0,Math.min(1,t))
  return v*v*(3-2*v)
}
const clamp=v=>Math.max(0,Math.min(1,v))
export const PROJECT_INDEX_HUB=closestT(PATHS.routes[0],PROJECT_FORK_POSITION)
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
  if(info.mode==='detail')return projectOutboundT(info.index)
  if(info.mode==='projects' && ['projects','detail'].includes(from.mode))
    return PROJECT_INDEX_HUB-.012
  if(info.mode==='home')return .025
  if(info.mode==='projects')return info.mainHub+.105
  return info.mainHub+.13
}
export function scrollT(info,{scrollY=0,total=1,junction=1,works=2,projectFork=2}={}){
  const fraction=clamp(scrollY/Math.max(1,total))
  if(info.mode==='detail')return detailTravelT(info.index,fraction)
  if(info.mode==='projects'){
    // Centre the camera precisely in the five-way atrium when its UI appears.
    const t=ease(scrollY/Math.max(1,projectFork))
    return info.mainHub+.105 + t*(PROJECT_INDEX_HUB-.012-info.mainHub-.105)
  }
  if(info.mode==='home'){
    if(scrollY<=junction)return .025+ease(scrollY/Math.max(1,junction))*(info.mainHub+.012-.025)
    if(scrollY<works)return info.mainHub+.012+ease((scrollY-junction)/Math.max(1,works-junction))*.025
    return info.mainHub+.037+ease((scrollY-works)/Math.max(1,total-works))*(.955-info.mainHub-.037)
  }
  const entry=info.mainHub+.13
  return entry+ease(fraction)*(.955-entry)
}
// All paths are from the SAME navigation graph. Never generate a separate
// connection curve from the camera: it can cross opaque existing walls.
export function sharedJunction(from,to,initialT){
  const sameProjectNetwork=['home','projects','detail']
  const nearProjects=sameProjectNetwork.includes(from.mode) &&
    sameProjectNetwork.includes(to.mode) &&
    !(from.mode==='home'&&initialT<(from.mainHub+from.projectHub)*.50)
  return nearProjects?'project':'main'
}
export function junctions(from,to,initialT){
  const type=sharedJunction(from,to,initialT)
  return {
    type,
    source:type==='project'?from.projectHub:from.mainHub,
    target:type==='project'?to.projectHub:to.mainHub
  }
}
export function sampleTransit(from,to,initialT,progress){
  const p=clamp(progress)
  const hub=junctions(from,to,initialT)
  const arrival=arrivalT(to,from)
  // First half returns to a real physical intersection on the current tunnel.
  if(p<.47){
    const t=initialT+(hub.source-initialT)*ease(p/.47)
    return {path:from.path,t,reverse:hub.source<initialT,
      mode:from.mode,index:from.index,phase:'approach'}
  }
  // The destination grows in front of us while the camera stays at the hub.
  if(p<.61){
    return {path:from.path,t:hub.source,reverse:false,
      mode:from.mode,index:from.index,phase:'construct'}
  }
  const f=ease((p-.61)/.39)
  return {path:to.path,t:hub.target+(arrival-hub.target)*f,
    reverse:arrival<hub.target,mode:to.mode,index:to.index,phase:'arrival'}
}
export function transitBuild(progress){
  const p=clamp(progress)
  if(p<=.29)return 0
  return ease((p-.29)/.48)
}
