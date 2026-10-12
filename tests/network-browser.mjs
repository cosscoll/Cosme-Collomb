import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { HUB, EDGES, NETWORK_VERSION } from '../src/scene/spatialNetwork.js'
import { decodeNetwork } from '../src/scene/networkMesh.js'
import { browserOptions } from './browser-options.mjs'

const site=process.env.PUBLIC_SITE||'http://127.0.0.1:4185/Cosme-Collomb/'
const server=process.env.PUBLIC_SITE?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4185','--strictPort'],{stdio:'inherit'})
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const report={site,loops:[],viewports:[],errors:[],screenshots:[],validation:[]}
await mkdir('test-output',{recursive:true})
let browser,page
const prefix=process.env.PUBLIC_SITE?'public':process.env.AUDIT_PAGES_ONLY?'pages':'network'
async function capture(label,geometryOnly=false){
  let style
  if(geometryOnly)style=await page.addStyleTag({content:'#content,.topbar,.scroll-index,.site-footer,.bridge-wayfinding {visibility:hidden !important} .scene-shading{display:none} '})
  const path='test-output/'+prefix+'-'+label+'.png'
  try{await page.screenshot({path,timeout:20000});report.screenshots.push(path)}finally{await style?.evaluate(el=>el.remove())}
}
async function landed(path,timeout=180000){
  await page.waitForFunction(path=>{
    const f=window.__portfolioFlight
    return f?.version==='continuous-network-1'&&f.currentRoute===path&&!f.transiting&&location.hash==='#'+path
  },path,{timeout})
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:10000})
  // The physical landing precedes AnimatePresence mounting the next page.
  // Require the user's destination controls, not just the camera milestone.
  if(path==='/projets')await page.locator('.fork-choice').nth(7).waitFor({state:'visible',timeout:15000})
  else {
    const project=PROJECTS.find(p=>path==='/projets/'+p.slug)
    const expected=project?.title||(path==='/contact'?/La suite/:path==='/parcours'?/Faire dialoguer/:/Donner forme/)
    await page.locator('main h1').filter({hasText:expected}).waitFor({state:'visible',timeout:15000})
  }
  console.log('LANDED',path)
}
async function startCapture(){await page.evaluate(()=>{window.__portfolioFrames=[];window.__portfolioCapture=true})}
async function endCapture(label){
  const frames=await page.evaluate(()=>{window.__portfolioCapture=false;return window.__portfolioFrames})
  assert.ok(frames.length>20,label+' lacks real WebGL frames')
  let maxStep=0,maxTurn=0,minimumForward=1,stationarySpin=0
  const geometryId=frames[0].wallGeometry
  for(let i=1;i<frames.length;i++){
    const a=frames[i-1],b=frames[i]
    assert.equal(b.wallGeometry,geometryId,'Wall geometry was replaced during navigation')
    assert.equal(b.networkObjects,EDGES.length,'A physical branch disappeared')
    const step=new THREE.Vector3(...b.position).sub(new THREE.Vector3(...a.position))
    const distance=step.length();maxStep=Math.max(maxStep,distance)
    assert.ok(distance<=.421,label+' teleported '+distance+'m between rendered frames')
    const turn=new THREE.Quaternion(...a.quaternion).angleTo(new THREE.Quaternion(...b.quaternion))
    maxTurn=Math.max(maxTurn,turn)
    assert.ok(turn<.12,label+' snapped orientation by '+turn+' rad')
    if(distance>.0001){
      const dot=step.normalize().dot(new THREE.Vector3(...b.direction));minimumForward=Math.min(minimumForward,dot)
      assert.ok(dot>.97,label+' moved against its actual rendered gaze: '+dot)
    }else {stationarySpin=Math.max(stationarySpin,turn);assert.ok(turn<.003,label+' rotates in place')}
  }
  // Independently replay actual eye positions against the exact compiled
  // wall, rather than accepting a radius-based clearance reported by the app.
  const bytes=await readFile('src/scene/compiled/network.bin')
  const g=decodeNetwork(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))
  g.boundsTree=new MeshBVH(g)
  const wall=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.raycast=acceleratedRaycast;wall.updateMatrixWorld()
  const ray=new THREE.Raycaster();ray.firstHitOnly=true;let clearance=Infinity
  for(let i=0;i<frames.length;i+=8){
    const f=frames[i],origin=new THREE.Vector3(...f.position)
    for(const dir of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
      ray.set(origin,dir);ray.far=200
      const hit=ray.intersectObject(wall)[0];assert.ok(hit,label+' visible hole in actual wall')
      clearance=Math.min(clearance,hit.distance);assert.ok(hit.distance>2.3,label+' eye crosses actual mesh')
    }
  }
  g.dispose();wall.material.dispose()
  const result={label,frames:frames.length,maxStep,maxTurnDegrees:maxTurn*180/Math.PI,minimumForward,stationarySpin,clearance}
  report.validation.push(result);console.log('FLIGHT',JSON.stringify(result))
  return frames
}
async function clickNav(text){await page.locator('.header-primary a').filter({hasText:new RegExp('^'+text+'$')}).click()}

