import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {
  PATHS, MAIN_HUBS, PROJECT_HUBS,
  TUNNEL_RADIUS, RADIAL_SEGMENTS, createSkin, createSeam
} from '../src/scene/geometry.js'

const everyPath=[...PATHS.routes,...PATHS.details]
test('All navigable journeys have one continuous centerline', () => {
  assert.equal(PATHS.routes.length,3)
  assert.equal(PATHS.details.length,5)
  for(const path of everyPath){
    const a=path.getPointAt(0),b=path.getPointAt(1)
    assert.ok(a.distanceTo(b)>30)
    for(let i=0;i<=100;i++){
      const point=path.getPointAt(i/100)
      const tangent=path.getTangentAt(i/100)
      assert.ok(point.lengthSq()>=0 && Number.isFinite(point.x))
      assert.ok(Math.abs(tangent.length()-1)<.002)
      if(i) assert.ok(point.distanceTo(path.getPointAt((i-1)/100))<3)
    }
  }
})
test('Each tunnel has a closed 360-degree circumference without surface cracks',()=>{
  for(const path of everyPath){
    const longitudinal=180
    const geometry=createSkin(path,{lengthSegments:longitudinal})
    const positions=geometry.getAttribute('position')
    const normals=geometry.getAttribute('normal')
    const colors=geometry.getAttribute('color')
    assert.equal(positions.count,(longitudinal+1)*(RADIAL_SEGMENTS+1))
    assert.equal(geometry.index.count,longitudinal*RADIAL_SEGMENTS*6)
    for(let step=0;step<=longitudinal;step+=15){
      const a=step*(RADIAL_SEGMENTS+1)
      const b=a+RADIAL_SEGMENTS
      const first=new THREE.Vector3().fromBufferAttribute(positions,a)
      const last=new THREE.Vector3().fromBufferAttribute(positions,b)
      assert.ok(first.distanceTo(last)<.0001,'A circumference seam is open')
      const center=path.getPointAt(step/longitudinal)
      for(let j=0;j<=RADIAL_SEGMENTS;j+=8){
        const point=new THREE.Vector3().fromBufferAttribute(positions,a+j)
        const radius=point.distanceTo(center)
        assert.ok(radius>TUNNEL_RADIUS*.95 && radius<TUNNEL_RADIUS*1.05,
          'Wall deviates from the safe constant tunnel radius')
        const normal=new THREE.Vector3().fromBufferAttribute(normals,a+j)
        assert.ok(Number.isFinite(normal.x)&&Number.isFinite(normal.y)&&Number.isFinite(normal.z))
      }
      const c=new THREE.Color().fromBufferAttribute(colors,a)
      assert.ok(Number.isFinite(c.r)&&Number.isFinite(c.g)&&Number.isFinite(c.b))
    }
    geometry.dispose()
  }
})
test('Navigation hubs and decorative seams are based on the flight paths',()=>{
  for(let i=0;i<MAIN_HUBS.length;i++){
    assert.ok(MAIN_HUBS[i]>.1 && MAIN_HUBS[i]<.9)
    assert.ok(PATHS.routes[i].getPointAt(MAIN_HUBS[i]).distanceTo(
      new THREE.Vector3(0,0,-30))<1.1)
  }
  for(let i=0;i<PROJECT_HUBS.length;i++){
    assert.ok(PROJECT_HUBS[i]>.2 && PROJECT_HUBS[i]<.96)
    assert.ok(PATHS.details[i].getPointAt(PROJECT_HUBS[i]).distanceTo(
      new THREE.Vector3(-9.5,0,-61))<1.2)
  }
  const seam=createSeam(PATHS.routes[0],.3)
  for(const t of [0,1]){
    const distance=seam.getPointAt(t).distanceTo(PATHS.routes[0].getPointAt(t))
    assert.ok(distance>3.9 && distance<4.6)
  }
})
