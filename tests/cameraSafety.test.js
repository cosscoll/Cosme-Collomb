import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PATHS } from '../src/scene/geometry.js'
import { corridorFov, corridorHeading, safeEyeOffset } from '../src/scene/cameraSafety.js'

test('Portrait, landscape and tablet projection stay centred and within safe FOV',()=>{
  const aspects=[390/844,375/812,768/1024,844/390,1024/768,1440/900,2560/1080]
  let before=0
  for(const aspect of aspects){
    const fov=corridorFov(aspect)
    assert.ok(fov>=39 && fov<=45, 'Unsafe vertical FOV on aspect '+aspect+': '+fov)
    assert.ok(corridorFov(aspect,1.9)>fov)
    assert.ok(Number.isFinite(fov))
    if(aspect>1.2 && aspect<1.8)assert.equal(fov,45)
    before=fov
  }
  assert.ok(before>0)
  assert.ok(corridorFov(390/844)<corridorFov(1440/900))
})

test('Camera offset stays safely inside narrowest project tunnel on all devices',()=>{
  for(const aspect of [.4,.6,.8,1,1.65,2.2]){
    for(const x of [-2,-1,0,1,2])for(const y of [-2,0,2]){
      const {horizontal,vertical}=safeEyeOffset(aspect,x,y,100)
      assert.ok(Math.hypot(horizontal,vertical)<.2,'Eye moved too close to a wall')
      if(aspect<.8)assert.equal(horizontal,0,'Touch layout should have no mouse parallax')
    }
  }
})

test('Projected view follows actual 3D walls, including both ends and return direction',()=>{
  const paths=[...PATHS.routes,...PATHS.details,...PATHS.children]
  const heading=new THREE.Vector3()
  for(const path of paths){
    for(const t of [0,.002,.025,.12,.3,.5,.7,.88,.965,.998,1]){
      const forward=corridorHeading(path,t,false,heading)
      assert.ok(Number.isFinite(forward.x)&&Number.isFinite(forward.y)&&Number.isFinite(forward.z))
      assert.ok(Math.abs(forward.length()-1)<.00001)
      const tangent=path.getTangentAt(t)
      assert.ok(forward.dot(tangent)>.45, 'Forward camera aims through a sharp bend at '+t)
      const backward=corridorHeading(path,t,true,new THREE.Vector3())
      assert.ok(backward.dot(tangent)<-.45, 'Return camera aims ahead instead of backwards at '+t)
    }
  }
})
