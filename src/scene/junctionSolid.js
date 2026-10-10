import * as THREE from 'three'
import { PATHS, TUNNEL_RADIUS, CHAMBER_RADIUS, CHAMBERS } from './geometry.js'

// Union of the REAL corridor volumes and the circular crossroads room.
// The former cut-out sphere could create a huge black disk or a hole because
// its triangle deletion was only an approximate portal, not a continuous wall.
//
// The zero isosurface of min(distance-to-room-radius,
//                           distance-to-physical-tube-radius)
// has no detached doorway and no blind holes: every genuine opening is
// connected to a complete corridor.
export const JUNCTION_HALF_SIZE=17.7
export const JUNCTION_GRID_STEP=.92
const TUBE_RADIUS=TUNNEL_RADIUS+.10
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x))
const tetras=[
  [0,5,1,6],[0,1,2,6],[0,2,3,6],
  [0,3,7,6],[0,7,4,6],[0,4,5,6]
]
const corners=[
  [0,0,0],[1,0,0],[1,1,0],[0,1,0],
  [0,0,1],[1,0,1],[1,1,1],[0,1,1]
]
const squaredDistance=(a,b)=>
  (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2

function segmentsForRoom(chamber){
  const isProjects=chamber===CHAMBERS[1]
  const pieces=isProjects?
    [PATHS.arms[0],...PATHS.children,...PATHS.returnArms]:
    [PATHS.trunk,...PATHS.arms]
  const segments=[]
  for(const path of pieces){
    const count=Math.max(72,Math.round(path.getLength()/.55))
    let last=path.getPointAt(0)
    for(let i=1;i<=count;i++){
      const p=path.getPointAt(i/count)
      if(Math.min(squaredDistance(last,chamber.centre),
        squaredDistance(p,chamber.centre))<26*26){
        const dx=p.x-last.x,dy=p.y-last.y,dz=p.z-last.z
        const d2=dx*dx+dy*dy+dz*dz
        if(d2>1e-7)segments.push({
          x:last.x-chamber.centre.x,
          y:last.y-chamber.centre.y,
          z:last.z-chamber.centre.z,
          dx,dy,dz,inv:1/d2
        })
      }
      last=p
    }
  }
  return segments
}

export function createSolidJunction(chamber,{step=JUNCTION_GRID_STEP}={}){
  const segments=segmentsForRoom(chamber)
  const n=Math.ceil(2*JUNCTION_HALF_SIZE/step)
  const pitch=2*JUNCTION_HALF_SIZE/n
  const stride=n+1
  const plane=stride*stride
  const field=new Float32Array(stride*plane)
  const normals=new Float32Array(field.length*3)
  const coord=i=>-JUNCTION_HALF_SIZE+i*pitch
  const fieldIndex=(x,y,z)=>x+y*stride+z*plane
  for(let z=0;z<=n;z++){
    const pz=coord(z)
    for(let y=0;y<=n;y++){
      const py=coord(y)
      for(let x=0;x<=n;x++){
        const px=coord(x)
        let value=Math.sqrt(px*px+py*py+pz*pz)-CHAMBER_RADIUS
        // The nearest squared distance to each physical spline segment is
        // measured in local-room coordinates, without allocating vectors.
        if(value>-TUBE_RADIUS){
          let smallest=Infinity
          for(const seg of segments){
            const vx=px-seg.x,vy=py-seg.y,vz=pz-seg.z
            const fraction=clamp((vx*seg.dx+vy*seg.dy+vz*seg.dz)*seg.inv,0,1)
            const ox=vx-seg.dx*fraction
            const oy=vy-seg.dy*fraction
            const oz=vz-seg.dz*fraction
            const distance2=ox*ox+oy*oy+oz*oz
            if(distance2<smallest)smallest=distance2
            if(smallest<.002)break
          }
          value=Math.min(value,Math.sqrt(smallest)-TUBE_RADIUS)
        }
        field[fieldIndex(x,y,z)]=value
      }
    }
  }

  // Normals directly from the signed-distance-field gradient. They remain
  // smooth through the sphere/tube union and orient triangles consistently.
  for(let z=0;z<=n;z++)for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){
    const index=fieldIndex(x,y,z)
    const derivative=(axis)=>{
      const da=axis===0,db=axis===1,dc=axis===2
      const before=fieldIndex(Math.max(0,x-(da?1:0)),
        Math.max(0,y-(db?1:0)),Math.max(0,z-(dc?1:0)))
      const after=fieldIndex(Math.min(n,x+(da?1:0)),
        Math.min(n,y+(db?1:0)),Math.min(n,z+(dc?1:0)))
      return field[after]-field[before]
    }
    const a=derivative(0),b=derivative(1),c=derivative(2)
    const len=Math.hypot(a,b,c)||1
    normals[index*3]=a/len
    normals[index*3+1]=b/len
    normals[index*3+2]=c/len
  }
  const vertices=[],vertexNormals=[]
  function interpolate(a,b){
    const fa=field[a.index],fb=field[b.index]
    const t=clamp(fa/(fa-fb),0,1)
    const nx=normals[a.index*3]*(1-t)+normals[b.index*3]*t
    const ny=normals[a.index*3+1]*(1-t)+normals[b.index*3+1]*t
    const nz=normals[a.index*3+2]*(1-t)+normals[b.index*3+2]*t
    const m=Math.hypot(nx,ny,nz)||1
    return {
      x:a.x+(b.x-a.x)*t+chamber.centre.x,
      y:a.y+(b.y-a.y)*t+chamber.centre.y,
      z:a.z+(b.z-a.z)*t+chamber.centre.z,
      nx:nx/m,ny:ny/m,nz:nz/m
    }
  }
  function append(a,b,c){
    const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z
    const acx=c.x-a.x,acy=c.y-a.y,acz=c.z-a.z
    const crossX=aby*acz-abz*acy
    const crossY=abz*acx-abx*acz
    const crossZ=abx*acy-aby*acx
    const dot=crossX*(a.nx+b.nx+c.nx)+crossY*(a.ny+b.ny+c.ny)+crossZ*(a.nz+b.nz+c.nz)
    if(dot<0)[b,c]=[c,b]
    for(const p of [a,b,c]){
      vertices.push(p.x,p.y,p.z)
      vertexNormals.push(p.nx,p.ny,p.nz)
    }
  }
  const cube=new Array(8)
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    let negative=0,positive=0
    for(let k=0;k<8;k++){
      const [dx,dy,dz]=corners[k]
      const xi=x+dx,yi=y+dy,zi=z+dz
      const index=fieldIndex(xi,yi,zi)
      const sample={index,x:coord(xi),y:coord(yi),z:coord(zi)}
      cube[k]=sample
      if(field[index]<0)negative++
      else positive++
    }
    if(!negative||!positive)continue
    for(const tetra of tetras){
      const inside=[],outside=[]
      for(const key of tetra){
        const vertex=cube[key]
        if(field[vertex.index]<0)inside.push(vertex)
        else outside.push(vertex)
      }
      if(!inside.length||!outside.length)continue
      if(inside.length===1||inside.length===3){
        const one=(inside.length===1?inside:outside)[0]
        const others=inside.length===1?outside:inside
        append(interpolate(one,others[0]),
          interpolate(one,others[1]),interpolate(one,others[2]))
      }else{
        const [a,b]=inside,[c,d]=outside
        const ac=interpolate(a,c),ad=interpolate(a,d)
        const bc=interpolate(b,c),bd=interpolate(b,d)
        append(ac,ad,bc)
        append(ad,bd,bc)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(vertexNormals,3))
  geometry.computeBoundingSphere()
  geometry.userData={room:'solid-union',segments:segments.length,triangles:vertices.length/9}
  return geometry
}
