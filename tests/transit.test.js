import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { createSkin } from '../src/scene/geometry.js'
import {
  routeInfo, sampleTransit, junctionFor, arrivalT, scrollT,
  bridgeBuild, TRANSIT_DURATION, PROJECT_INDEX_HUB, TRANSIT_MID
} from '../src/scene/transit.js'

const names=['/','/projets','/parcours','/contact',
 ...PROJECTS.map(p=>'/projets/'+p.slug)]
test('Every page has an actual 3D spline and a long enough assembled transit',()=>{
 assert.equal(TRANSIT_DURATION,4200)
 assert.equal(TRANSIT_MID,.52)
 for(const name of names){
  const route=routeInfo(name)
  assert.ok(route.path.getLength()>30,name)
  assert.ok(route.mainHub>.1&&route.mainHub<.92)
  assert.ok(route.projectHub===null||(route.projectHub>.2&&route.projectHub<=1))
  assert.ok(arrivalT(route,routeInfo('/'))>0)
 }
})
test('Arrival camera position agrees with scroll starting position on projects',()=>{
 for(const name of names){
  const to=routeInfo(name)
  const from=routeInfo('/projets')
  if(to.mode==='detail'){
    const t=scrollT(to,{scrollY:0,total:4400})
    assert.ok(Math.abs(t-arrivalT(to,from))<.00001,name)
    assert.ok(t-to.projectHub>.095,'No actual branch distance for bridge')
  }
 }
 const projects=routeInfo('/projets')
 const t=scrollT(projects,{scrollY:0,total:4200,projectFork:1200})
 assert.ok(Math.abs(t-arrivalT(projects,routeInfo('/')))<.00001)
})
test('Project crossroads still reached continuously by scrolling',()=>{
 const route=routeInfo('/projets')
 const start=scrollT(route,{scrollY:0,total:4200,projectFork:1600})
 const hub=scrollT(route,{scrollY:1600,total:4200,projectFork:1600})
 assert.ok(Math.abs(hub-PROJECT_INDEX_HUB)<.022)
 assert.ok(hub>start+.10)
})
test('No teleportation at either real tunnel intersection for every navigation pair',()=>{
 let checked=0
 for(const f of names){
  for(const t of names){
   if(f===t)continue
   const from=routeInfo(f),to=routeInfo(t)
   for(const initialT of [f==='/'?.045:f==='/projets'?PROJECT_INDEX_HUB-.012:.81,.93]){
    const junction=junctionFor(from,to,initialT)
    const xyzA=from.path.getPointAt(junction.fromT)
    const xyzB=to.path.getPointAt(junction.toT)
    assert.ok(xyzA.distanceTo(xyzB)<.7, f+' → '+t+' not physically connected')
    let last
    for(let i=0;i<=250;i++){
     const sample=sampleTransit(from,to,initialT,i/250)
     const pos=sample.path.getPointAt(Math.min(.999,Math.max(.001,sample.t)))
     assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&Number.isFinite(pos.z))
     if(last)assert.ok(last.distanceTo(pos)<2,f+' → '+t+' camera jumped at '+i/250)
     last=pos
    }
    const end=sampleTransit(from,to,initialT,1)
    assert.ok(Math.abs(end.t-arrivalT(to,from))<1e-6)
    checked++
   }
  }
 }
 assert.ok(checked>=140)
})
test('Destination shell is built before the camera enters it',()=>{
 let last=0
 for(let step=0;step<=100;step++){
  const p=step/100
  const build=bridgeBuild(p)
  assert.ok(build>=last-1e-7 && build>=0 && build<=1)
  if(p>=TRANSIT_MID){
   const travel=(p-TRANSIT_MID)/(1-TRANSIT_MID)
   const ease=Math.min(1,travel)**2*(3-2*Math.min(1,travel))
   assert.ok(build+1e-6>=ease,'Camera would overtake construction at '+p)
  }
  last=build
 }
 assert.equal(bridgeBuild(1),1)
})
test('Assembled tunnel meshes have closed circular walls and stable indices',()=>{
 for(const project of PROJECTS){
  const from=routeInfo('/projets')
  const to=routeInfo('/projets/'+project.slug)
  const fromT=to.projectHub+.022
  const destT=Math.min(.998,arrivalT(to,from)+.075)
  const geom=createSkin(to.path,{start:fromT,end:destT,
    radius:4.18,lengthSegments:120,radialSegments:48})
  assert.equal(geom.index.count,120*48*6)
  for(let row=0;row<=120;row+=12){
   const a=new THREE.Vector3().fromBufferAttribute(geom.attributes.position,row*49)
   const b=new THREE.Vector3().fromBufferAttribute(geom.attributes.position,row*49+48)
   assert.ok(a.distanceTo(b)<.00001)
  }
  geom.dispose()
 }
})
test('No full-screen white portal survives and 3D construction is rendered',async()=>{
 const fs=await import('node:fs/promises')
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 const world=await fs.readFile(new URL('../src/components/World.jsx',import.meta.url),'utf8')
 assert.ok(app.includes('bridge-wayfinding'))
 assert.ok(!app.includes('className="transition-portal"'))
 assert.ok(world.includes('assembling-3d-tunnel'))
 assert.ok(world.includes('BuildingBranch'))
 assert.ok(world.includes('bridgeBuild(p)'))
 assert.ok(world.includes('meshStandardMaterial'))
})
