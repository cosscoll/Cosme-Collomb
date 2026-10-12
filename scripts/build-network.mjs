import * as THREE from 'three'
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { EDGES, ROOM, pointAt, NETWORK_SIGNATURE } from '../src/scene/spatialNetwork.js'

// Compile the UNION of tube interiors, not overlapping open tube meshes.
// All intersections and caps are part of one closed indexed surface.
// This runs during build, never while a visitor chooses a project.
const resolution=176, size=116, half=size/2, centre=new THREE.Vector3(0,0,-3)
const cell=size/resolution
const marching=new MarchingCubes(resolution,new THREE.MeshBasicMaterial(),false,false,500000)
marching.isolation=1
const field=marching.field
field.fill(-1e6)
function capsule(a,b,r) {
  const pad=r+cell*2
  const lo=a.clone().min(b).addScalar(-pad).sub(centre).addScalar(half).divideScalar(cell).floor()
  const hi=a.clone().max(b).addScalar(pad).sub(centre).addScalar(half).divideScalar(cell).ceil()
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=dx*dx+dy*dy+dz*dz
  for(let z=Math.max(1,lo.z);z<=Math.min(resolution-2,hi.z);z++)
    for(let y=Math.max(1,lo.y);y<=Math.min(resolution-2,hi.y);y++)
      for(let x=Math.max(1,lo.x);x<=Math.min(resolution-2,hi.x);x++) {
        const px=x*cell-half+centre.x-a.x,py=y*cell-half+centre.y-a.y,pz=z*cell-half+centre.z-a.z
        const t=len?Math.max(0,Math.min(1,(px*dx+py*dy+pz*dz)/len)):0
        const qx=px-t*dx,qy=py-t*dy,qz=pz-t*dz
        const value=1+r*r-qx*qx-qy*qy-qz*qz
        const i=x+y*resolution+z*resolution*resolution
        if(value>field[i])field[i]=value
      }
}
capsule(ROOM.centre,ROOM.centre,ROOM.radius)
for(const edge of EDGES) {
  const count=Math.ceil(edge.length/.35)
  let a=pointAt(edge,0)
  for(let i=1;i<=count;i++) {
    const b=pointAt(edge,i/count*edge.length)
    capsule(a,b,edge.radius);a=b
  }
}
marching.update()
if(marching.count>=1500000)throw Error('Network mesh overflow')
const raw=new THREE.BufferGeometry()
const positions=marching.positionArray.slice(0,marching.count*3)
for(let i=0;i<positions.length;i+=3){positions[i]=positions[i]*half+centre.x;positions[i+1]=positions[i+1]*half+centre.y;positions[i+2]=positions[i+2]*half+centre.z}
raw.setAttribute('position',new THREE.BufferAttribute(positions,3))
// Weld by position only. Smooth normals then share the same indices.
const geometry=mergeVertices(raw,1e-4)
const clean=[]
for(let i=0;i<geometry.index.count;i+=3){
  const a=geometry.index.getX(i),b=geometry.index.getX(i+1),c=geometry.index.getX(i+2)
  if(a!==b&&a!==c&&b!==c)clean.push(a,b,c)
}
geometry.setIndex(clean)
geometry.computeVertexNormals()
const p=geometry.getAttribute('position').array,n=geometry.getAttribute('normal').array
const indices=new Uint32Array(geometry.index.array)
const header=new Uint32Array([0x43434E31,p.length/3,indices.length,1])
const binary=Buffer.concat([Buffer.from(header.buffer),Buffer.from(p.buffer),Buffer.from(n.buffer),Buffer.from(indices.buffer)])
const output=new URL('../src/scene/compiled/',import.meta.url)
await mkdir(output,{recursive:true})
await writeFile(new URL('network.bin',output),binary)
await writeFile(new URL('network.json',output),JSON.stringify({signature:createHash('sha256').update(NETWORK_SIGNATURE).digest('hex'),vertices:p.length/3,triangles:indices.length/3,bytes:binary.length,cellSize:cell},null,2)+'\n')
console.log('Closed tunnel network:',p.length/3,'vertices,',indices.length/3,'triangles,',binary.length,'bytes')
