import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CHAMBERS, CHAMBER_RADIUS, createJunctionChamber, chamberExitDirection, PATHS, PROJECT_HUBS, PROJECT_OUTBOUND_ENDS, shellSpans } from '../src/scene/geometry.js'

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
