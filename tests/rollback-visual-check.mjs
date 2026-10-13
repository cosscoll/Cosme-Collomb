import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { browserOptions } from './browser-options.mjs'

const site=process.env.PUBLIC_SITE
assert.ok(site?.startsWith('https://'))
await mkdir('test-output',{recursive:true})
const options={...browserOptions}
if(process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY}
const browser=await chromium.launch(options)
const report={site,reference:'393df15b4cb22eee98102edec111068fede6aec1',formats:[],failures:[]}
try {
 for(const [name,width,height]of [['desktop',1440,900],['phone',390,844],['tablet',768,1024]]) {
  const page=await browser.newPage({viewport:{width,height},hasTouch:name!=='desktop',isMobile:name!=='desktop'})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort())
  try {
   await page.goto(site+'?restore='+Date.now()+'#/',{waitUntil:'domcontentloaded',timeout:45000})
   await page.locator('main h1').filter({hasText:/Donner forme/}).waitFor({timeout:30000})
   await page.waitForFunction(()=>window.__portfolioFlight?.version==='continuous-network-1'&&window.__portfolioFlight.drawCalls>0,null,{timeout:60000})
   await page.evaluate(()=>document.fonts.ready)
   await page.waitForTimeout(1200)
   const appearance=await page.evaluate(()=>({
    background:getComputedStyle(document.body).backgroundColor,
    accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    width:document.documentElement.scrollWidth,viewport:innerWidth
   }))
   assert.equal(appearance.background,'rgb(8, 8, 15)','Original dark visual identity was not restored')
   assert.equal(appearance.accent,'#e2c6b8','Original accent was not restored')
   assert.ok(appearance.width<=appearance.viewport+2,'Page has horizontal overflow')
   assert.equal(await page.locator('#works .fork-choice').count(),8)
   await page.screenshot({path:'test-output/restored-'+name+'-hero.jpg',type:'jpeg',quality:70,timeout:30000})
   await page.locator('#works .fork-choice').first().scrollIntoViewIfNeeded()
   await page.waitForTimeout(1000)
   await page.screenshot({path:'test-output/restored-'+name+'-projects.jpg',type:'jpeg',quality:70,timeout:30000})
   await page.locator('.header-menu-toggle').click()
   await page.locator('.navigation-drawer').waitFor({state:'visible'})
   await page.waitForTimeout(800)
   assert.equal(await page.locator('.navigation-projects a').count(),8)
   await page.screenshot({path:'test-output/restored-'+name+'-menu.jpg',type:'jpeg',quality:70,timeout:30000})
   assert.deepEqual(errors,[])
   report.formats.push({name,width,height,...appearance})
   console.log('ORIGINAL PUBLIC VISUAL PASS',name,JSON.stringify(appearance))
  } catch(error) {
   report.failures.push({name,error:String(error)})
   console.error('ORIGINAL PUBLIC VISUAL FAIL',name,String(error))
  } finally {await page.close()}
 }
} finally {
 await writeFile('test-output/restoration-public-report.json',JSON.stringify(report,null,2))
 await browser.close()
}
assert.equal(report.failures.length,0,'Original public visual verification failed')
console.log('ORIGINAL PUBLIC RESTORATION VERIFIED',JSON.stringify({formats:report.formats.length,failures:report.failures.length}))
