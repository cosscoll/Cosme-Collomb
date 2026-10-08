import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import {PROJECTS_WITH_SLUGS as PROJECTS} from '../src/data/projects.js'
import {PATHS,createSkin} from '../src/scene/geometry.js'
import {
 routeInfo,sampleTransit,scrollT,junctions,arrivalT,
 PROJECT_INDEX_HUB,TRANSIT_DURATION,transitBuild
} from '../src/scene/transit.js'

const names=['/','/projets','/parcours','/contact',
 ...PROJECTS.map(x=>'/projets/'+x.slug)]

test('All sections have a physical tunnel path and transit uses five seconds',()=>{
 assert.equal(TRANSIT_DURATION,5000)
 for(const name of names){
  const route=routeInfo(name)
  assert.ok(route.path.getLength()>35,name)
  assert.ok(route.mainHub>.1&&route.mainHub<1,name)
  assert.ok(route.projectHub===null||(route.projectHub>.2&&route.projectHub<=1),name)
  assert.ok(arrivalT(route,routeInfo('/'))>0&&arrivalT(route,routeInfo('/'))<1,name)
 }
})

test('The five-project intersection is reached by the normal scroll, not a jump',()=>{
 const route=routeInfo('/projets')
 const beginning=scrollT(route,{scrollY:0,total:5000,projectFork:1500})
 const crossroads=scrollT(route,{scrollY:1500,total:5000,projectFork:1500})
 assert.ok(Math.abs(beginning-(route.mainHub+.105))<.00001)
 assert.ok(Math.abs(crossroads-(PROJECT_INDEX_HUB-.012))<.00001)
 assert.ok(crossroads>beginning+.12)
})

test('Every pair of pages travels via an exact common physical 3D node',()=>{
 let cases=0
 for(const fromPath of names){
  for(const toPath of names){
   if(fromPath===toPath)continue
   const from=routeInfo(fromPath),to=routeInfo(toPath)
   const starts=[
    from.mode==='home'?.035:
    from.mode==='projects'?from.mainHub+.105:
    from.mode==='detail'?from.projectHub+.135:from.mainHub+.13,
    from.mode==='home'?Math.min(.96,from.projectHub-.055):
    from.mode==='detail'?.89:.76
   ]
   for(const start of starts){
    const hub=junctions(from,to,start)
    assert.ok(hub.source>=0&&hub.source<=1&&hub.target>=0&&hub.target<=1)
    const a=from.path.getPointAt(hub.source)
    const b=to.path.getPointAt(hub.target)
    assert.ok(a.distanceTo(b)<.35,
      'Disconnected intersection '+fromPath+' → '+toPath+': '+a.distanceTo(b))
    const startFrame=sampleTransit(from,to,start,0)
    assert.ok(Math.abs(startFrame.t-start)<1e-7)
    const finish=sampleTransit(from,to,start,1)
    assert.ok(Math.abs(finish.t-arrivalT(to,from))<1e-7)
    let previous=null
    for(let k=0;k<=400;k++){
     const p=k/400
     const sample=sampleTransit(from,to,start,p)
     const point=sample.path.getPointAt(sample.t)
     assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z))
     if(previous)assert.ok(point.distanceTo(previous)<1.5,
       'Camera teleported '+fromPath+' → '+toPath+' at '+p+': '+point.distanceTo(previous))
     previous=point
    }
    cases++
   }
  }
 }
 assert.ok(cases>120)
})

test('Destination corridor is built before the camera moves away from the junction',()=>{
 let last=0
 for(let i=0;i<=100;i++){
  const p=i/100
  const constructed=transitBuild(p)
  assert.ok(constructed>=last-1e-7)
  assert.ok(constructed>=0&&constructed<=1)
  if(p>=.61){
   const travel=(p-.61)/.39
   const eased=travel*travel*(3-2*travel)
   assert.ok(constructed+1e-6>=eased,'Camera overtakes bridge construction at '+p)
  }
  last=constructed
 }
 assert.equal(transitBuild(0),0)
 assert.equal(transitBuild(1),1)
})

test('Closed destination tunnel geometry is sampled from the same route as the camera',()=>{
 for(const project of PROJECTS){
  const route=routeInfo('/projets/'+project.slug)
  const hub=route.projectHub
  const goal=arrivalT(route,routeInfo('/projets'))
  const geometry=createSkin(route.path,{
   radius:4.17,lengthSegments:120,radialSegments:40,
   start:hub+.022,end:Math.min(.998,goal+.065)
  })
  for(let row=0;row<=120;row+=12){
   const a=row*41
   const first=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,a)
   const last=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,a+40)
   assert.ok(first.distanceTo(last)<.0001)
  }
  geometry.dispose()
 }
})

test('3D view no longer has a fabricated cross-wall Bézier teleporter or blinding spotlight',async()=>{
 const fs=await import('node:fs/promises')
 const world=await fs.readFile(new URL('../src/components/World.jsx',import.meta.url),'utf8')
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.ok(world.includes('JunctionTransit'))
 assert.ok(world.includes('routeInfo(transit?.from||pathname)'))
 assert.ok(world.includes('sampleTransit(journey.source,journey.destination'))
 assert.ok(world.includes('transitBuild(p)'))
 assert.ok(!world.includes('BridgeFlight'))
 assert.ok(!world.includes('createBridgeCurve('))
 assert.ok(!world.includes('intensity={55} distance={30}'))
 assert.ok(app.includes('const TRANSIT_MS=5000'))
 assert.ok(app.includes('id="contact-final"'))
})
