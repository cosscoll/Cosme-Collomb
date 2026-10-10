import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const site='https://cosscoll.github.io/Cosme-Collomb/'
const browser=await chromium.launch({
 headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader',
   '--disable-dev-shm-usage','--disable-gpu-sandbox']
})
let failures=0
try{
 for(const [label,width,height] of [
  ['portrait-mobile',390,844],
  ['small-mobile',360,740],
  ['landscape-mobile',844,390],
  ['tablet-portrait',768,1024],
  ['desktop',1366,768]
 ]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  console.log('VIEWPORT_START',label,width,height)
  try{
   await page.goto(site+'?responsive-3d='+Date.now()+'#/projets',{waitUntil:'domcontentloaded',timeout:40000})
   await page.locator('canvas').first().waitFor({state:'visible',timeout:35000})
   await page.waitForFunction(()=>{
     const f=window.__portfolioFlight
     return f && f.minimumWallClearance!==undefined && f.fov>30
   },null,{timeout:40000})
   await page.waitForTimeout(650)
   const first=await page.evaluate(()=>window.__portfolioFlight)
   const ratio=width/height
   const expectedFov=Math.max(39,Math.min(45,45-8*Math.max(0,1-ratio)-2*Math.max(0,ratio-1.9)))
   assert.ok(first.minimumWallClearance>2.4,label+' eye approaches narrow corridor wall')
   assert.ok(Math.abs(first.fov-expectedFov)<2,label+' wrong FOV '+first.fov+' expected '+expectedFov)
   await page.evaluate(()=>{
     window.__responsive3DTrace=[]
     clearInterval(window.__responsive3DTicker)
     window.__responsive3DTicker=setInterval(()=>{
       const f=window.__portfolioFlight
       if(f)window.__responsive3DTrace.push({
         time:performance.now(),position:f.position,
         fov:f.fov,wall:f.minimumWallClearance,
         t:f.t,mode:f.mode,transiting:f.transiting,
         direction:f.direction
       })
     },45)
     const fork=document.querySelector('#project-crossroads')
     if(fork)window.scrollTo({top:fork.offsetTop,behavior:'instant'})
   })
   await page.waitForTimeout(2600)
   const fork=await page.evaluate(()=>window.__portfolioFlight)
   assert.ok(fork.minimumWallClearance>2.4,label+' wall clearance at junction')
   const selected=page.locator('.fork-choice').first()
   await selected.scrollIntoViewIfNeeded({timeout:10000})
   await selected.click({timeout:20000})
   await page.locator('.journey-entrance h1').filter({hasText:/Ouvertures d'échecs/}).waitFor({state:'visible',timeout:60000})
   await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:40000}).catch(()=>{})
   await page.waitForTimeout(450)
   const frames=await page.evaluate(()=>{
     clearInterval(window.__responsive3DTicker)
     return window.__responsive3DTrace
   })
   assert.ok(frames.length>16,label+' no WebGL camera samples')
   assert.ok(frames.every(f=>Number.isFinite(f.wall)&&f.wall>2.3),
     label+' camera touches or crosses a wall')
   assert.ok(frames.some(f=>f.transiting),label+' transition rendered without 3D flight')
   const worst=Math.min(...frames.map(f=>f.wall))
   const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth)
   assert.ok(scrollWidth<=width+12,label+' project page horizontal overflow '+scrollWidth)
   assert.deepEqual(errors,[],label+' JavaScript errors')
   console.log('VIEWPORT_PASS',JSON.stringify({
     label,width,height,expectedFov,
     initialFov:first.fov,minimumWallClearance:worst,
     samples:frames.length,scrollWidth
   }))
  }catch(error){
   failures++
   console.error('VIEWPORT_FAIL',label,error.stack?.slice(0,800)||String(error))
  }finally{
   await page.close().catch(()=>{})
  }
 }
}finally{await browser.close()}
console.log('RESPONSIVE_3D_RESULT',JSON.stringify({viewports:5,failures}))
if(failures)process.exitCode=1
