import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CHAMBERS, CHAMBER_RADIUS, PROJECT_TURN_ROOMS, PROJECT_TURN_RADIUS, createJunctionChamber, chamberExitDirection, PATHS, PROJECT_HUBS, PROJECT_OUTBOUND_ENDS, shellSpans } from '../src/scene/geometry.js'

test('Both physical crossroads have watertight visible vaults with all real corridor mouths open',()=>{
 assert.equal(CHAMBERS.length,2)
 for(const chamber of CHAMBERS){
  const geometry=createJunctionChamber(chamber)
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide})
  const mesh=new THREE.Mesh(geometry,material)
  assert.ok(geometry.index.count>1500,'Missing nearly all of the physical chamber walls')
  for(const exit of chamber.exits){
   const ray=new THREE.Raycaster(chamber.centre,exit,.1,CHAMBER_RADIUS+1)
   const hits=ray.intersectObject(mesh)
   assert.equal(hits.length,0,'A chamber roof or false wall blocks a real tunnel mouth')
  }
  const ceilingRay=new THREE.Raycaster(chamber.centre,new THREE.Vector3(0,1,0),.1,CHAMBER_RADIUS+1)
  // At least one direction must be enclosed by a real wall, not open space.
  let blockedDirections=0
  for(const d of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),
    new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)]){
   if(new THREE.Raycaster(chamber.centre,d,.1,CHAMBER_RADIUS+1).intersectObject(mesh).length)blockedDirections++
  }
  assert.ok(blockedDirections>=1,'No enclosed chamber surfaces remained')
  geometry.dispose()
  material.dispose()
 }
})

test('Return and outward branch paths remain distinct outside the open project chamber',()=>{
 const detailPaths=PATHS.details
 for(let i=0;i<detailPaths.length;i++){
  const path=detailPaths[i]
  const outgoingEnd=PROJECT_OUTBOUND_ENDS[i]
  assert.ok(outgoingEnd>PROJECT_HUBS[i]+.05&&outgoingEnd<.87,
   'Project does not have independent return segment')
  assert.ok(path.getPointAt(1).distanceTo(CHAMBERS[1].centre)<.1,
   'Project loop fails to reconnect to its own fork')
  const spans=shellSpans(path)
  assert.ok(spans.every(([a,b])=>a>=0&&b<=1&&a<b))
  // At the fork the wall ends BEFORE the chamber, never as an opaque cap.
  assert.ok(Math.max(...spans.map(x=>x[1]))<1,'Return tunnel closes across project fork')
 }
})


test('Public crossroads exposes no blank return holes; only active project can open its exit',()=>{
  assert.equal(CHAMBERS[1].exits.length,1+PATHS.children.length,
    'Crossroads should show exactly one shared arrival and eight outbound entrances')
  const base=createJunctionChamber(CHAMBERS[1])
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide})
  const staticRoom=new THREE.Mesh(base,material)
  const center=CHAMBERS[1].centre
  const returnDirections=PATHS.returnArms.map(path=>chamberExitDirection(path,center,true))
  for(let i=0;i<returnDirections.length;i++){
    const ray=new THREE.Raycaster(center,returnDirections[i],0,CHAMBER_RADIUS+1)
    assert.ok(ray.intersectObject(staticRoom).length>0,
      'Unvisited return tunnel creates a black hole in the crossroads: '+i)
    const selected=createJunctionChamber({...CHAMBERS[1],
      exits:[...CHAMBERS[1].exits,returnDirections[i]]})
    const opened=new THREE.Mesh(selected,material)
    assert.equal(ray.intersectObject(opened).length,0,
      'A selected project return is obstructed by an opaque wall: '+i)
    selected.dispose()
  }
  base.dispose()
  material.dispose()
})


test('Eight visible project tubes remain separated before expanding to full radius',()=>{
  const center=CHAMBERS[1].centre
  const paths=PATHS.children
  let checks=0
  for(let i=0;i<=80;i++){
    const t=i/80
    const points=paths.map(path=>path.getPointAt(t))
    const d=points[0].distanceTo(center)
    if(d<8.05||d>26)continue
    const width=2.85*(.71+.29*Math.min(1,Math.max(0,(d-8)/12))**2*
      (3-2*Math.min(1,Math.max(0,(d-8)/12))))
    for(let a=0;a<paths.length;a++)for(let b=a+1;b<paths.length;b++){
      const sep=points[a].distanceTo(points[b])
      assert.ok(sep>width*1.7,'Adjacent selected project tube walls overlap near the crossroads')
      checks++
    }
  }
  assert.ok(checks>120,'No separation samples validated')
})


test('All eight far ends are joined by a real closed turnaround room with two clear openings',()=>{
  assert.equal(PROJECT_TURN_ROOMS.length,PATHS.children.length)
  for(let i=0;i<PROJECT_TURN_ROOMS.length;i++){
    const room=PROJECT_TURN_ROOMS[i]
    assert.ok(room.centre.distanceTo(PATHS.children[i].getPointAt(1))<1e-6)
    assert.ok(room.centre.distanceTo(PATHS.returnArms[i].getPointAt(0))<1e-6)
    assert.equal(room.exits.length,2)
    const outSegments=shellSpans(PATHS.children[i])
    const returnSegments=shellSpans(PATHS.returnArms[i])
    assert.ok(Math.max(...outSegments.map(x=>x[1]))<.999,
      'Open outbound tube sticks through its rounded closed turnaround chamber: '+i)
    assert.ok(Math.min(...returnSegments.map(x=>x[0]))>.001,
      'Open return tube starts inside the rounded closed turnaround chamber: '+i)
  }
  for(const i of [0,4]){
    const room=PROJECT_TURN_ROOMS[i]
    const geometry=createJunctionChamber(room,PROJECT_TURN_RADIUS)
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide})
    const mesh=new THREE.Mesh(geometry,material)
    for(const exit of room.exits){
      const ray=new THREE.Raycaster(room.centre,exit,0,PROJECT_TURN_RADIUS+1)
      assert.equal(ray.intersectObject(mesh).length,0,
        'Actual project turn tube opening blocked by a wall: '+i)
    }
    let sealed=0
    for(let k=0;k<24;k++){
      const theta=k*Math.PI*2/24
      const dir=new THREE.Vector3(Math.cos(theta),Math.sin(theta),.4).normalize()
      sealed+=Number(new THREE.Raycaster(room.centre,dir,0,PROJECT_TURN_RADIUS+1)
        .intersectObject(mesh).length>0)
    }
    assert.ok(sealed>=16,'Far turnaround is open to black sky: '+i)
    geometry.dispose();material.dispose()
  }
})