try{
  if(server)for(let i=0;i<100;i++){try{if((await fetch(site)).ok)break}catch{}await wait(250)}
  const options={...browserOptions}
  if(process.env.PUBLIC_SITE&&process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY}
  browser=await chromium.launch(options)
  page=await browser.newPage({viewport:{width:960,height:640}})
  page.setDefaultTimeout(180000)
  // Font CDNs are not available in every CI sandbox. Test the actual site
  // with its declared local fallbacks; no application resource is mocked.
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort())
  page.on('pageerror',e=>report.errors.push(e.message))
  await page.goto(site+'#/projets',{waitUntil:'domcontentloaded'})
  await landed('/projets')
  await page.waitForTimeout(1500)
  assert.equal(await page.locator('.fork-choice').count(),8)
  const first=await page.evaluate(()=>window.__portfolioFlight)
  await capture('hub');await capture('hub-geometry',true)
  const count=process.env.AUDIT_PAGES_ONLY?0:process.env.AUDIT_QUICK==='1'?1:8
  for(let i=0;i<count;i++){
    const path='/projets/'+PROJECTS[i].slug
    await page.evaluate(()=>window.scrollTo({top:document.querySelector('#project-crossroads').offsetTop,behavior:'instant'}))
    await startCapture()
    await page.locator('.fork-choice').nth(i).click()
    await landed(path)
    assert.equal((await page.locator('.journey-entrance h1').innerText()).trim(),PROJECTS[i].title)
    const assembly=await page.evaluate(()=>window.__portfolioBridgeMesh)
    assert.equal(assembly.rows,16,'Floor not fully assembled before entering')
    if(i===0){
      await capture('entrance',true)
      await page.evaluate(()=>window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*.40,behavior:'instant'}))
      await page.waitForFunction(()=>window.__portfolioFlight.t>.38)
      await capture('far-curve',true)
      const before=await page.evaluate(()=>window.__portfolioFlight.t)
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(800)
      assert.ok((await page.evaluate(()=>window.__portfolioFlight.t))>=before,'Reverse scroll reverses camera')
    }
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}))
    if(i===0){await page.waitForFunction(()=>window.__portfolioFlight.t>.72);await capture('return-corridor',true)}
    await landed('/projets')
    const back=await page.evaluate(()=>window.__portfolioFlight)
    assert.ok(new THREE.Vector3(...back.position).distanceTo(HUB)<1e-7)
    assert.ok(new THREE.Quaternion(...back.quaternion).angleTo(new THREE.Quaternion(...first.quaternion))<1e-7)
    assert.equal(back.wallGeometry,first.wallGeometry)
    assert.equal(await page.locator('.fork-choice').count(),8)
    await endCapture('project-'+(i+1))
    report.loops.push({project:PROJECTS[i].title,sameHub:true,eightAccesses:true})
    console.log('COMPLETE LOOP',i+1,PROJECTS[i].title)
  }
  await capture('restored-hub')
  if(process.env.AUDIT_QUICK!=='1'){
    await startCapture()
    await clickNav('Parcours')
    await clickNav('Contact') // Must be queued while the first flight is active.
    await landed('/contact')
    await page.locator('#contact-message').waitFor({state:'visible',timeout:15000})
    await clickNav('Accueil');await landed('/')
    await clickNav('Projets');await landed('/projets')
    await endCapture('queued-pages-and-home')
    // Direct URL, refresh, then browser history: the scene remains continuous
    // for history navigation, and starts on the right route on a fresh load.
    await page.goto(site+'#/projets/'+PROJECTS[7].slug,{waitUntil:'domcontentloaded'})
    await landed('/projets/'+PROJECTS[7].slug)
    await page.reload({waitUntil:'domcontentloaded'});await landed('/projets/'+PROJECTS[7].slug)
    await startCapture();await clickNav('Projets');await landed('/projets')
    await page.goBack();await landed('/projets/'+PROJECTS[7].slug)
    await endCapture('direct-refresh-history')
    for(const [width,height] of [[390,844],[844,390],[768,1024]]){
      await page.setViewportSize({width,height})
      await page.goto(site+'#/projets',{waitUntil:'domcontentloaded'});await landed('/projets')
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Horizontal overflow')
      assert.equal(await page.locator('.fork-choice').count(),8)
      await capture('viewport-'+width+'x'+height)
      if(width===390){
        await startCapture();await page.locator('.fork-choice').last().click();await landed('/projets/'+PROJECTS[7].slug)
        await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await landed('/projets')
        await endCapture('mobile-full-loop')
      }
      report.viewports.push({width,height,working:true})
    }
    const fallback=await browser.newPage({viewport:{width:390,height:844}})
    await fallback.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort())
    await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args)}})
    await fallback.goto(site,{waitUntil:'domcontentloaded'})
    await fallback.locator('.header-menu-toggle').click();await fallback.locator('.navigation-drawer').waitFor({state:'visible'})
    assert.equal(await fallback.locator('.navigation-projects a').count(),8);await fallback.close()
  }
  assert.deepEqual(report.errors,[])
  console.log('NETWORK BROWSER PASSED',JSON.stringify({loops:report.loops.length,viewports:report.viewports.length,version:NETWORK_VERSION}))
}catch(error){
  report.failure=String(error);console.error(error)
  try{console.error('STATE',await page.evaluate(()=>({hash:location.hash,flight:window.__portfolioFlight})));await capture('failure')}catch{}
  process.exitCode=1
}finally{
  await writeFile('test-output/'+prefix+'-report.json',JSON.stringify(report,null,2))
  await browser?.close();server?.kill('SIGTERM')
}
