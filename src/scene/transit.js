import { PATHS, MAIN_HUBS, PROJECT_HUBS, PROJECT_FORK_POSITION,
  projectOutboundT, detailTravelT, closestT } from './geometry.js'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

export const TRANSIT_DURATION=2500
export const TRANSIT_MID=.5
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
  if(info.mode==='home')return .035
  return info.mainHub+.018
}
export function scrollT(info,{scrollY=0,total=1,junction=1,works=2,projectFork=2}={}){
  const fraction=clamp(scrollY/Math.max(1,total))
  if(info.mode==='detail')return detailTravelT(info.index,fraction)
  if(info.mode==='projects'){
    // Centre the camera precisely in the five-way atrium when its UI appears.
    const t=ease(scrollY/Math.max(1,projectFork))
    return info.mainHub+.012 + t*(PROJECT_INDEX_HUB-.012-info.mainHub-.012)
  }
  if(info.mode==='home'){
    if(scrollY<=junction)return .025+ease(scrollY/Math.max(1,junction))*(info.mainHub+.012-.025)
    if(scrollY<works)return info.mainHub+.012+ease((scrollY-junction)/Math.max(1,works-junction))*.025
    return info.mainHub+.037+ease((scrollY-works)/Math.max(1,total-works))*(.955-info.mainHub-.037)
  }
  return info.mainHub+.008+ease(fraction)*(.955-info.mainHub-.008)
}
export function sampleTransit(from,to,initialT,progress){
  const p=clamp(progress)
  // A project selected from the lower home page is already past the first fork.
  // Use the nearby projects junction, instead of racing backwards through the
  // entire entrance and forwards again.
  const nearProjects=from.mode==='home' && to.mode==='detail' &&
    initialT>(from.mainHub+PROJECT_INDEX_HUB)*.5
  const fromHub=nearProjects?from.projectHub:transitionAnchor(from,from,to)
  const toHub=nearProjects?to.projectHub:transitionAnchor(to,from,to)
  if(p<TRANSIT_MID){
    const f=ease(p/TRANSIT_MID)
    const t=initialT+(fromHub-initialT)*f
    return {path:from.path,t,reverse:fromHub<initialT,mode:from.mode,index:from.index}
  }
  const f=ease((p-TRANSIT_MID)/(1-TRANSIT_MID))
  const end=arrivalT(to,from)
  return {
    path:to.path,t:toHub+(end-toHub)*f,
    reverse:end<toHub,mode:to.mode,index:to.index
  }
}
