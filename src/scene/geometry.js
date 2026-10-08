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
  // Five corridors fan radially out of the common atrium, like flower petals.
  // Their separation makes it impossible for the opaque shells to intersect.
  const angle=-Math.PI/2 + i*Math.PI*2/PROJECTS.length
  const x=Math.cos(angle),y=Math.sin(angle)
  const radial=(r,z)=>[-9.5+x*r,y*r,z]
  return [
    [-9.5,0,-61],
    radial(2.7,-67),
    radial(6.8,-76),
    radial(8.7,-89),
    radial(9.1,-103)
  ]
})
export const PATHS = {
  routes: BRANCHES.map(points => spline([...TRUNK,...points.slice(1)])),
  details: CHILDREN.map(points => spline([...TRUNK,...BRANCHES[0].slice(1),...points.slice(1)])),
  arms: BRANCHES.map(spline),
  children: CHILDREN.map(spline)
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
export const MAIN_HUBS=PATHS.routes.map(p=>closestT(p,[0,0,-30]))
export const PROJECT_HUBS=PATHS.details.map(p=>closestT(p,[-9.5,0,-61]))
export const TUNNEL_RADIUS=4.25
export const RADIAL_SEGMENTS=64
const PI2=Math.PI*2
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n))
const BASE=[
  new THREE.Color('#b6a8bc'),
  new THREE.Color('#9daabf'),
  new THREE.Color('#c6afa4'),
  new THREE.Color('#797b9d')
]
const tempColor=new THREE.Color()

// The periodic function is identical at 0 and 2π; the shell has no gaps.
export function radiusAt(t,angle,radius=TUNNEL_RADIUS) {
  return radius*(1+.028*Math.sin(angle*3+t*6)+.012*Math.sin(angle*7-t*11))
}
export function createSkin(path,{radius=TUNNEL_RADIUS,lengthSegments=300,radialSegments=RADIAL_SEGMENTS,start=0,end=1}={}) {
  const positions=new Float32Array((lengthSegments+1)*(radialSegments+1)*3)
  const colors=new Float32Array(positions.length)
  const indices=[]
  const frames=path.computeFrenetFrames(lengthSegments,false)
  const center=new THREE.Vector3()
  for(let i=0;i<=lengthSegments;i++){
    const t=start+(end-start)*i/lengthSegments
    path.getPointAt(t,center)
    const frame=Math.round(t*lengthSegments)
    const n=frames.normals[frame],b=frames.binormals[frame]
    for(let j=0;j<=radialSegments;j++){
      const angle=PI2*j/radialSegments
      const r=radiusAt(t,angle,radius)
      const nx=n.x*Math.cos(angle)+b.x*Math.sin(angle)
      const ny=n.y*Math.cos(angle)+b.y*Math.sin(angle)
      const nz=n.z*Math.cos(angle)+b.z*Math.sin(angle)
      const k=(i*(radialSegments+1)+j)*3
      positions[k]=center.x+nx*r
      positions[k+1]=center.y+ny*r
      positions[k+2]=center.z+nz*r

      const shape=(Math.sin(angle*3+t*6)+1)*.5
      const shimmer=(Math.cos(angle*2-t*10)+1)*.5
      tempColor.copy(BASE[0]).lerp(BASE[1],clamp(shape*.75))
      tempColor.lerp(BASE[2],clamp(shimmer*.35))
      tempColor.lerp(BASE[3],clamp(Math.pow(Math.max(0,Math.sin(angle*3+t*6)),16)*.58))
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
  const frames=path.computeFrenetFrames(segments,false)
  for(let i=0;i<=segments;i++){
    const t=start+(end-start)*i/segments
    const theta=angle+t*.16*Math.sin(angle*3)
    const r=radiusAt(t,theta,radius)+.022
    const frame=Math.round(t*segments)
    const n=frames.normals[frame],b=frames.binormals[frame]
    pts.push(path.getPointAt(t).addScaledVector(n,r*Math.cos(theta)).addScaledVector(b,r*Math.sin(theta)))
  }
  return new THREE.CatmullRomCurve3(pts,false,'centripetal')
}

// The second junction belongs to the shared projects corridor.
// Its five routes are actual independent splines (not decorative labels).
export const PROJECT_FORK_POSITION = [-9.5,0,-61]
export const PROJECT_BRANCH_COLORS = [
  '#c7b5ff', '#97dce5', '#f5c5b2', '#d8c8a4', '#b0dbca'
]
// Portals and physical corridor segments begin only after the paths diverge,
// leaving the common atrium free of intersecting opaque walls.
export const PROJECT_FORK_OPEN = .5
export const PROJECT_FORK_CLOSE = .94
export function projectOutboundT(index) {
  return PROJECT_HUBS[index]+.014
}
export function detailTravelT(index,progress) {
  // Outbound while discovering the story; return on the same seamless shell.
  const hub=projectOutboundT(index)
  const destination=.965
  const p=Math.max(0,Math.min(1,progress))
  if(p<=.63) return hub+(destination-hub)*(p/.63)
  if(p<=.73) return destination
  const back=(p-.73)/.27
  return destination-(destination-hub)*(back*back*(3-2*back))
}
export function detailReturning(progress) {
  return progress>.68
}
