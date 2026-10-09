import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../src/data/projects.js'
import { PROJECT_STORIES } from '../src/data/projectStories.js'

const base = 'https://cosscoll.github.io/Cosme-Collomb/'
const facts = []
const alerts = []
const requestTimeout = 22000

assert.equal(PROJECTS.length, 8, 'Project count unexpectedly changed')
assert.equal(PROJECT_STORIES.length, PROJECTS.length, 'Each project must have its own narrative')
assert.equal(new Set(PROJECTS.map(p=>p.slug)).size, PROJECTS.length,'Duplicate project slugs')

let currentSiteReady = false
for(let attempt=1;attempt<=32;attempt++){
 try{
  const res=await fetch(base+'?content-audit='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)})
  assert.equal(res.status,200)
  const html=await res.text()
  const assets=[...html.matchAll(/(?:src|href)="([^"]+\\.js)"/g)].map(m=>m[1])
  assert.ok(assets.length>=2,'Published site is missing JS assets')
  const fetched=await Promise.all(assets.map(async path=>{
   const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(12000)})
   assert.equal(response.status,200,'Missing public JS '+path)
   return {path,body:await response.text()}
  }))
  assert.ok(fetched.some(a=>a.body.includes('TCG Deseur')),'Updated project module not public yet')
  assert.ok(fetched.some(a=>a.body.includes('codefreeform.com/api/contact-api/')),'Unexpected contact release')
  console.log('AUDITED_PUBLIC_RELEASE',fetched.map(a=>a.path).join(','))
  currentSiteReady = true
  break
 }catch(error){
  console.log('WAITING_FOR_UPDATED_PAGES',attempt,String(error.message).slice(0,170))
  await new Promise(resolve=>setTimeout(resolve,7000))
 }
}
assert.ok(currentSiteReady,'Latest project text not published in GitHub Pages')

