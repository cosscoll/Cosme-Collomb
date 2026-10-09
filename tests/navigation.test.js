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
test('All project routes have clear breadcrumbs and a return to the project fork',()=>{
  assert.equal(PROJECTS.length,8)
  for(const project of PROJECTS){
    const path=projectHref(project)
    const context=navigationContext(path)
    assert.equal(context.back.to,'/projets')
    assert.equal(context.back.label,'Retour aux projets')
    assert.deepEqual(context.trail.map(p=>p.to),['/','/projets',path])
    assert.equal(context.current,project.title)
  }
})

test('The three added projects have unique 3D paths and grounded links',()=>{
  for(const title of ['IAgile — Formations à l’IA','TCG Deseur — Jeu de collection','UnCoupDePouce'])
    assert.ok(PROJECTS.some(p=>p.title===title),title+' is missing')
  assert.equal(new Set(PROJECTS.map(p=>p.slug)).size,PROJECTS.length)
  assert.equal(PROJECTS.find(p=>p.title.startsWith('IAgile')).repoLink,'https://github.com/cosscoll/IAgile')
  assert.equal(PROJECTS.find(p=>p.title.startsWith('TCG Deseur')).repoLink,'https://github.com/cosscoll/TCG-Thomas-Deseur')
  assert.equal(PROJECTS.find(p=>p.title==='UnCoupDePouce').link,'')
  assert.equal(PROJECTS.find(p=>p.title==='UnCoupDePouce').repoLink,'')
})
