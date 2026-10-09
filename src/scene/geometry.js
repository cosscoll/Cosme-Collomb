import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

// Every camera flight and every visible wall use the exact same centreline.
const V = (a) => new THREE.Vector3(...a)
const spline = (points) => new THREE.CatmullRomCurve3(points.map(V), false, 'catmullrom', .48)
export const TRUNK = [
  [0,0,11],[0,0,6],[-.35,.25,-2],[-.55,-.1,-11],[.6,0,-21],[0,0,-30]
]
export const BRANCHES = [
  [[0,0,-30],[-1.1,0,-36],[-3.9,.45,-43],[-7.1,.1,-51],[-9.5,0,-61]],
  [[0,0,-30],[0,.25,-37],[.45,2.2,-44],[.7,3.5,-54],[.85,4,-63]],
  [[0,0,-30],[1.1,-.2,-36],[3.5,-.6,-44],[7,-.4,-53],[9.2,-.2,-63]]
]
export const PROJECT_FORK_POSITION = [-9.5,0,-61]
const MAIN_FORK_POSITION=[0,0,-30]
const HOME_POSITION=[0,0,11]
const petal=(angle,r,z)=>[-9.5+Math.cos(angle)*r, Math.sin(angle)*r,z]

// Every project is a FORWARD loop: depart from the same physical carrefour,
// travel outwards, round the far bend, come back on a separate lane and
// enter the hub from BEHIND, still looking towards the other project gates.
// The old design followed the outbound spline backwards over the final 27%.
export const CHILDREN = PROJECTS.map((_,i)=>{
  const angle=-Math.PI/2 + i*2*Math.PI/PROJECTS.length
  return [
    PROJECT_FORK_POSITION,
    petal(angle,8,-71),petal(angle,16,-88),
    petal(angle,24,-107),petal(angle,32,-122),
    petal(angle,41,-126),petal(angle,49,-119),
    petal(angle,51,-107),petal(angle,47,-94),
    petal(angle,40,-80),petal(angle,32,-65),
    petal(angle,22,-52),petal(angle,12,-47),
    petal(angle,5,-51),PROJECT_FORK_POSITION
  ]
})
// Dedicated return lanes for the three major routes, with tangent continuity
// at the junction. Their final heading at the main hub is forward (-Z).
const PROJECT_RETURN=[
  PROJECT_FORK_POSITION,[-13,0,-69],[-31,5,-76],[-47,11,-62],
  [-47,13,-40],[-32,12,-20],[-16,7,-11],[-3,2,-17],MAIN_FORK_POSITION
]
const EXPERIENCE_RETURN=[
  BRANCHES[1].at(-1),[-4,11,-70],[-16,19,-60],[-25,22,-40],
  [-17,12,-21],[-5,4,-17],MAIN_FORK_POSITION
]
const CONTACT_RETURN=[
  BRANCHES[2].at(-1),[22,-7,-70],[36,-11,-56],[34,-10,-34],
  [19,-7,-17],[4,-2,-16],MAIN_FORK_POSITION
]
// All pages also have a forward route back to the first scene (home).
// Arriving at "home" no longer sends the camera backwards up the trunk.
const MAIN_RETURN=[
  MAIN_FORK_POSITION,[0,0,-41],[18,-2,-48],[36,-4,-34],
  [39,-5,-12],[28,-3,15],[13,-1,25],[0,0,20],HOME_POSITION
]
const trunk=spline(TRUNK)
const arms=BRANCHES.map(spline)
const children=CHILDREN.map(spline)
const outboundReturns=[PROJECT_RETURN,EXPERIENCE_RETURN,CONTACT_RETURN].map(spline)
const homeReturn=spline(MAIN_RETURN)
const chain=(...sections)=>{
  const route=new THREE.CurvePath()
  sections.forEach(section=>route.add(section))
  route.arcLengthDivisions=1600
  route.updateArcLengths()
  return route
}
export const PATHS={
  routes:arms.map((arm,i)=>chain(trunk,arm,outboundReturns[i],homeReturn)),
  details:children.map(child=>chain(trunk,arms[0],child,outboundReturns[0],homeReturn)),
  arms,children
}

