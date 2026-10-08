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
  // Router navigation includes a 2.5-second cinematic hand-off.
  // Await the EXPECTED page, rather than immediately reading the departing H1.
  const target=page.locator('main h1').filter({hasText:expected}).first()
  await target.waitFor({state:'visible',timeout:25000})
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

async function run(){
  await waitForServer()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({
    headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage','--disable-gpu-sandbox']
  })
  const page=await browser.newPage({viewport:{width:1365,height:850}})
  page.setDefaultTimeout(20000)
  const errors=[]
  page.on('pageerror',error=>errors.push(String(error)))

  await page.goto(site,{waitUntil:'domcontentloaded',timeout:25000})
  await verifyPage(page,'home',/Donner forme/i)
  await page.screenshot({path:'test-output/home.png'})

  await page.locator('.header-primary a').filter({hasText:'Projets'}).click()
  await verifyPage(page,'projects',/Cinq projets/i)
  assert.ok(await page.locator('.fork-choice').count()===5,'Missing one of five 3D project choices')
  await page.screenshot({path:'test-output/projects.png'})

  await page.locator('.fork-choice').first().click()
  await verifyPage(page,'first project',/Ouvertures d'échecs/i)
  await page.screenshot({path:'test-output/detail.png'})

  await page.locator('.header-return').click()
  await verifyPage(page,'back to projects',/Cinq projets/i)

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
  await mobile.screenshot({path:'test-output/mobile-menu.png'})
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
