import * as THREE from 'three'

export function decodeNetwork(buffer) {
  const header=new Uint32Array(buffer,0,4)
  if(header[0]!==0x43434E31||header[3]!==1)throw Error('Invalid tunnel network asset')
  const vertexCount=header[1],indexCount=header[2]
  if(buffer.byteLength!==16+vertexCount*24+indexCount*4)throw Error('Truncated tunnel network asset')
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,16,vertexCount*3),3))
  geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,16+vertexCount*12,vertexCount*3),3))
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,16+vertexCount*24,indexCount),1))
  geometry.computeBoundingSphere()
  return geometry
}

// Partition triangles without moving any vertex. Frustum culling can then
// discard distant galleries while all seams retain their exact coordinates.
export function partitionNetwork(geometry,size=14) {
  const positions=geometry.getAttribute('position'),buckets=new Map(),idx=geometry.index.array
  for(let i=0;i<idx.length;i+=3){
    const a=idx[i],b=idx[i+1],c=idx[i+2]
    const key=[0,1,2].map(axis=>Math.floor((positions.array[a*3+axis]+positions.array[b*3+axis]+positions.array[c*3+axis])/(3*size))).join(',')
    if(!buckets.has(key))buckets.set(key,[])
    buckets.get(key).push(a,b,c)
  }
  return [...buckets.values()].map(indices=>{
    const part=new THREE.BufferGeometry()
    for(const [key,value] of Object.entries(geometry.attributes))part.setAttribute(key,value)
    part.setIndex(indices)
    const box=new THREE.Box3(),p=new THREE.Vector3()
    for(const i of indices)box.expandByPoint(p.fromBufferAttribute(positions,i))
    part.boundingBox=box;part.boundingSphere=box.getBoundingSphere(new THREE.Sphere())
    return part
  })
}
