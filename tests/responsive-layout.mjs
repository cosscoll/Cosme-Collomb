import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { browserOptions } from './browser-options.mjs'

const site=process.env.PUBLIC_SITE||'http://127.0.0.1:4186/Cosme-Collomb/'
const server=process.env.PUBLIC_SITE?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:'inherit'})
const viewports=[
  {name:'phone-small',width:320,height:568},
  {name:'phone-android',width:360,height:800},
  {name:'phone',width:390,height:844},
  {name:'phone-landscape',width:844,height:390},
  {name:'tablet',width:768,height:1024},
  {name:'tablet-large',width:820,height:1180},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'tablet-large-landscape',width:1180,height:820}
]
const paths=['/','/projets','/parcours','/contact',...PROJECTS.map(p=>'/projets/'+p.slug)]
const report={site,viewports:[],failures:[],webgl:[]}
await mkdir('test-output',{recursive:true})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let browser

async function visit(page,path){
  await page.goto(site+'?responsive='+Date.now()+'#'+path,{waitUntil:'domcontentloaded',timeout:45000})
  await page.locator('main h1').waitFor({timeout:20000})
  await page.evaluate(async()=>{
    await Promise.all([document.fonts.load('600 20px Sora'),document.fonts.load('400 20px Manrope')])
    await document.fonts.ready
  })
  await page.waitForTimeout(1650)
}

async function layout(page){
  return page.evaluate(()=>{
    const problems=[]
    const viewport=innerWidth
    const textNodes=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
    while(textNodes.nextNode()){
      const node=textNodes.currentNode,el=node.parentElement,text=node.textContent.trim()
      if(!text||!el||el.closest('script,style,.scene-backdrop,.scroll-index,.contact-honey,.crumb-current,[aria-hidden="true"]'))continue
      if(!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue
      const range=document.createRange();range.selectNodeContents(node)
      for(const rect of range.getClientRects()){
        if(rect.width>0&&(rect.left<-.5||rect.right>viewport+.5)){
          problems.push({kind:'text-overflow',text:text.slice(0,90),left:+rect.left.toFixed(1),right:+rect.right.toFixed(1)})
          break
        }
      }
    }
    const width=document.documentElement.scrollWidth
    if(width>viewport+1)problems.push({kind:'page-overflow',width,viewport})
    const controls=[...document.querySelectorAll('.brand-mark,.header-home-link,.header-return,.header-menu-toggle,.navigation-close')]
    const boxes=controls.filter(el=>el.getClientRects().length).map(el=>{
      const r=el.getBoundingClientRect()
      return {label:el.getAttribute('aria-label'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}
    })
    for(const b of boxes){
      if(b.left<0||b.right>viewport+1)problems.push({kind:'header-clipped',...b})
      if(b.height<43.5||b.width<43.5)problems.push({kind:'small-touch-target',...b})
    }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j]
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)
        problems.push({kind:'header-overlap',a:a.label,b:b.label})
    }
    for(const el of document.querySelectorAll('.portfolio-contact-form input:not([type=hidden]),.portfolio-contact-form textarea')){
      if(parseFloat(getComputedStyle(el).fontSize)<16)problems.push({kind:'input-zoom',id:el.id,fontSize:getComputedStyle(el).fontSize})
      const r=el.getBoundingClientRect()
      if(r.left<0||r.right>viewport+1)problems.push({kind:'input-clipped',id:el.id,left:r.left,right:r.right})
    }
    return {width,problems}
  })
}

async function menu(page){
  const toggle=page.locator('.header-menu-toggle')
  await toggle.click()
  const drawer=page.locator('.navigation-drawer')
  await drawer.waitFor({state:'visible'})
  await page.waitForTimeout(550)
  assert.equal(await drawer.locator('.navigation-main-links a').count(),4)
  assert.equal(await drawer.locator('.navigation-projects a').count(),8)
  const bounds=await drawer.evaluate(el=>{
    const r=el.getBoundingClientRect()
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,viewportWidth:innerWidth,viewportHeight:innerHeight}
  })
  assert.ok(bounds.left>=0&&bounds.right<=bounds.viewportWidth+1,'drawer exceeds screen width '+JSON.stringify(bounds))
  assert.ok(bounds.top>=0&&bounds.bottom<=bounds.viewportHeight+1,'drawer exceeds screen height '+JSON.stringify(bounds))
  assert.ok(bounds.scrollWidth<=bounds.clientWidth+1,'drawer content horizontally clipped '+JSON.stringify(bounds))
  const last=drawer.locator('.navigation-projects a').last()
  await last.scrollIntoViewIfNeeded()
  const target=await last.boundingBox()
  assert.ok(target.y>=bounds.top-1&&target.y+target.height<=bounds.bottom+1,'eighth project cannot be reached inside drawer')
  await page.keyboard.press('Escape')
  await drawer.waitFor({state:'hidden'})
  assert.equal(await toggle.getAttribute('aria-expanded'),'false')
  assert.ok(await toggle.evaluate(el=>document.activeElement===el),'menu does not restore keyboard focus')
  return bounds
}

