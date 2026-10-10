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
export const CHILDREN = PROJECTS.map((_,i) => {
  // Project corridors fan radially out of the common atrium, like flower petals.
  // Their separation makes it impossible for the opaque shells to intersect.
  const angle=-Math.PI/2 + i*Math.PI*2/PROJECTS.length
  const x=Math.cos(angle),y=Math.sin(angle)
  const radial=(r,z)=>[-9.5+x*r,y*r,z]
  return [
    [-9.5,0,-61],
    radial(8,-69),
    radial(14,-80),
    radial(18,-94),
    radial(19,-110)
  ]
})
// A route is a chain of SHARED physical pieces. Previously each complete
// route was its own Catmull-Rom: the common trunk had different tangents and
// walls depending on the destination, so switching routes made them pop.
// Each project has a genuinely separate return corridor. The visitor does
// not turn 180 degrees and drive backward through the outbound mesh.
// Return approaches the shared fork from above and outside the outgoing arm.
export const RETURNS = PROJECTS.map((_,i)=>{
  const angle=-Math.PI/2 + i*Math.PI*2/PROJECTS.length
  const x=Math.cos(angle),y=Math.sin(angle)
  const radial=(r,z)=>[-9.5+x*r,y*r,z]
  return [
    radial(19,-110),radial(28,-113),radial(30,-99),
    radial(27,-78),radial(18,-54),
    [-9.5,0,-61]
  ]
})
const trunk=spline(TRUNK)
const arms=BRANCHES.map(spline)
const children=CHILDREN.map(spline)
const returnArms=RETURNS.map(spline)
const chain=(...sections)=>{
  const route=new THREE.CurvePath()
  sections.forEach(section=>route.add(section))
  return route
}
export const PATHS = {
  trunk,
  routes: arms.map(arm=>chain(trunk,arm)),
  details: children.map((child,i)=>chain(trunk,arms[0],child,returnArms[i])),
  arms,
  children,
  returnArms
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
export function shellSpans(path,{start=0,end=1,clearance=8.05}={}){
  let spans=[[start,end]]
  for(const coord of [[0,0,-30],[-9.5,0,-61]]){
    const hub=closestT(path,coord)
    if(path.getPointAt(hub).distanceTo(V(coord))>1.2)continue
    const pad=Math.min(.12,clearance/Math.max(1,path.getLength()))
    const next=[]
    for(const [a,b] of spans){
      if(hub+pad<=a||hub-pad>=b){next.push([a,b]);continue}
      if(hub-pad-a>.0001)next.push([a,Math.min(b,hub-pad)])
      if(b-hub-pad>.0001)next.push([Math.max(a,hub+pad),b])
    }
    spans=next
  }
  // The return leg ends at the same open fork. Do not render a terminal
  // circular wall across the end of the loop at its connection to the atrium.
  if(PATHS.details.includes(path)){
    const tail=Math.min(.12,clearance/Math.max(1,path.getLength()))
    spans=spans.map(([a,b])=>[a,Math.min(b,1-tail)])
  }
  return spans.filter(([a,b])=>b-a>.0001)
}
export const MAIN_HUBS=PATHS.routes.map(p=>closestT(p,[0,0,-30]))
// getPointAt is arc-length based. A closed project loop passes the fork
// TWICE; the closest-point search could select its return endpoint (t=1)
// rather than the outgoing entrance. The exact shared-section length is stable.
export const PROJECT_HUBS=PATHS.details.map(path=>
  (trunk.getLength()+arms[0].getLength())/path.getLength())
export const PROJECT_RETURN_HUBS=PATHS.details.map(()=>1)
export const PROJECT_OUTBOUND_ENDS=PATHS.details.map(path=>
  (trunk.getLength()+arms[0].getLength()+children[PATHS.details.indexOf(path)].getLength())/path.getLength())
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
export function createSkin(path,{radius=TUNNEL_RADIUS,radiusProfile=null,lengthSegments=300,radialSegments=RADIAL_SEGMENTS,start=0,end=1}={}) {
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
      const r=radiusAt(phase,angle,radius*(radiusProfile?radiusProfile(t,center):1))
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

// The second junction belongs to the shared projects corridor.
// Its project routes are actual independent splines (not decorative labels).
export const PROJECT_FORK_POSITION = [-9.5,0,-61]
// Fixed shared view target: all project gateways are surveyed from the exact
// same place and orientation before entering a project and after returning.
export const PROJECT_FORK_FOCUS = PATHS.children.reduce(
  (sum,path)=>sum.add(path.getPointAt(.45)),new THREE.Vector3()
).multiplyScalar(1/PATHS.children.length)
export const PROJECT_BRANCH_COLORS = [
  '#c7b5ff', '#97dce5', '#f5c5b2', '#d8c8a4', '#b0dbca',
  '#dcb6f2', '#f0c5d8', '#a9c1f5'
]
// Portals and physical corridor segments begin only after the paths diverge,
// leaving the common atrium free of intersecting opaque walls.
export const PROJECT_FORK_OPEN = .5
export const PROJECT_FORK_CLOSE = .94
export function projectOutboundT(index) {
  return PROJECT_HUBS[index]+.014
}
export function detailTravelT(index,progress) {
  // Forward-only from the project entrance along the *entire closed loop*.
  const entrance=PROJECT_HUBS[index]+.105
  const p=Math.max(0,Math.min(1,progress))
  return entrance+(1-entrance)*(p*p*(3-2*p))
}
export function detailReturning(progress) {
  // Return corridor is a separate piece, not a reverse traversal.
  return progress>.68
}


// A shared physical atrium replaces the old empty circular gap cut around a
// junction. Its rounded walls have genuine openings in the direction of
// every adjoining tunnel (including the distinct project return tunnels).
// The static mesh is built once and reused; no texture or WebGL shader tricks.
export const CHAMBER_RADIUS=9.55
// Radius where a round tube of the same radius intersects the sphere.
// Calculate the true opening from the physical crossing of the spline,
// instead of guessing path percentages (which misaligned doors by metres).
export const CHAMBER_PORTAL_DISTANCE=Math.sqrt(
  CHAMBER_RADIUS*CHAMBER_RADIUS-TUNNEL_RADIUS*TUNNEL_RADIUS)
// A portal is slightly narrower than the backed tube. This intentional
// overlap seals every edge instead of letting the starfield peek through.
export const CHAMBER_HOLE_DOT=Math.sqrt(
  1-(TUNNEL_RADIUS/CHAMBER_RADIUS)**2)+.013
export function chamberExitDirection(path,centre,atEnd=false){
  const low=atEnd?.57:0, high=atEnd?1:.43
  let closest=Infinity, best=null
  for(let i=0;i<=300;i++){
    const t=low+(high-low)*i/300
    const point=path.getPointAt(t)
    const error=Math.abs(point.distanceTo(centre)-CHAMBER_PORTAL_DISTANCE)
    if(error<closest){
      closest=error
      best=point.sub(centre)
    }
  }
  return best.normalize()
}
const MAIN_CENTRE=V([0,0,-30])
const PROJECT_CENTRE=V(PROJECT_FORK_POSITION)
export const CHAMBERS=[
  {
    centre:MAIN_CENTRE,
    exits:[
      chamberExitDirection(trunk,MAIN_CENTRE,true),
      ...arms.map(path=>chamberExitDirection(path,MAIN_CENTRE))
    ]
  },
  {
    centre:PROJECT_CENTRE,
    exits:[
      chamberExitDirection(arms[0],PROJECT_CENTRE,true),
      ...children.map(path=>chamberExitDirection(path,PROJECT_CENTRE))
    ],
    // The small branch openings are deliberately narrower than the
    // original 4.25m trunk, and never cut away the entire sphere wall.
    radii:[TUNNEL_RADIUS,...children.map(()=>2.02)]
  }
]
// Clip each sphere triangle against the EXACT geometric plane of every
// tunnel mouth. Deleting entire triangles by their centroid left jagged
// polygon teeth and apparent gaps when viewed from inside the crossroads.
// Shared edge intersections are cached, giving adjacent triangles precisely
// the same boundary vertices: no pinholes, no disconnected surfaces.
export function createJunctionChamber(chamber,radius=CHAMBER_RADIUS){
  const sphere=new THREE.SphereGeometry(radius,160,104)
  const src=sphere.getAttribute('position')
  const original=sphere.getIndex()
  const positions=[]
  const normals=[]
  for(let i=0;i<src.count;i++){
    const x=src.getX(i),y=src.getY(i),z=src.getZ(i)
    const len=Math.hypot(x,y,z)||1
    positions.push(x+chamber.centre.x,y+chamber.centre.y,z+chamber.centre.z)
    normals.push(x/len,y/len,z/len)
  }
  const openings=chamber.exits.map((exit,i)=>({
    exit,
    threshold:Math.sqrt(1-((chamber.radii?.[i]??TUNNEL_RADIUS)/radius)**2)+.013,
    id:i
  }))
  const edgeCache=new Map()
  const dot=(id,v)=>normals[id*3]*v.x+
    normals[id*3+1]*v.y+normals[id*3+2]*v.z
  function cutVertex(a,b,op){
    const key=op.id+':'+Math.min(a,b)+':'+Math.max(a,b)
    const hit=edgeCache.get(key)
    if(hit!==undefined)return hit
    const da=dot(a,op.exit),db=dot(b,op.exit)
    // Binary search along a NORMALISED chord on the spherical surface,
    // ensuring the clipped edge lies on the true physical aperture.
    let lo=0,hi=1
    for(let k=0;k<11;k++){
      const t=(lo+hi)*.5
      let x=normals[a*3]*(1-t)+normals[b*3]*t
      let y=normals[a*3+1]*(1-t)+normals[b*3+1]*t
      let z=normals[a*3+2]*(1-t)+normals[b*3+2]*t
      const len=Math.hypot(x,y,z)||1
      const within=(x*op.exit.x+y*op.exit.y+z*op.exit.z)/len<=op.threshold
      if(within===(da<=op.threshold))lo=t
      else hi=t
    }
    const t=(lo+hi)*.5
    let nx=normals[a*3]*(1-t)+normals[b*3]*t
    let ny=normals[a*3+1]*(1-t)+normals[b*3+1]*t
    let nz=normals[a*3+2]*(1-t)+normals[b*3+2]*t
    const len=Math.hypot(nx,ny,nz)||1
    nx/=len;ny/=len;nz/=len
    const id=positions.length/3
    positions.push(chamber.centre.x+radius*nx,
      chamber.centre.y+radius*ny,
      chamber.centre.z+radius*nz)
    normals.push(nx,ny,nz)
    edgeCache.set(key,id)
    return id
  }
  const indices=[]
  for(let i=0;i<original.count;i+=3){
    let polygon=[original.getX(i),original.getX(i+1),original.getX(i+2)]
    for(const op of openings){
      if(polygon.length<3)break
      const points=polygon.map(index=>({index,within:dot(index,op.exit)<=op.threshold}))
      if(points.every(p=>p.within))continue
      if(points.every(p=>!p.within)){polygon=[];break}
      const clipped=[]
      for(let j=0;j<points.length;j++){
        const previous=points[(j+points.length-1)%points.length]
        const current=points[j]
        if(previous.within!==current.within){
          clipped.push(cutVertex(previous.index,current.index,op))
        }
        if(current.within)clipped.push(current.index)
      }
      polygon=clipped
    }
    if(polygon.length>=3){
      for(let j=1;j+1<polygon.length;j++){
        const a=polygon[0],b=polygon[j],c=polygon[j+1]
        if(a!==b&&b!==c&&a!==c)indices.push(a,b,c)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  sphere.dispose()
  return geometry
}