// First and second visits to the junction must be distinguished.
// The *second* occurrence is the end of a real loop, not a reversal.
export function closestTAfter(path,coord,minT){
  const target=V(coord),point=new THREE.Vector3()
  let best=minT,dist=Infinity
  for(let i=Math.ceil(minT*1600);i<=1600;i++){
    const t=i/1600
    path.getPointAt(t,point)
    const d=point.distanceToSquared(target)
    if(d<dist){dist=d;best=t}
  }
  return best
}
export function closestT(path, coord) {
  const p=V(coord), q=new THREE.Vector3()
  let nearest=0, shortest=Infinity
  for(let i=0;i<=500;i++) {
    const t=i/500
    path.getPointAt(t,q)
    const squared=p.distanceToSquared(q)
    if(squared<shortest){shortest=squared;nearest=t}
  }
  return nearest
}
// Physical crossroads are open chambers, not the opaque sidewalls of a
// straight tube. Remove ONLY the short wall pieces centred on each actual
// junction; retain the approach and exits along the exact same curve.
export function shellSpans(path,{start=0,end=1,clearance=6.8}={}){
  // A spatial aperture at EACH crossing, even when the route meets the same
  // hub twice. This prevents overlapping opaque walls on the return lane.
  const samples=450
  const openings=[]
  for(const coord of [MAIN_FORK_POSITION,PROJECT_FORK_POSITION,HOME_POSITION]){
    const target=V(coord)
    let a=null
    for(let i=0;i<=samples;i++){
      const t=i/samples
      if(path.getPointAt(t).distanceTo(target)<clearance){
        if(a===null)a=t
      }else if(a!==null){
        openings.push([Math.max(0,a-.005),Math.min(1,(i-1)/samples+.005)])
        a=null
      }
    }
    if(a!==null)openings.push([Math.max(0,a-.005),1])
  }
  openings.sort((a,b)=>a[0]-b[0])
  const spans=[]
  let cursor=start
  for(const [a,b] of openings){
    if(a>cursor+.001)spans.push([cursor,Math.min(end,a)])
    cursor=Math.max(cursor,b)
    if(cursor>=end)break
  }
  if(cursor<end-.001)spans.push([cursor,end])
  return spans.filter(([a,b])=>b-a>.001)
}
// A complete loop crosses the SAME point more than once. Choosing the
// globally nearest sample can accidentally select the RETURN junction as the
// initial junction, producing a hidden 180° reversal. Resolve chronologically.
export function crossingTimes(path,coord,radius=2.2){
  const target=V(coord),v=new THREE.Vector3()
  const visits=[]
  let inside=false,bestT=0,bestDistance=Infinity
  for(let i=0;i<=2400;i++){
    const t=i/2400
    path.getPointAt(t,v)
    const distance=v.distanceTo(target)
    if(distance<=radius){
      if(!inside){inside=true;bestT=t;bestDistance=Infinity}
      if(distance<bestDistance){bestDistance=distance;bestT=t}
    }else if(inside){
      visits.push(bestT)
      inside=false
    }
  }
  if(inside)visits.push(bestT)
  return visits
}
const crossing=(path,coord,index)=>{
  const visits=crossingTimes(path,coord)
  if(visits.length<=index)
    throw new Error('Missing physical hub crossing '+index+' at '+coord)
  return visits[index]
}
export const MAIN_HUBS=PATHS.routes.map(p=>crossing(p,MAIN_FORK_POSITION,0))
export const PROJECT_HUBS=PATHS.details.map(p=>crossing(p,PROJECT_FORK_POSITION,0))
export const PROJECT_RETURN_HUBS=PATHS.details.map(p=>crossing(p,PROJECT_FORK_POSITION,1))
export const MAIN_RETURN_HUBS=PATHS.routes.map(p=>crossing(p,MAIN_FORK_POSITION,1))
export const DETAIL_MAIN_RETURN_HUBS=PATHS.details.map(p=>crossing(p,MAIN_FORK_POSITION,1))
export const TUNNEL_RADIUS=4.25
export const RADIAL_SEGMENTS=64
const PI2=Math.PI*2
const WORLD_UP=new THREE.Vector3(0,1,0)
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n))
// All shared segments use the same WORLD-SPACE cross-section and colour.
// Frenet frames integrated across independent complete routes previously
// twisted shared tunnel walls differently when their destination changed.
const phaseAt=center=>(11-center.z)/140
function frameAt(path,t,normal,binormal){
  const tangent=path.getTangentAt(t)
  normal.crossVectors(tangent,WORLD_UP)
  if(normal.lengthSq()<.00001)normal.set(1,0,0)
  normal.normalize()
  binormal.crossVectors(tangent,normal).normalize()
}
const BASE=[
  new THREE.Color('#b6a8bc'),
  new THREE.Color('#9daabf'),
  new THREE.Color('#c6afa4'),
  new THREE.Color('#797b9d')
]
const tempColor=new THREE.Color()