async function proof(page,label){
  const bytes=await page.screenshot({path:'test-output/responsive-'+label+'.jpg',type:'jpeg',quality:60,timeout:30000})
  console.log('RESPONSIVE_PROOF_'+label.replaceAll('-','_').toUpperCase()+'='+bytes.toString('base64'))
}

try{
  if(server)for(let i=0;i<100;i++){try{if((await fetch(site)).ok)break}catch{}await pause(250)}
  const options={...browserOptions}
  if(process.env.PUBLIC_SITE&&process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY}
  browser=await chromium.launch(options)
  // Check every editorial section independently of GPU rendering. The actual
  // WebGL composition is then checked separately on both device orientations.
  for(const viewport of viewports){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},hasTouch:true})
    page.setDefaultTimeout(25000)
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        return /webgl/.test(type)?null:getContext.call(this,type,...args)
      }
    })
    const entry={...viewport,pages:[],menu:null}
    try{
      for(const path of paths){
        try{
          await visit(page,path)
          const result=await layout(page)
          if(path==='/'||path==='/projets'){
            assert.equal(await page.locator('.fork-choice').count(),8,'eight project cards missing')
            const cards=await page.locator('.fork-choice').evaluateAll(elements=>elements.map(el=>{
              const a=el.getBoundingClientRect(),b=el.querySelector('.fork-title').getBoundingClientRect()
              return {left:a.left,right:a.right,titleLeft:b.left,titleRight:b.right}
            }))
            for(const c of cards)assert.ok(c.titleLeft>=c.left&&c.titleRight<=c.right,'card title escapes its card')
          }
          entry.pages.push({path,...result})
          if(result.problems.length)report.failures.push({viewport:viewport.name,path,problems:result.problems})
          if(path==='/projets')entry.menu=await menu(page)
          if(process.env.RESPONSIVE_CAPTURE&&viewport.name==='phone-small'&&path==='/projets/iagile-formations-a-l-ia')await proof(page,'small-project')
          if(process.env.RESPONSIVE_CAPTURE&&viewport.name==='phone'&&path==='/contact'){
            await page.locator('.portfolio-contact-form').scrollIntoViewIfNeeded()
            await proof(page,'phone-contact')
          }
        }catch(error){report.failures.push({viewport:viewport.name,path,error:error.message})}
      }
      if(errors.length)report.failures.push({viewport:viewport.name,errors})
      console.log('RESPONSIVE_VIEWPORT',JSON.stringify({viewport:viewport.name,pages:entry.pages.length,failures:report.failures.filter(f=>f.viewport===viewport.name)}))
    }finally{report.viewports.push(entry);await page.close()}
  }

  for(const name of ['phone','phone-landscape','tablet','tablet-landscape']){
    const viewport=viewports.find(v=>v.name===name)
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},hasTouch:true})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    try{
      await visit(page,'/')
      await page.waitForFunction(()=>window.__portfolioFlight?.version==='continuous-network-1',null,{timeout:45000})
      const result=await layout(page)
      assert.deepEqual(result.problems,[],'real WebGL home layout: '+JSON.stringify(result.problems))
      if(process.env.RESPONSIVE_CAPTURE)await proof(page,name+'-hero')
      await menu(page)
      await page.locator('.header-menu-toggle').click()
      await page.waitForTimeout(650)
      if(process.env.RESPONSIVE_CAPTURE)await proof(page,name+'-menu')
      await page.keyboard.press('Escape')
      await page.locator('.navigation-drawer').waitFor({state:'hidden'})
      await page.locator('#works .fork-choice').first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(700)
      if(process.env.RESPONSIVE_CAPTURE&&['phone','tablet-landscape'].includes(name))await proof(page,name+'-cards')
      assert.deepEqual(errors,[],'WebGL JavaScript errors')
      const flight=await page.evaluate(()=>window.__portfolioFlight)
      assert.ok(flight.minimumWallClearance>2.3,'real camera touches the wall')
      report.webgl.push({viewport:name,clearance:flight.minimumWallClearance})
      console.log('RESPONSIVE_WEBGL_PASS',name)
    }catch(error){report.failures.push({viewport:name,mode:'webgl',error:error.message})}
    finally{await page.close()}
  }
}finally{
  await writeFile('test-output/responsive-layout.json',JSON.stringify(report,null,2))
  await browser?.close();server?.kill('SIGTERM')
}
console.log('RESPONSIVE_LAYOUT_RESULT',JSON.stringify({viewports:report.viewports.length,pages:report.viewports.reduce((n,v)=>n+v.pages.length,0),webgl:report.webgl.length,failures:report.failures}))
assert.equal(report.failures.length,0,'responsive layout audit failed; see responsive-layout.json')
