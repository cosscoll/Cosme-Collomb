import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { EDGES, PROJECT_EDGES, HUB, NETWORK_SIGNATURE, pointAt, headingAt,
  destination, initialPose, planJourney, sampleJourney, scrollDistance } from '../src/scene/spatialNetwork.js'
import { advanceMotion,advanceJourneyMotion,MAX_STEP,MAX_TURN_RATE,PAGE_MOTION } from '../src/scene/networkMotion.js'
import { decodeNetwork } from '../src/scene/networkMesh.js'

const bytes=await readFile(new URL('../src/scene/compiled/network.bin',import.meta.url))
const geometry=decodeNetwork(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))
geometry.boundsTree=new MeshBVH(geometry)
const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
mesh.raycast=acceleratedRaycast;mesh.updateMatrixWorld()
const ray=new THREE.Raycaster();ray.firstHitOnly=true
const directions=Array.from({length:32},(_,i)=>{
  const y=1-2*(i+.5)/32,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5))
  return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)
})
const paths=['/','/projets','/parcours','/contact',...PROJECTS.map(p=>'/projets/'+p.slug)]

test('compiled mesh matches the current graph and all eight projects',async()=>{
  const meta=JSON.parse(await readFile(new URL('../src/scene/compiled/network.json',import.meta.url)))
  assert.equal(meta.signature,createHash('sha256').update(NETWORK_SIGNATURE).digest('hex'))
  assert.equal(PROJECT_EDGES.length,8);assert.equal(PROJECTS.length,8)
  assert.ok(meta.triangles<200000,'Keep a bounded static GPU workload')
})

test('every mesh edge has exactly two incident triangles: no cracks or open mouths',()=>{
  const edges=new Map(),indices=geometry.index.array
  for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){
    const a=indices[i+j],b=indices[i+(j+1)%3]
    assert.notEqual(a,b,'Degenerate triangle')
    const key=a<b?a+':'+b:b+':'+a
    edges.set(key,(edges.get(key)||0)+1)
  }
  const bad=[...edges.entries()].filter(([,count])=>count!==2)
  assert.deepEqual(bad.slice(0,12),[],bad.length+' unsealed or nonmanifold edges')
})

test('all loops and every cubic join share position and forward tangent',()=>{
  for(const edge of EDGES){
    assert.ok(pointAt(edge,0).distanceTo(HUB)<1e-10)
    assert.ok(pointAt(edge,edge.length).distanceTo(HUB)<1e-10)
    for(const s of [0,edge.length])assert.ok(headingAt(edge,s).dot(new THREE.Vector3(0,0,-1))>.99999)
    const curves=edge.path.curves
    for(let i=1;i<curves.length;i++){
      assert.ok(curves[i-1].getPoint(1).distanceTo(curves[i].getPoint(0))<1e-10)
      assert.ok(curves[i-1].getTangent(1).dot(curves[i].getTangent(0))>.99999)
    }
  }
})

test('actual rendered walls enclose every route, including all joints and returns',()=>{
  let minimum=Infinity,count=0
  for(const edge of EDGES)for(let s=0;s<=edge.length;s+=.85){
    const point=pointAt(edge,s)
    for(const dir of directions){
      ray.set(point,dir);ray.near=0;ray.far=200
      const hit=ray.intersectObject(mesh)[0]
      assert.ok(hit,edge.id+' has an open view to exterior at '+s)
      minimum=Math.min(minimum,hit.distance)
      assert.ok(hit.distance>2.35,edge.id+' eye approaches wall: '+hit.distance+' at '+s)
      count++
    }
    const next=pointAt(edge,Math.min(edge.length,s+.85)),step=next.clone().sub(point)
    if(step.length()>1e-8){
      ray.set(point,step.clone().normalize());ray.far=step.length()+.06
      assert.equal(ray.intersectObject(mesh).length,0,edge.id+' crosses a wall at '+s)
    }
  }
  console.log('Actual mesh raycasts:',count,'minimum wall clearance:',minimum.toFixed(3)+'m')
})

test('all page transfers follow forward graph edges and preserve join position and orientation',()=>{
  let count=0
  for(const edge of EDGES)for(const fraction of [0,.16,.5,.9,1])for(const path of paths){
    const pose={edge,distance:edge.length*fraction},trip=planJourney(pose,path)
    let previous=pose
    for(let distance=0;distance<trip.length+.5;distance+=.35){
      const sample=sampleJourney(trip,Math.min(distance,trip.length))
      const a=previous.edge?pointAt(previous.edge,previous.distance):HUB
      const b=sample.edge?pointAt(sample.edge,sample.distance):HUB
      assert.ok(a.distanceTo(b)<.351,'Graph transfer teleported')
      if(previous.edge===sample.edge){
        const forward=sample.distance+1e-7>=previous.distance
        const crossedHub=previous.edge && previous.edge.length-previous.distance+sample.distance<.351
        assert.ok(forward||crossedHub,'Distance decreased away from the loop node')
      }
      else {
        const da=previous.edge?headingAt(previous.edge,previous.distance):new THREE.Vector3(0,0,-1)
        const db=sample.edge?headingAt(sample.edge,sample.distance):new THREE.Vector3(0,0,-1)
        assert.ok(da.dot(db)>.99,'Graph transfer reversed heading')
      }
      previous=sample
    }
    const end=sampleJourney(trip,trip.length),expected=initialPose(path)
    assert.equal(end.edge,expected.edge)
    if(end.edge?.id==='gallery'){
      assert.ok(end.distance>=expected.distance&&end.distance<=destination(path).end)
    }else assert.equal(end.distance,expected.distance)
    count++
  }
  assert.ok(count>=500)
})