const launchOptions={headless:true,channel:'chrome',args:['--no-sandbox','--disable-dev-shm-usage']}
const browser = await chromium.launch(launchOptions)
try {
 const desktop = await browser.newPage({viewport:{width:1370,height:850}})
 const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1})
 for (const page of [desktop,mobile]) {
   // Text and link integrity audit intentionally runs without WebGL to avoid
   // GPU crashes masking DOM failures. Separate 3D tests cover the immersive path.
   await page.addInitScript(() => {
     const orig = HTMLCanvasElement.prototype.getContext
     HTMLCanvasElement.prototype.getContext = function(kind,...args) {
       if (kind==='webgl'||kind==='webgl2'||kind==='experimental-webgl') return null
       return orig.call(this,kind,...args)
     }
   })
 }
 const pages=[['desktop',desktop],['mobile',mobile]]
 for(const [mode,page] of pages){
   const errors=[]
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,250)))
   await page.goto(base+'?audit='+Date.now()+'#/projets',{waitUntil:'domcontentloaded',timeout:60000})
   await page.locator('.fork-choice').first().waitFor({state:'visible',timeout:60000})
   const choices=await page.locator('.fork-choice').count()
   assert.equal(choices, PROJECTS.length, 'Wrong number of project choices on '+mode)
   for(let i=0;i<PROJECTS.length;i++){
     const p=PROJECTS[i],story=PROJECT_STORIES[i]
     const link=page.locator('.fork-choice').nth(i)
     const cardTitle=(await link.locator('.fork-title').innerText()).trim().split('\n')[0].trim()
     const expectedHash='#/projets/'+p.slug
     const href=await link.getAttribute('href')
     assert.equal(href,expectedHash,'Broken internal project route '+p.title)
     assert.equal(cardTitle,p.title,'Wrong project title in list '+p.title)
     assert.ok(p.description?.trim().length>=70,'Insufficient description for '+p.title)
     for(const field of ['introduction','idea','experience']) assert.ok(story[field]?.trim().length>35, 'Missing narrative '+p.title+': '+field)
     assert.ok(story.features?.length>=3,'Missing features for '+p.title)
     facts.push({type:'card',mode,project:p.title,href,descriptionChars:p.description.length})
   }
   for(const p of PROJECTS){
     const story=PROJECT_STORIES[PROJECTS.findIndex(x=>x.slug===p.slug)]
     await page.goto(base+'?audit='+Date.now()+'#/projets/'+p.slug,{waitUntil:'domcontentloaded',timeout:60000})
     await page.locator('.journey-entrance h1').waitFor({state:'visible',timeout:60000})
     const heading=(await page.locator('.journey-entrance h1').innerText()).trim()
     assert.equal(heading,p.title,'Wrong project heading '+p.slug)
     for(const sentence of [story.introduction,story.idea,story.experience,p.description])
       assert.ok(await page.getByText(sentence,{exact:true}).count()>=1,'Missing section copy: '+p.slug)
     for(const f of story.features)
       assert.ok(await page.getByText(f,{exact:true}).count()>=1,'Missing feature: '+p.slug+' '+f)
     const external=page.locator('a.detail-primary')
     const repo=page.locator('.journey-actions a.underlined-link')
     assert.equal(await external.count(),p.link?1:0,'External CTA mismatch '+p.slug)
     assert.equal(await repo.count(),p.repoLink?1:0,'Repo CTA mismatch '+p.slug)
     if(p.link)assert.equal(await external.getAttribute('href'),p.link)
     if(p.repoLink)assert.equal(await repo.getAttribute('href'),p.repoLink)
     const viewport=await page.evaluate(()=>({
       bodyWidth:document.body.scrollWidth,
       windowWidth:window.innerWidth,
       headingVisible:!!document.querySelector('.journey-entrance h1')
     }))
     // An overflowing 3D decorative layer is tolerated within 20 px, but
     // wider content overflow indicates a layout defect.
     if(viewport.bodyWidth>viewport.windowWidth+20) alerts.push({type:'overflow',project:p.title,mode,...viewport})
     facts.push({type:'detail',mode,project:p.title,heading,live:p.link||'not published',github:p.repoLink||'not published',horizontalOverflow:viewport.bodyWidth-viewport.windowWidth})
   }
   if(errors.length)alerts.push({type:'browser-errors',mode,errors})
 }
 const targetUrls=[...new Set(PROJECTS.flatMap(p=>[p.link,p.repoLink]).filter(Boolean))]
 for(const url of targetUrls){
   const started=Date.now()
   try {
     const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(requestTimeout),headers:{'User-Agent':'Mozilla/5.0 (portfolio-quality-audit)' }})
     const text=await response.text()
     const title=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g,' ').slice(0,95)||null
     const good=response.ok&&text.length>200&&!/404: Not Found|There isn't a GitHub Pages site here/i.test(text.slice(0,2000))
     const result={type:'external-url',url,status:response.status,finalUrl:response.url,title,length:text.length,latencyMs:Date.now()-started,good}
     facts.push(result)
     if(!good)alerts.push({type:'broken-external',...result})
   } catch(e) {
     const result={type:'external-url',url,error:String(e.message),latencyMs:Date.now()-started,good:false}
     facts.push(result)
     alerts.push({type:'unreachable-external',...result})
   }
 }
 console.log('PORTFOLIO_AUDIT_FACTS_START')
 for(const r of facts) console.log(JSON.stringify(r))
 console.log('PORTFOLIO_AUDIT_ALERTS_START')
 for(const r of alerts) console.log(JSON.stringify(r))
 console.log('PORTFOLIO_AUDIT_SUMMARY',JSON.stringify({projects:PROJECTS.length,externalLinks:targetUrls.length,checks:facts.length,alerts:alerts.length}))
 if(alerts.some(x=>x.type==='broken-external'||x.type==='overflow')) process.exitCode=1
} finally {
 await browser.close()
}