// The periodic function is identical at 0 and 2π; the shell has no gaps.
export function radiusAt(phase,angle,radius=TUNNEL_RADIUS) {
  return radius*(1+.028*Math.sin(angle*3+phase*6)+.012*Math.sin(angle*7-phase*11))
}
export function createSkin(path,{radius=TUNNEL_RADIUS,lengthSegments=300,radialSegments=RADIAL_SEGMENTS,start=0,end=1}={}) {
  const positions=new Float32Array((lengthSegments+1)*(radialSegments+1)*3)
  const colors=new Float32Array(positions.length)
  const indices=[]
  const center=new THREE.Vector3(),n=new THREE.Vector3(),b=new THREE.Vector3()
  for(let i=0;i<=lengthSegments;i++){
    const t=start+(end-start)*i/lengthSegments
    path.getPointAt(t,center)
    frameAt(path,t,n,b)
    const phase=phaseAt(center)
    for(let j=0;j<=radialSegments;j++){
      const angle=PI2*j/radialSegments
      const r=radiusAt(phase,angle,radius)
      const nx=n.x*Math.cos(angle)+b.x*Math.sin(angle)
      const ny=n.y*Math.cos(angle)+b.y*Math.sin(angle)
      const nz=n.z*Math.cos(angle)+b.z*Math.sin(angle)
      const k=(i*(radialSegments+1)+j)*3
      positions[k]=center.x+nx*r
      positions[k+1]=center.y+ny*r
      positions[k+2]=center.z+nz*r

      const shape=(Math.sin(angle*3+phase*6)+1)*.5
      const shimmer=(Math.cos(angle*2-phase*10)+1)*.5
      tempColor.copy(BASE[0]).lerp(BASE[1],clamp(shape*.75))
      tempColor.lerp(BASE[2],clamp(shimmer*.35))
      tempColor.lerp(BASE[3],clamp(Math.pow(Math.max(0,Math.sin(angle*3+phase*6)),16)*.58))
      colors[k]=tempColor.r
      colors[k+1]=tempColor.g
      colors[k+2]=tempColor.b
      if(i<lengthSegments&&j<radialSegments){
        const v=i*(radialSegments+1)+j
        indices.push(v,v+1,v+radialSegments+1,v+1,v+radialSegments+2,v+radialSegments+1)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  // Match the duplicated seam normals exactly (j=0 and j=radialSegments).
  const normals=geometry.getAttribute('normal')
  for(let i=0;i<=lengthSegments;i++){
    const a=i*(radialSegments+1),b=a+radialSegments
    const normal=new THREE.Vector3().fromBufferAttribute(normals,a)
      .add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize()
    normals.setXYZ(a,normal.x,normal.y,normal.z)
    normals.setXYZ(b,normal.x,normal.y,normal.z)
  }
  normals.needsUpdate=true
  geometry.computeBoundingSphere()
  return geometry
}
export function createSeam(path, angle,{radius=TUNNEL_RADIUS,segments=140,start=0,end=1}={}) {
  const pts=[]
  const n=new THREE.Vector3(),b=new THREE.Vector3()
  for(let i=0;i<=segments;i++){
    const t=start+(end-start)*i/segments
    const center=path.getPointAt(t)
    const phase=phaseAt(center)
    const theta=angle+phase*.16*Math.sin(angle*3)
    const r=radiusAt(phase,theta,radius)+.022
    frameAt(path,t,n,b)
    pts.push(center.addScaledVector(n,r*Math.cos(theta)).addScaledVector(b,r*Math.sin(theta)))
  }
  return new THREE.CatmullRomCurve3(pts,false,'centripetal')
}

// Each of the eight real project corridors forms a one-way loop.
// Fixed shared view target: all project gateways are surveyed from the exact
// same place and orientation before entering a project and after returning.
export const PROJECT_FORK_FOCUS = PATHS.children.reduce(
  (sum,path)=>sum.add(path.getPointAt(.13)),new THREE.Vector3()
).multiplyScalar(1/PATHS.children.length)
export const PROJECT_BRANCH_COLORS = [
  '#c7b5ff', '#97dce5', '#f5c5b2', '#d8c8a4', '#b0dbca',
  '#dcb6f2', '#f0c5d8', '#a9c1f5'
]
// Portals and physical corridor segments begin only after the paths diverge,
// leaving the common atrium free of intersecting opaque walls.
export const PROJECT_FORK_OPEN = .12
export const PROJECT_FORK_CLOSE = .90
export function projectOutboundT(index){
  return PROJECT_HUBS[index]+.028
}
export function detailTravelT(index,progress){
  // Strictly increasing progress along the entire loop. No inverted tangent,
  // camera half-turn, or retracing the outbound corridor.
  const entrance=projectOutboundT(index)
  const exit=PROJECT_RETURN_HUBS[index]
  return entrance+(exit-entrance)*Math.max(0,Math.min(1,progress))
}
export function detailReturning(progress){
  return progress>.65
}