test('reverse scroll never reverses the physical camera, and motion slows before bends',()=>{
  for(const edge of PROJECT_EDGES){
    const d=destination('/projets/'+edge.project.slug)
    let target=d.start
    for(const f of [.3,.7,.1,.5,1,0]){const next=scrollDistance(d,f,target);assert.ok(next>=target);target=next}
    let s=0,speed=0,frames=0,maxTurn=0
    while(s<edge.length&&frames<10000){
      const next=advanceMotion(s,edge.length,speed,1/60,edge)
      assert.ok(next.distance>=s&&next.distance-s<=MAX_STEP+1e-8)
      const turn=headingAt(edge,s).angleTo(headingAt(edge,next.distance))
      maxTurn=Math.max(maxTurn,turn)
      assert.ok(turn<.021,'Excessive turn in one frame: '+turn)
      s=next.distance;speed=next.speed;frames++
    }
    assert.ok(frames<3500,'Loop takes unreasonably long')
    assert.ok(maxTurn/(1/60)<MAX_TURN_RATE*1.4)
  }
})

test('full camera orientation stays smooth on inclined loops at low frame rates',()=>{
  const up=new THREE.Vector3(0,1,0),matrix=new THREE.Matrix4()
  const orientation=(edge,s)=>{
    const eye=pointAt(edge,s),ahead=eye.clone().add(headingAt(edge,s))
    return new THREE.Quaternion().setFromRotationMatrix(matrix.lookAt(eye,ahead,up))
  }
  // Heading alone misses the extra roll produced by the fixed world-up
  // vector on inclined galleries. Check the complete rendered orientation
  // against the same absolute bound enforced by the browser regression.
  for(const dt of [1/60,1/30,.055])for(const edge of EDGES){
    let s=0,speed=0,previous=orientation(edge,0),frames=0
    while(s<edge.length&&frames++<10000){
      const next=advanceMotion(s,edge.length,speed,dt,edge)
      const rotation=orientation(edge,next.distance)
      assert.ok(previous.angleTo(rotation)<.12,
        `${edge.id}: sudden camera rotation at ${s}m with ${dt}s frames`)
      s=next.distance;speed=next.speed;previous=rotation
    }
    assert.ok(frames<10000,'Camera failed to finish its loop')
  }
})

test('project returns remain responsive at 30 and 15 rendered frames per second',()=>{
  // Product-level timing limits catch a small fixed per-image travel cap,
  // even when the nominal cruise speed has been increased.
  for(const edge of PROJECT_EDGES)for(const [fps,seconds] of [[30,12],[15,20]]){
    let pose=initialPose('/projets/'+edge.project.slug)
    const trip=planJourney(pose,'/projets')
    let distance=0,speed=0,frames=0
    while(distance<trip.length&&frames<fps*seconds){
      const next=advanceMotion(distance,trip.length,speed,1/fps,pose.edge,pose.distance)
      distance=next.distance;speed=next.speed;pose=sampleJourney(trip,distance);frames++
    }
    assert.equal(distance,trip.length,`${edge.id} takes more than ${seconds}s at ${fps}fps`)
  }
})

test('header trips stay fast and physically continuous between every page and project',()=>{
  for(const [fps,limit] of [[60,9],[30,10],[15,16]])for(const from of paths)for(const to of paths){
    let pose=initialPose(from),trip=planJourney(pose,to),distance=0,speed=0,frames=0
    while(distance<trip.length&&frames<fps*limit){
      const previous=pose
      const next=advanceJourneyMotion(trip,distance,speed,1/fps)
      distance=next.distance;speed=next.speed;pose=sampleJourney(trip,distance);frames++
      const a=previous.edge?pointAt(previous.edge,previous.distance):HUB
      const b=pose.edge?pointAt(pose.edge,pose.distance):HUB
      const rotation=p=>p.edge?new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(pointAt(p.edge,p.distance),pointAt(p.edge,p.distance).add(headingAt(p.edge,p.distance)),new THREE.Vector3(0,1,0))
      ):new THREE.Quaternion()
      assert.ok(rotation(previous).angleTo(rotation(pose))<.12,'Header snaps camera orientation')
      const step=b.clone().sub(a)
      if(step.length()>1e-8){
        assert.ok(step.length()<=PAGE_MOTION.step+.002,'Header skips physical positions')
        const gaze=pose.edge?headingAt(pose.edge,pose.distance):new THREE.Vector3(0,0,-1)
        assert.ok(step.clone().normalize().dot(gaze)>.97,'Header moves against its gaze')
        ray.set(a,step.clone().normalize());ray.far=step.length()
        assert.equal(ray.intersectObject(mesh).length,0,'Header crosses an actual wall')
      }
    }
    assert.equal(distance,trip.length,`${from} -> ${to} exceeds ${limit}s at ${fps}fps`)
  }
})

test('header destinations already in the current gallery section do not require an extra lap',()=>{
  for(const path of ['/','/parcours','/contact']){
    const d=destination(path),pose={edge:d.edge,distance:(d.start+d.end)/2}
    const trip=planJourney(pose,path)
    assert.equal(trip.length,0)
    const end=sampleJourney(trip,0)
    assert.equal(end.edge,pose.edge);assert.equal(end.distance,pose.distance)
  }
})
