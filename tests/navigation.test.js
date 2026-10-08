import test from 'node:test'
import assert from 'node:assert/strict'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { NAV_ITEMS, navigationContext, projectHref } from '../src/navigation/siteNavigation.js'

test('Header offers a direct, unique home link and all three sections',()=>{
  assert.deepEqual(NAV_ITEMS.map(i=>i.to),['/','/projets','/parcours','/contact'])
  assert.equal(new Set(NAV_ITEMS.map(i=>i.to)).size,4)
  assert.equal(navigationContext('/').back,null)
  assert.equal(navigationContext('/').trail.at(-1).label,'Accueil')
})
test('Every secondary page has an explicit safe way back to the home page',()=>{
  for(const path of ['/projets','/parcours','/experience','/contact']){
    const context=navigationContext(path)
    assert.equal(context.back.to,'/')
    assert.equal(context.trail[0].to,'/')
    assert.equal(context.trail.at(-1).to,path)
  }
})
test('All five project routes have clear breadcrumbs and a return to the project fork',()=>{
  assert.equal(PROJECTS.length,5)
  for(const project of PROJECTS){
    const path=projectHref(project)
    const context=navigationContext(path)
    assert.equal(context.back.to,'/projets')
    assert.equal(context.back.label,'Retour aux projets')
    assert.deepEqual(context.trail.map(p=>p.to),['/','/projets',path])
    assert.equal(context.current,project.title)
  }
})
