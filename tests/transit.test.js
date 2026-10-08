import test from 'node:test'
import assert from 'node:assert/strict'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { PATHS } from '../src/scene/geometry.js'
import {
  routeInfo, sampleTransit, scrollT, transitionAnchor, arrivalT,
  PROJECT_INDEX_HUB, TRANSIT_DURATION
} from '../src/scene/transit.js'

const names=['/','/projets','/parcours','/contact',
  ...PROJECTS.map(p=>'/projets/'+p.slug)]
test('Every page owns a valid continuous 3D flight route',()=>{
  assert.equal(TRANSIT_DURATION,2500)
  for(const name of names){
    const route=routeInfo(name)
    assert.ok(route.path.getLength()>30,name)
    assert.ok(route.mainHub>.1 && route.mainHub<.9)
    assert.ok(route.projectHub===null||(route.projectHub>.1&&route.projectHub<.97))
    assert.ok(arrivalT(route,routeInfo('/'))>=0 && arrivalT(route,routeInfo('/'))<1)
  }
})
test('Project crossroads scroll ends at the actual shared 3D hub',()=>{
  const route=routeInfo('/projets')
  const start=scrollT(route,{scrollY:0,total:5000,projectFork:1500})
  const fork=scrollT(route,{scrollY:1500,total:5000,projectFork:1500})
  assert.ok(Math.abs(start-(route.mainHub+.012))<.0001)
  assert.ok(Math.abs(fork-(PROJECT_INDEX_HUB-.012))<.0001)
  assert.ok(fork>start+.2)
})
test('Every page change travels via a junction with no 3D coordinate jump',()=>{
  for(const source of names){
    for(const destination of names){
      if(source===destination)continue
      const from=routeInfo(source),to=routeInfo(destination)
      const startT=from.mode==='detail'?.86:from.mode==='projects'?
        PROJECT_INDEX_HUB-.012:.83
      const before=sampleTransit(from,to,startT,.499999)
      const after=sampleTransit(from,to,startT,.5)
      const a=before.path.getPointAt(before.t)
      const b=after.path.getPointAt(after.t)
      assert.ok(a.distanceTo(b)<.65,
        'Crossed a wall or jumped position on '+source+' -> '+destination+
        ' (gap '+a.distanceTo(b).toFixed(3)+')')
      assert.ok(before.reverse===(transitionAnchor(from,from,to)<startT))
      assert.ok(after.t>=0 && after.t<=1)
    }
  }
})
test('The 3D transition stays on its spline from departure to arrival',()=>{
  for(const source of ['/projets','/projets/'+PROJECTS[0].slug,'/parcours']){
    const from=routeInfo(source),to=routeInfo('/projets/'+PROJECTS[3].slug)
    const initial=from.mode==='detail'?.88:.77
    let previous=null
    for(let i=0;i<=120;i++){
      const p=i/120
      const sample=sampleTransit(from,to,initial,p)
      const xyz=sample.path.getPointAt(sample.t)
      assert.ok(Number.isFinite(xyz.x)&&Number.isFinite(xyz.y)&&Number.isFinite(xyz.z))
      if(previous){
        assert.ok(xyz.distanceTo(previous)<2.5,
          'A flight step teleported from one corridor to another')
      }
      previous=xyz
    }
    const final=sampleTransit(from,to,initial,1)
    assert.ok(Math.abs(final.t-arrivalT(to,from))<.0001)
  }
})
