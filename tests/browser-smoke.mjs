import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

const origin='http://127.0.0.1:4173'
const site=origin+'/Cosme-Collomb/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
  '--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'})
let browser

async function waitForServer(){
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw new Error('Vite preview exited before being ready')
    try{
      const response=await fetch(site)
      if(response.ok)return
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  throw new Error('Vite preview never became reachable on '+site)
}

async function verifyPage(page,name,expected){
  // Router navigation includes a 4.2-second built tunnel passage.
  // Await the EXPECTED page, rather than immediately reading the departing H1.
  const target=page.locator('main h1').filter({hasText:expected}).first()
  await target.waitFor({state:'visible',timeout:60000})
  // A heading can appear while Framer Motion is still blurring the page.
  // Verify the final state, not a screenshot taken mid-transition.
  await page.waitForFunction(()=>{
    const blocks=[...document.querySelectorAll('main > div')]
    const current=blocks[blocks.length-1]
    if(!current)return false
    const css=getComputedStyle(current)
    const blur=css.filter.startsWith('blur(')?parseFloat(css.filter.slice(5)):0
    return Number(css.opacity)>.98 && blur<.35
  },null,{timeout:10000})
  const heading=(await target.innerText()).trim()
  assert.match(heading,expected,name+': unexpected heading '+heading)
  assert.ok(await page.locator('.header-menu-toggle').isVisible(),name+': header missing')
  assert.ok(await page.locator('.brand-mark').isVisible(),name+': home link missing')
  console.log('Browser passed:',name,'—',heading.replace(/\s+/g,' '))
}

async function captureWhenPossible(page,path){
  // Software WebGL screenshots occasionally stall on GPU readback even while
  // navigation works normally. Never confuse that with a broken site.
  try{await page.screenshot({path,timeout:6500})}
  catch(error){console.warn('Optional WebGL screenshot unavailable:',path,error.message)}
}


// Record actual WebGL camera positions over time. A browser route can pass
// while the rendered camera visibly teleports or crosses the same wall twice.
async function beginFlightTrace(page){
  await page.evaluate(()=>{
    clearInterval(window.__flightTimer)
    window.__flightTrace=[]
    window.__flightTimer=setInterval(()=>{
      const f=window.__portfolioFlight
      if(f)window.__flightTrace.push({
        at:performance.now(),...f
      })
    },40)
  })
}
async function assertFlightContinuous(page,label){
  const data=await page.evaluate(()=>{
    clearInterval(window.__flightTimer)
    return window.__flightTrace||[]
  })
  assert.ok(data.length>12,label+': insufficient 3D camera samples')
  let worst=0
  for(let i=1;i<data.length;i++){
    const a=data[i-1],b=data[i]
    const distance=Math.hypot(...a.position.map((v,j)=>v-b.position[j]))
    const speed=distance/Math.max(1,b.at-a.at)
    worst=Math.max(worst,speed)
    if(distance>2 && speed>.16)console.error('PHYSICAL CAMERA JUMP',JSON.stringify({
      label,distance,speed,previous:data[i-2],a,b,next:data[i+1]
    }))
    assert.ok(!(distance>2 && speed>.16),
      label+': physical camera jump '+distance.toFixed(2)+'m in '+(b.at-a.at).toFixed(0)+'ms')
  }
  console.log('Camera path continuous:',label, 'samples:',data.length,
    'peak m/ms:',worst.toFixed(3))
}

async function run(){
  await waitForServer()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({
    headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage','--disable-gpu-sandbox']
  })
  const page=await browser.newPage({viewport:{width:1030,height:690}})
  page.setDefaultTimeout(60000)
  const errors=[]
  page.on('pageerror',error=>errors.push(String(error)))

  await page.goto(site,{waitUntil:'domcontentloaded',timeout:60000})
  await verifyPage(page,'home',/Donner forme/i)

  await page.locator('.header-primary a').filter({hasText:'Projets'}).click()
  await verifyPage(page,'projects',/Cinq projets/i)
  assert.ok(await page.locator('.fork-choice').count()===5,'Missing one of five 3D project choices')

  // The WebGL passage must exist and build in visible frames, not a white
  // screen that merely masks an instantaneous URL change.
  const canvas=page.locator('.scene-backdrop canvas').first()
  await canvas.waitFor({state:'visible',timeout:60000})
  console.log('3D canvas present:',await canvas.evaluate(node=>({
    width:node.width,height:node.height
  })))
  // Observe bridge creation throughout the click, rather than trying to
  // catch its transient DOM marker at one exact animation frame.
  await page.evaluate(()=>{
    window.__sawProjectBridge=false
    const observer=new MutationObserver(()=>{
      if(document.querySelector('[data-bridge-transition="active"]')){
        window.__sawProjectBridge=true
        observer.disconnect()
      }
    })
    observer.observe(document.documentElement,{childList:true,subtree:true})
  })
  await page.evaluate(()=>window.scrollTo({
    top:document.getElementById('project-crossroads').offsetTop,behavior:'instant'
  }))
  await page.waitForTimeout(1100)
  const originalFork=await page.evaluate(()=>window.__portfolioFlight?.position)
  assert.ok(originalFork?.length===3,'Original 3D fork viewpoint not available')
  await beginFlightTrace(page)
  await page.locator('.fork-choice').first().click()
  await page.waitForFunction(()=>window.__sawProjectBridge,{timeout:60000})
  assert.equal(await page.locator('.transition-portal').count(),0,
    'Legacy full-screen portal is still masking the real tunnel')
  await page.waitForTimeout(630)
  await page.waitForTimeout(2250)
  await verifyPage(page,'first project',/Ouvertures d'échecs/i)
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:60000})
  await assertFlightContinuous(page,'first project entry')

  // Finishing a project must AUTO-RETURN to the physical five-way fork.
  // A duplicate four-choice "return intersection" is explicitly forbidden.
  assert.equal(await page.locator('.return-choices').count(),0,
    'A second crossroads with only four projects still exists')
  await beginFlightTrace(page)
  await page.evaluate(()=>window.scrollTo({
    top:document.documentElement.scrollHeight,behavior:'instant'
  }))
  await page.locator('[data-bridge-transition="active"]').waitFor({timeout:60000})
  await verifyPage(page,'back to projects',/Cinq projets/i)
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:60000})
  await page.waitForTimeout(1400)
  await assertFlightContinuous(page,'automatic project return')
  const restoredFork=await page.evaluate(()=>window.__portfolioFlight?.position)
  const forkDrift=Math.hypot(...originalFork.map((v,i)=>v-restoredFork[i]))
  assert.ok(forkDrift<.7,
    'Return is not the identical 3D camera location at the original five project gates: '+forkDrift)
  console.log('Physical five-way fork restored, camera drift:',forkDrift.toFixed(3),'metres')
  // SwiftShader can stall on GPU readback after disposing the temporary 3D
  // bridge. The geometric/UI checks below remain mandatory if that happens.
  const crossroads=await page.evaluate(()=>{
    const target=document.querySelector('#project-crossroads')
    return {scrollY:window.scrollY,top:target?.offsetTop,choices:
      document.querySelectorAll('.fork-choice').length,
      bridgeGone:!document.querySelector('[data-bridge-transition="active"]')}
  })
  assert.equal(crossroads.choices,5,'The five project choices disappeared on return')
  assert.ok(crossroads.bridgeGone,'Old bridge still overlays the restored crossroads')
  assert.ok(Math.abs(crossroads.scrollY-crossroads.top)<30,
    'Return failed to restore the actual 5-project crossroads: '+JSON.stringify(crossroads))
  await page.locator('.fork-choice').nth(1).click()
  await verifyPage(page,'second project after returning',/Probabilités Hold'em/i)
  await page.locator('.header-return').click()
  await verifyPage(page,'back to projects a second time',/Cinq projets/i)
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:60000})
  assert.ok(await page.locator('.fork-choice').count()===5)


  // Changing main pages with the header must animate through a physical
  // corridor too, without an instant three-dimensional position jump.
  await beginFlightTrace(page)
  await page.locator('.header-primary a').filter({hasText:'Parcours'}).click()
  await page.locator('[data-bridge-transition="active"]').waitFor()
  await verifyPage(page,'header to parcours',/Faire dialoguer/i)
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:60000})
  await assertFlightContinuous(page,'header to parcours')
  await beginFlightTrace(page)
  await page.locator('.header-primary a').filter({hasText:'Contact'}).click()
  await page.locator('[data-bridge-transition="active"]').waitFor()
  await verifyPage(page,'header to contact',/La suite/i)
  await page.locator('[data-bridge-transition="active"]').waitFor({state:'hidden',timeout:60000})
  await assertFlightContinuous(page,'header to contact')
  await page.locator('.header-home-link').click()
  await verifyPage(page,'return to homepage',/Donner forme/i)

  await page.locator('.header-menu-toggle').click()
  await page.locator('.navigation-drawer').waitFor({state:'visible'})
  assert.ok(await page.locator('.navigation-projects a').count()===5)
  await page.keyboard.press('Escape')
  await page.locator('.navigation-drawer').waitFor({state:'hidden'})
  assert.deepEqual(errors,[],'Client-side JavaScript errors on desktop')

  // Verify the same landing page remains usable without WebGL.
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true})
  await mobile.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null
      return original.call(this,type,...args)
    }
  })
  const mobileErrors=[]
  mobile.on('pageerror',error=>mobileErrors.push(String(error)))
  await mobile.goto(site,{waitUntil:'domcontentloaded'})
  await verifyPage(mobile,'mobile fallback',/Donner forme/i)
  await mobile.locator('.header-menu-toggle').click()
  await mobile.locator('.navigation-drawer').waitFor({state:'visible'})
  assert.deepEqual(mobileErrors,[],'Client-side JavaScript errors on mobile')
  console.log('BROWSER SMOKE TESTS PASSED: home, projects, detail, back, mobile, menu, JavaScript')
}

try{
  await run()
}catch(error){
  console.error('BROWSER SMOKE TEST FAILED:',error)
  process.exitCode=1
}finally{
  await browser?.close()
  server.kill('SIGTERM')
}
