import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import {
  PATHS, MAIN_HUBS, PROJECT_HUBS,
  TUNNEL_RADIUS, RADIAL_SEGMENTS, createSkin, createSeam,
  PROJECT_FORK_OPEN, PROJECT_FORK_CLOSE,
  detailTravelT, detailReturning, projectOutboundT
} from '../src/scene/geometry.js'

const everyPath=[...PATHS.routes,...PATHS.details]
test('All navigable journeys have one continuous centerline', () => {
  assert.equal(PATHS.routes.length,3)
  assert.equal(PATHS.details.length,PROJECTS.length)
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

test('All project branches are open, distinct and have actual 3D walls',()=>{
  assert.equal(PATHS.children.length,PROJECTS.length)
  assert.ok(PROJECT_FORK_OPEN>.1 && PROJECT_FORK_CLOSE<1)
  for(let i=0;i<PROJECTS.length;i++){
    const arm=PATHS.children[i]
    const geometry=createSkin(arm,{
      radius:2.85,lengthSegments:90,radialSegments:40,
      start:PROJECT_FORK_OPEN,end:PROJECT_FORK_CLOSE
    })
    assert.equal(geometry.index.count,90*40*6)
    const positions=geometry.getAttribute('position')
    for(let row=0;row<=90;row+=10){
      const a=row*41,b=a+40
      const pa=new THREE.Vector3().fromBufferAttribute(positions,a)
      const pb=new THREE.Vector3().fromBufferAttribute(positions,b)
      assert.ok(pa.distanceTo(pb)<.0001,'A project branch has a hole')
    }
    geometry.dispose()
  }
  for(const t of [PROJECT_FORK_OPEN,.55,.7,.85,PROJECT_FORK_CLOSE]){
    for(let i=0;i<PROJECTS.length-1;i++){
      const a=PATHS.children[i].getPointAt(t)
      const b=PATHS.children[i+1].getPointAt(t)
      assert.ok(a.distanceTo(b)>5.7,'Two adjacent project tunnels collide at '+t)
    }
  }
})
test('Each project journey is a real forward-only loop back to the same fork',()=>{
  for(let i=0;i<PROJECTS.length;i++){
    const path=PATHS.details[i]
    const fork=path.getPointAt(projectOutboundT(i)-.014)
    const start=detailTravelT(i,0)
    assert.ok(start>projectOutboundT(i))
    let previous=start
    for(let k=1;k<=300;k++){
      const t=detailTravelT(i,k/300)
      assert.ok(t>=previous,'A project camera backtracks at scroll fraction '+k/300)
      previous=t
    }
    assert.equal(detailTravelT(i,1),1,'The project loop does not finish at the real fork')
    assert.ok(path.getPointAt(1).distanceTo(fork)<.08,
      'A project return corridor does not meet its physical departure fork')
    assert.ok(path.getPointAt(.95).distanceTo(path.getPointAt(start))>5,
      'Return corridor collapsed into the outgoing corridor')
    assert.equal(detailReturning(.4),false)
    assert.equal(detailReturning(.8),true)
  }
})

test('Each project has grounded narrative stops and working exploration links',async()=>{
  const [{PROJECT_STORIES},{PROJECTS_WITH_SLUGS:projects}]=await Promise.all([
    import('../src/data/projectStories.js'),
    import('../src/data/projects.js')
  ])
  assert.equal(PROJECT_STORIES.length,PATHS.children.length)
  assert.equal(PROJECT_STORIES.length,projects.length)
  for(let i=0;i<projects.length;i++){
    const story=PROJECT_STORIES[i]
    assert.ok(story.introduction&&story.idea&&story.experience)
    assert.ok(story.features.length>=3)
    assert.ok(projects[i].slug)
    assert.ok(!projects[i].link || projects[i].link.startsWith('https://'))
  }
})
