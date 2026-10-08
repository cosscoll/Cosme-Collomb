import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {createBridgeCurve,bridgeGrowth,bridgeTravel,bridgeDrawCount} from '../src/scene/bridge.js'
import {createSkin,PATHS} from '../src/scene/geometry.js'
import {routeInfo,arrivalT} from '../src/scene/transit.js'

test('A tunnel bridge starts at the existing camera and ends on the destination centreline',()=>{
  const destinations=['/','/projets','/parcours','/contact']
  for(const target of destinations){
    const route=routeInfo(target)
    const end=route.path.getPointAt(arrivalT(route,routeInfo('/')))
    const tangent=route.path.getTangentAt(arrivalT(route,routeInfo('/')))
    const start=new THREE.Vector3(-10,0,-55)
    const heading=new THREE.Vector3(0,0,-1)
    const bridge=createBridgeCurve(start,heading,end,tangent)
    assert.ok(bridge.getPointAt(0).distanceTo(start)<.0001)
    assert.ok(bridge.getPointAt(1).distanceTo(end)<.0001)
    assert.ok(bridge.getLength()>=start.distanceTo(end)*.98)
    for(let k=0;k<=100;k++){
      const p=bridge.getPointAt(k/100)
      const tan=bridge.getTangentAt(k/100)
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))
      assert.ok(tan.length()>.99 && tan.length()<1.01)
      if(k)assert.ok(p.distanceTo(bridge.getPointAt((k-1)/100))<3.7)
    }
  }
})
test('The bridge constructs sufficiently ahead of the camera before movement',()=>{
  for(let step=0;step<=100;step++){
    const p=step/100
    const growth=bridgeGrowth(p)
    const motion=bridgeTravel(p)
    assert.ok(growth>=0&&growth<=1)
    assert.ok(motion>=0&&motion<=1)
    assert.ok(growth+1e-7>=motion,'Camera should not enter an unbuilt tunnel at '+p)
    if(step>0){
      assert.ok(growth>=bridgeGrowth((step-1)/100)-1e-8)
      assert.ok(motion>=bridgeTravel((step-1)/100)-1e-8)
    }
  }
  assert.equal(bridgeTravel(0),0)
  assert.equal(bridgeTravel(1),1)
  assert.equal(bridgeGrowth(1),1)
})
test('The building bridge is a closed 360-degree tunnel with incremental draw ranges',()=>{
  const path=createBridgeCurve(
    new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),
    new THREE.Vector3(-12,4,-47),new THREE.Vector3(-.12,0,-1)
  )
  const geometry=createSkin(path,{radius:3.54,lengthSegments:80,radialSegments:40})
  const positions=geometry.getAttribute('position')
  for(let i=0;i<=80;i+=8){
    const a=i*41,b=a+40
    const x=new THREE.Vector3().fromBufferAttribute(positions,a)
    const y=new THREE.Vector3().fromBufferAttribute(positions,b)
    assert.ok(x.distanceTo(y)<.0001,'Gap in the bridge circumference')
  }
  let previous=0
  for(let i=0;i<=20;i++){
    const count=bridgeDrawCount(geometry,i/20,40)
    assert.ok(count>=previous && count<=geometry.index.count)
    assert.equal(count%(40*6),0)
    previous=count
  }
  assert.equal(bridgeDrawCount(geometry,1,40),geometry.index.count)
  geometry.dispose()
})
test('Homepage ends with a complete contact destination, not a disconnected route link',async()=>{
  const fs=await import('node:fs/promises')
  const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
  assert.ok(app.includes('id="contact-final"'))
  assert.ok(app.includes('contact-destination-actions'))
  assert.ok(app.includes('https://github.com/cosscoll'))
  assert.ok(app.includes('<Closing />'))
  assert.ok(!app.includes('className="transition-portal"'))
  assert.ok(app.includes('className="bridge-transition-hud"'))
})

test('Bridge joins both corridors with matching tangents and no visible entry wall',()=>{
  const start=new THREE.Vector3(-9,0,-61)
  const incoming=new THREE.Vector3(0.12,0,-1).normalize()
  const finish=new THREE.Vector3(3,2,-92)
  const outgoing=new THREE.Vector3(0,0,-1)
  const bridge=createBridgeCurve(start,incoming,finish,outgoing)
  assert.ok(bridge.getTangentAt(0).dot(incoming)>.999,'Bridge takes off in the camera direction')
  assert.ok(bridge.getTangentAt(1).dot(outgoing)>.999,'Bridge does not join the destination tangent')
  const geometry=createSkin(bridge,{radius:3.22,lengthSegments:100,radialSegments:44,start:.038})
  assert.equal(geometry.index.count,100*44*6)
  for(let row=0;row<=100;row+=10){
    const a=row*45
    const first=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,a)
    const last=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,a+44)
    assert.ok(first.distanceTo(last)<.0001,'Construction introduced a seam')
    const wallCenter=bridge.getPointAt(.038+row/100*.962)
    assert.ok(first.distanceTo(wallCenter)>3,'Camera might hit a bridge wall')
  }
  geometry.dispose()
})
test('Visual transition uses muted material, progressive ribs and never a blinding point light',async()=>{
  const fs=await import('node:fs/promises')
  const source=await fs.readFile(new URL('../src/components/World.jsx',import.meta.url),'utf8')
  assert.ok(source.includes('bridge.ribs.map'),'Bridge segments do not visibly assemble')
  assert.ok(source.includes('bridgeGrowth(p)'),'Progressive construction is missing')
  assert.ok(source.includes('roughness={.78}'),'Bridge material is excessively reflective')
  assert.ok(!source.includes('intensity={55} distance={30}'),'Blinding bridge spotlight returned')
  assert.ok(source.includes('p<.79?.04'),'Destination wall fades in before arrival')
})
