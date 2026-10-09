import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { createSkin, shellSpans, PATHS, PROJECT_FORK_FOCUS, PROJECT_FORK_POSITION } from '../src/scene/geometry.js'
import {
  routeInfo, sampleTransit, transitPoint, junctionFor, arrivalT, scrollT,
  bridgeBuild, TRANSIT_DURATION, PROJECT_INDEX_HUB, PROJECT_LOOKOUT_T, TRANSIT_MID
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
 assert.ok(Math.abs(hub-PROJECT_LOOKOUT_T)<.00001)
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

test('Returning from every finished project lands at the same open crossroads',()=>{
 const fork=routeInfo('/projets')
 for(const project of PROJECTS){
  const path='/projets/'+project.slug
  const from=routeInfo(path)
  const arrived=sampleTransit(from,fork,Math.min(.965,from.projectHub+.105),1)
  const expected=scrollT(fork,{scrollY:1600,total:5500,projectFork:1600})
  assert.equal(arrived.path,fork.path)
  assert.ok(Math.abs(arrived.t-expected)<1e-9,'Camera snaps after '+project.title)
  assert.ok(arrived.t<PROJECT_INDEX_HUB-.045,
    'Camera is parked against the terminal wall instead of viewing all project forks')
  // A full project must return to the very same point as a fresh project visit.
  assert.ok(fork.path.getPointAt(arrived.t).distanceTo(
    fork.path.getPointAt(expected))<1e-7)
 }
})

test('All project paths remain accessible when a project visit is complete',async()=>{
 const fs=await import('node:fs/promises')
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 const world=await fs.readFile(new URL('../src/components/World.jsx',import.meta.url),'utf8')
 assert.ok(app.includes('Revenir maintenant au carrefour des projets'))
 assert.ok(app.includes('finishRef.current?.()'))
 assert.ok(app.includes('flight.t>=.985'))
 assert.ok(!app.includes('PROJECTS.filter(project=>project.slug!==p.slug)'))
 assert.ok(app.includes('state={{fromJourney:true}}'))
 assert.ok(world.includes("fork.offsetTop"))
 assert.ok(!world.includes("projectFork.offsetTop+projectFork.offsetHeight*.35"))
 assert.ok(world.includes("incoming.mode==='projects'&&PATHS.children.map"))
 assert.ok(world.includes('Heading is derived from actual movement'))
 assert.ok(world.includes('bridgeMaterial.current.opacity=visibility'))
 assert.ok(world.includes('arrival?'))
})

test('All physical tunnel mouths face the same stable fork camera viewpoint',()=>{
 assert.equal(PATHS.children.length,PROJECTS.length)
 assert.ok(PROJECT_FORK_FOCUS.z<PROJECT_FORK_POSITION[2]-10)
 assert.ok(Math.abs(PROJECT_FORK_FOCUS.x-PROJECT_FORK_POSITION[0])<.01)
 assert.ok(Math.abs(PROJECT_FORK_FOCUS.y-PROJECT_FORK_POSITION[1])<.01)
 const mouths=PATHS.children.map(route=>route.getPointAt(.45))
 for(let i=0;i<mouths.length;i++)for(let j=i+1;j<mouths.length;j++){
  assert.ok(mouths[i].distanceTo(mouths[j])>4.2,
   'Physical project gates overlap and obscure one another: '+i+' / '+j)
 }
})
test('Finishing a project cannot display an duplicate return junction',async()=>{
 const fs=await import('node:fs/promises')
 const app=await fs.readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.ok(app.includes('finishRef.current?.()'))
 assert.ok(app.includes('flight.t>=.985'))
 assert.ok(app.includes("beginTrip('/projets')"))
 assert.ok(!app.includes('className="return-choices"'))
 assert.ok(app.includes('document.documentElement.scrollHeight-window.innerHeight'))
})


test('Every pair joins in continuous real 3D without an invisible camera translation',()=>{
  let routesChecked=0
  for(const a of names)for(const b of names){
    if(a===b)continue
    const from=routeInfo(a),to=routeInfo(b)
    for(const initialT of [.025,.37,.87,.965]){
      const before=transitPoint(sampleTransit(from,to,initialT,TRANSIT_MID-1e-8))
      const after=transitPoint(sampleTransit(from,to,initialT,TRANSIT_MID))
      const gap=before.distanceTo(after)
      assert.ok(gap<.003,a+' → '+b+': '+gap.toFixed(4)+'m jump at real tunnel join')
      const end=transitPoint(sampleTransit(from,to,initialT,1))
      const arrival=to.path.getPointAt(arrivalT(to,from))
      assert.ok(end.distanceTo(arrival)<.01,
        a+' → '+b+': finishing camera does not match destination')
      let previous=after
      for(let frame=1;frame<=100;frame++){
        const sample=sampleTransit(from,to,initialT,TRANSIT_MID+(.48*frame/100))
        const current=transitPoint(sample)
        assert.ok(current.distanceTo(previous)<2,
          a+' → '+b+': lost physical path continuity at '+frame)
        previous=current
      }
      routesChecked++
    }
  }
  assert.ok(routesChecked>=280)
})
test('All destinations match their own reset-scroll camera pose at flight completion',()=>{
  const fromRoutes=names.map(name=>routeInfo(name))
  for(const from of fromRoutes)for(const targetName of names){
    if(targetName===from.pathName)continue
    const to=routeInfo(targetName)
    const end=arrivalT(to,from)
    let targetScroll
    if(to.mode==='projects' && (from.mode==='projects'||from.mode==='detail')){
      targetScroll=scrollT(to,{scrollY:1200,total:4800,projectFork:1200})
    }else{
      targetScroll=scrollT(to,{scrollY:0,total:4800,projectFork:1200})
    }
    assert.ok(Math.abs(end-targetScroll)<1e-6,
      from.pathName+' → '+targetName+': a hard camera jump at React route completion')
  }
})

test('The central tunnel is the exact same physical piece on every route',()=>{
  const routes=[...PATHS.routes,...PATHS.details]
  const trunk=PATHS.routes[0]
  for(const route of routes){
    for(const distance of [8,17,27,36]){
      const a=trunk.getPointAt(distance/trunk.getLength())
      const b=route.getPointAt(distance/route.getLength())
      assert.ok(a.distanceTo(b)<.35,
        'Different walls on shared trunk at '+distance+'m')
    }
  }
  // Every project reuses precisely the same physical path from the first
  // junction to the five-way crossing, regardless of the chosen project.
  for(let i=0;i<PATHS.details.length;i++){
    const a=PATHS.routes[0],b=PATHS.details[i]
    for(const distance of [42,50,59]){
      assert.ok(a.getPointAt(distance/a.getLength())
        .distanceTo(b.getPointAt(distance/b.getLength()))<.35,
        'Project '+i+' changed the common corridor at '+distance+'m')
    }
  }
})
test('No opaque side wall is rendered across either navigable junction',()=>{
  for(const path of [...PATHS.routes,...PATHS.details]){
    const spans=shellSpans(path)
    assert.ok(spans.length>=2)
    for(const coord of [[0,0,-30],[-9.5,0,-61]]){
      const target=new THREE.Vector3(...coord)
      let bestT=0,bestDistance=Infinity
      for(let i=0;i<=500;i++){
        const time=i/500
        const distance=path.getPointAt(time).distanceTo(target)
        if(distance<bestDistance){bestDistance=distance;bestT=time}
      }
      if(bestDistance>1.2)continue
      assert.ok(spans.every(([start,end])=>bestT<start||bestT>end),
        'An opaque wall still closes an actual crossing')
    }
  }
})
test('Destination tunnel stays rendered for the complete camera crossing',async()=>{
  const fs=await import('node:fs/promises')
  const world=await fs.readFile(new URL('../src/components/World.jsx',import.meta.url),'utf8')
  assert.ok(world.includes('(arrival?p>=.52:p<.52)'),
    'Permanent destination walls must not disappear between 52% and 90%')
  assert.ok(world.includes('shellSpans(path)'),
    'Physical crossing apertures missing')
})

test('Camera keeps moving during tunnel assembly instead of freezing near the fork',()=>{
  const from=routeInfo('/projets')
  const to=routeInfo('/projets/'+PROJECTS[0].slug)
  const initial=PROJECT_LOOKOUT_T
  const positions=[.35,.39,.43,.47,.50].map(p=>
    transitPoint(sampleTransit(from,to,initial,p)))
  for(let i=1;i<positions.length;i++)
    assert.ok(positions[i].distanceTo(positions[i-1])>.0001,
      'Camera paused during visible bridge construction at '+i)
  const before=transitPoint(sampleTransit(from,to,initial,TRANSIT_MID-1e-8))
  const after=transitPoint(sampleTransit(from,to,initial,TRANSIT_MID))
  assert.ok(before.distanceTo(after)<.002,'Camera jumped when crossing the new tunnel')
})

test('Joining exactly at the end of a route never clamps the camera short of the shared fork',()=>{
  const source=routeInfo('/projets')
  const destination=routeInfo('/projets/'+PROJECTS[0].slug)
  const hub=junctionFor(source,destination,PROJECT_LOOKOUT_T)
  assert.ok(hub.fromT>.998)
  const atHub=transitPoint(sampleTransit(source,destination,PROJECT_LOOKOUT_T,TRANSIT_MID))
  assert.ok(atHub.distanceTo(source.path.getPointAt(hub.fromT))<.0001)
})

test('All eight project tours advance around a separate return corridor without U-turns',()=>{
  for(const project of PROJECTS){
    const info=routeInfo('/projets/'+project.slug)
    let previous=-1
    for(let i=0;i<=240;i++){
      const t=scrollT(info,{scrollY:i,total:240})
      assert.ok(t>=previous-1e-9,'Reversal on '+project.title+' at '+i)
      previous=t
    }
    assert.ok(info.path.getPointAt(1).distanceTo(new THREE.Vector3(-9.5,0,-61))<.05)
    const junction=junctionFor(info,routeInfo('/projets'),.985)
    assert.equal(junction.fromT,1,'Return must complete forward loop before leaving it')
    const a=info.path.getPointAt(.70),b=info.path.getPointAt(.88)
    assert.ok(a.distanceTo(b)>10,'Return corridor is not physically separate')
  }
})

test('Every completed project reaches the automatic-return camera threshold',()=>{
  const automaticReturnThreshold=.985
  for(const project of PROJECTS){
    const info=routeInfo('/projets/'+project.slug)
    const finalPosition=scrollT(info,{scrollY:6000,total:6000})
    assert.ok(finalPosition>=automaticReturnThreshold,
      project.title+': automatic return cannot trigger at the end of the loop')
  }
})
