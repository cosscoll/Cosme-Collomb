import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

// The graph is also the input to the watertight mesh compiler. No route or
// React component is allowed to add, remove, offset or reverse a wall.
export const NETWORK_VERSION = 'continuous-network-1'
export const HUB = new THREE.Vector3(0, 0, 6)
export const ROOM = { centre: new THREE.Vector3(0, 0, -4), radius: 14 }
export const TUBE_RADIUS = 2.8
export const COLORS = ['#2358ff','#3b69ff','#4973ef','#3157d2','#527ce8','#244bc6','#6687e6','#3e64df']
const v = a => new THREE.Vector3(...a)
export const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x))

function route(id, controls, radius=TUBE_RADIUS) {
  const path = new THREE.CurvePath()
  for (const points of controls) {
    const curve = new THREE.CubicBezierCurve3(...points.map(v))
    curve.arcLengthDivisions = 320
    path.add(curve)
  }
  return { id, path, radius, length:path.getLength(), controls }
}

export const PROJECT_EDGES = PROJECTS.map((project, index) => {
  // No petal is vertical: the horizon stays well-defined even in its turn.
  const angle = Math.PI/8 + index*2*Math.PI/PROJECTS.length
  const radial = (r,z) => [Math.cos(angle)*r, Math.sin(angle)*r, z]
  const sections = [
    [radial(0,6), radial(0,-3), radial(8,-10), radial(10,-18)],
    [radial(10,-18), radial(12,-26), radial(15,-30), radial(15,-38)],
    [radial(15,-38), radial(15,-51), radial(31,-51), radial(31,-38)],
    [radial(31,-38), radial(31,-20), radial(31,0), radial(31,14)],
    [radial(31,14), radial(31,36), radial(0,48), radial(0,30)],
    [radial(0,30), radial(0,22), radial(0,14), radial(0,6)]
  ]
  return { ...route('project-'+index,sections), index, project, angle }
})

// A ninth, lateral gallery connects the ordinary pages. It shares the same
// forward-facing hub; returning to Accueil never reverses the entrance tube.
export const GALLERY = route('gallery', [
  [[0,0,6],[0,0,0],[18,0,-3],[24,0,6]],
  [[24,0,6],[30,0,15],[30,0,24],[24,0,30]],
  [[24,0,30],[18,0,36],[0,0,42],[0,0,30]],
  [[0,0,30],[0,0,22],[0,0,14],[0,0,6]]
],3.6)
export const EDGES = [...PROJECT_EDGES, GALLERY]
export const GRAPH = { nodes:[{id:'hub',position:HUB}], edges:EDGES.map(edge=>({id:edge.id,from:'hub',to:'hub',edge})) }

export function pointAt(edge, distance, target=new THREE.Vector3()) {
  return edge.path.getPointAt(clamp(distance/edge.length), target)
}
export function headingAt(edge, distance, target=new THREE.Vector3()) {
  return edge.path.getTangentAt(clamp(distance/edge.length), target).normalize()
}
const orientationEye=new THREE.Vector3(),orientationAhead=new THREE.Vector3()
const orientationUp=new THREE.Vector3(0,1,0),orientationMatrix=new THREE.Matrix4()
export function orientationAt(edge,distance,target=new THREE.Quaternion()) {
  pointAt(edge,distance,orientationEye)
  headingAt(edge,distance,orientationAhead).add(orientationEye)
  return target.setFromRotationMatrix(orientationMatrix.lookAt(orientationEye,orientationAhead,orientationUp))
}
export function curvatureAt(edge, distance) {
  const a=headingAt(edge,Math.max(0,distance-.3))
  const b=headingAt(edge,Math.min(edge.length,distance+.3))
  return a.angleTo(b)/.6
}
export function frameAt(edge,distance) {
  const centre=pointAt(edge,distance)
  const forward=headingAt(edge,distance)
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize()
  const up=new THREE.Vector3().crossVectors(right,forward).normalize()
  return {centre,forward,right,up}
}
export function destination(pathname='/') {
  const index=PROJECTS.findIndex(p=>pathname==='/projets/'+p.slug)
  if(index>=0) return {mode:'detail',index,edge:PROJECT_EDGES[index],start:32,end:PROJECT_EDGES[index].length,pathname}
  if(pathname==='/projets') return {mode:'projects',index:-1,edge:null,start:0,end:0,pathname}
  if(pathname==='/parcours'||pathname==='/experience') return {mode:'experience',index:-1,edge:GALLERY,start:GALLERY.length*.24,end:GALLERY.length*.52,pathname}
  if(pathname==='/contact') return {mode:'contact',index:-1,edge:GALLERY,start:GALLERY.length*.58,end:GALLERY.length*.75,pathname}
  return {mode:'home',index:-1,edge:GALLERY,start:GALLERY.length-24,end:GALLERY.length,pathname:'/' }
}

export function initialPose(pathname) {
  const d=destination(pathname)
  return {edge:d.edge,distance:d.start}
}

// Directed graph traversal. Every leg increases in metres. Edges meet at
// exactly HUB with exactly (0,0,-1), including the final frame of a trip.
export function planJourney(pose, pathname) {
  const d=destination(pathname), legs=[]
  // A gallery page occupies a section, not a single entrance coordinate.
  // If the eye is already in that section, there is no reason to make a
  // complete extra circuit just to return to its entrance.
  if(pose.edge===GALLERY&&d.edge===GALLERY&&pose.distance>=d.start&&pose.distance<=d.end){
    return {legs,length:0,destination:{...d,start:pose.distance}}
  }
  const add=(edge,start,end)=>{if(end-start>1e-7)legs.push({edge,start,end,length:end-start})}
  if(pose.edge===d.edge && d.edge && d.start>=pose.distance) {
    add(d.edge,pose.distance,d.start)
  } else {
    if(pose.edge) add(pose.edge,pose.distance,pose.edge.length)
    if(d.edge) add(d.edge,0,d.start)
  }
  return {legs,length:legs.reduce((sum,leg)=>sum+leg.length,0),destination:d}
}
export function sampleJourney(journey, distance) {
  let left=clamp(distance,0,journey.length)
  for(const leg of journey.legs) {
    if(left<leg.length-1e-8)return {edge:leg.edge,distance:leg.start+left}
    left-=leg.length
  }
  return {edge:journey.destination.edge,distance:journey.destination.start}
}

// The high-water mark belongs to a visit, not a scroll direction. Reading
// an earlier paragraph leaves the eye still; it never sends it backwards.
export function scrollDistance(d, fraction, highWater=0) {
  return Math.max(highWater,d.start+(d.end-d.start)*clamp(fraction))
}

export const NETWORK_SIGNATURE = JSON.stringify({version:NETWORK_VERSION,room:{centre:ROOM.centre.toArray(),radius:ROOM.radius},edges:EDGES.map(e=>({id:e.id,radius:e.radius,controls:e.controls}))})
