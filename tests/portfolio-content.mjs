import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { browserOptions } from './browser-options.mjs'

const site=process.env.PUBLIC_SITE||'http://127.0.0.1:4186/Cosme-Collomb/'
const server=process.env.PUBLIC_SITE?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:'inherit'})
const prefix=process.env.PUBLIC_SITE?'public-content':'content'
const report={site,checks:[],screenshots:[]}
await mkdir('test-output',{recursive:true})
let browser,page
try{
  if(server)await new Promise(resolve=>setTimeout(resolve,1500))
  const options={...browserOptions}
  if(process.env.PUBLIC_SITE&&process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY}
  browser=await chromium.launch(options)
  // Layout and image QA is independent of WebGL; existing network-browser
  // checks the complete physical journeys in the same release.
  page=await browser.newPage()
  await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort())
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args)}})
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:width<600?844:1024})
    for(const route of ['/', '/projets','/parcours',...PROJECTS.map(p=>'/projets/'+p.slug)]){
      // A hash-only goto otherwise reuses the preceding animated journey.
      // Start each layout assertion from a fresh document and intended route.
      await page.goto('about:blank')
      await page.goto(site+'#'+route,{waitUntil:'domcontentloaded'})
      const project=PROJECTS.find(p=>route==='/projets/'+p.slug)
      const heading=project?.title||(route==='/parcours'?/Faire dialoguer/:route==='/projets'?/Huit projets/:/Donner forme/)
      await page.locator('main h1').filter({hasText:heading}).waitFor({state:'visible'})
      await page.waitForTimeout(1200)
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#08080f')
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),'#e2c6b8')
      if(route==='/'||route==='/projets'){
        await page.locator('.fork-choice').nth(7).waitFor({state:'attached'})
        assert.equal(await page.locator('.fork-choice').count(),8)
        await page.locator('.header-menu-toggle').click()
        await page.locator('.navigation-drawer').waitFor({state:'visible'})
        assert.equal(await page.locator('.navigation-projects a').count(),8)
        await page.locator('.header-menu-toggle').click()
      }
      if(project){
        assert.equal(await page.locator('.project-facts').count(),1)
        assert.equal(await page.locator('.evidence-media img').count(),project.gallery.length)
        assert.equal(await page.locator('.project-demo video').count(),project.demo?1:0)
        if(project.demo){
          assert.equal(await page.locator('.project-demo source').getAttribute('src'),'/Cosme-Collomb/media/project-demos/'+project.demo.video)
          if(width===390){
            const video=await page.request.get(site+'media/project-demos/'+project.demo.video)
            const poster=await page.request.get(site+'media/project-demos/'+project.demo.poster)
            assert.equal(video.status(),200,'Video unavailable for '+project.slug)
            assert.equal(poster.status(),200,'Poster unavailable for '+project.slug)
          }
        }
        for(const url of [project.link,project.repoLink,...project.resources.map(r=>r.url)].filter(Boolean))assert.ok(await page.locator('main a').evaluateAll((links,url)=>links.some(a=>a.href===url),url),'Missing project link '+url)
      }
      if(route==='/parcours'){
        assert.equal(await page.locator('.profile-entry').count(),5)
        assert.match(await page.locator('.profile-timeline').innerText(),/INSEEC MSc Toulouse/)
        assert.match(await page.locator('.profile-timeline').innerText(),/MédiAge Formations/)
        assert.equal(await page.locator('.creative-case').count(),2)
        assert.equal(await page.locator('.creative-details summary').count(),2)
        assert.equal(await page.locator('.creative-palette .creative-swatch').count(),4)
        assert.equal(await page.locator('.evidence-media img').count(),0)
        assert.equal(await page.getByRole('link',{name:/Consulter mon CV/}).count(),1)
        assert.ok(!(await page.locator('main').innerText()).includes('Virginie Quintana'))
        if(width===390){const cv=await page.request.get(site+'cv.html');assert.equal(cv.status(),200);assert.match(await cv.text(),/Cosme Collomb/)}
      }
      for(const img of await page.locator('.evidence-media img').all()){
        await img.scrollIntoViewIfNeeded()
        await img.evaluate(img=>new Promise((resolve,reject)=>{if(img.complete)return img.naturalWidth?resolve():reject(Error('Broken image '+img.src));img.onload=resolve;img.onerror=()=>reject(Error('Broken image '+img.src))}))
        assert.ok(await img.getAttribute('alt'))
      }
      const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth-innerWidth,bad:[...document.querySelectorAll('.evidence-figure,.project-facts,.profile-entry,.profile-tools')].filter(el=>{const r=el.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1}).map(el=>el.className)}))
      assert.ok(overflow.page<=1,'Page overflow '+width+' '+route+' '+overflow.page)
      assert.deepEqual(overflow.bad,[],'Content exceeds viewport '+width+' '+route)
      if([390,768,1440].includes(width)&&(route==='/parcours'||project===PROJECTS[0]||project===PROJECTS[7])){
        await page.locator(route==='/parcours'?'.creative-case':'.evidence-gallery').first().scrollIntoViewIfNeeded()
        await page.waitForTimeout(1100)
        const path='test-output/'+prefix+'-'+width+'-'+(project?.slug||'parcours')+'.png'
        await page.screenshot({path});report.screenshots.push(path)
      }
      report.checks.push({width,route,images:await page.locator('.evidence-media img').count()})
    }
  }
  console.log('CONTENT VERIFIED',JSON.stringify({pages:report.checks.length,viewports:5,screenshots:report.screenshots.length}))
}catch(error){report.failure=String(error);console.error(error);try{await page.screenshot({path:'test-output/'+prefix+'-failure.png'})}catch{}process.exitCode=1}
finally{await writeFile('test-output/'+prefix+'-report.json',JSON.stringify(report,null,2));await browser?.close();server?.kill('SIGTERM')}
