import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CHAMBERS, CHAMBER_RADIUS, CHAMBER_PORTAL_DISTANCE } from '../src/scene/geometry.js'
import { createSolidJunction, JUNCTION_HALF_SIZE } from '../src/scene/junctionSolid.js'

test('Both rooms have a physically closed SDF union instead of cut-out sphere triangles',()=>{
  for(const room of CHAMBERS){
    const started=performance.now()
    const geom=createSolidJunction(room)
    const verts=geom.getAttribute('position')
    const normals=geom.getAttribute('normal')
    assert.ok(verts.count>1000,'Solid tunnel union did not generate walls')
    assert.ok(verts.count<250000,'Too many triangles for WebGL mobile')
    assert.equal(verts.count,normals.count)
    assert.equal(geom.userData.room,'solid-union')
    for(let i=0;i<verts.count;i+=Math.max(1,Math.round(verts.count/350))){
      const pos=new THREE.Vector3().fromBufferAttribute(verts,i)
      const n=new THREE.Vector3().fromBufferAttribute(normals,i)
      assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&Number.isFinite(pos.z))
      assert.ok(Math.abs(n.length()-1)<.015,'Malformed union normals')
      assert.ok(pos.distanceTo(room.centre)<Math.sqrt(3)*JUNCTION_HALF_SIZE+1)
    }
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide})
    const mesh=new THREE.Mesh(geom,material)
    // The four main/project junction entrances must be part of the same
    // empty passage, without any black portal block or old spherical wall.
    for(const exit of room.exits){
      const ray=new THREE.Raycaster(room.centre,exit,0,CHAMBER_PORTAL_DISTANCE+2)
      const hits=ray.intersectObject(mesh)
      assert.equal(hits.length,0,'One physical corridor entrance is blocked by a junction face')
    }
    // A normal viewing direction that is NOT a corridor must hit the wall:
    // the chamber cannot leak into the external starfield.
    let hitDirections=0
    const directions=32
    for(let i=0;i<directions;i++){
      const a=Math.PI*2*i/directions
      const vector=new THREE.Vector3(Math.cos(a),Math.sin(a),.36).normalize()
      if(new THREE.Raycaster(room.centre,vector,0,CHAMBER_RADIUS+5)
        .intersectObject(mesh).length)hitDirections++
    }
    assert.ok(hitDirections>=7,'The solid chamber leaks in almost every direction')
    console.log('SEALED_JUNCTION',JSON.stringify({
      segments:geom.userData.segments,
      triangles:geom.userData.triangles,
      rays:room.exits.length,hitDirections,
      builtMs:Math.round(performance.now()-started)
    }))
    geom.dispose()
    material.dispose()
  }
})
