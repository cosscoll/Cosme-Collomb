import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const site='https://cosscoll.github.io/Cosme-Collomb/'
const api='https://codefreeform.com/api/contact-api/'
const marker='PORTFOLIO-FINAL-DELIVERY-'+Date.now()
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let ready=false
for(let i=1;i<=36;i++){
 try{
  const response=await fetch(site+'?release-check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)})
  assert.equal(response.status,200)
  const html=await response.text()
  const asset=html.match(/<script[^>]*src="([^"]+\.js)"/)?.[1]
  assert.ok(asset,'No public JS bundle')
  const js=await fetch(new URL(asset,site),{signal:AbortSignal.timeout(12000)})
  assert.equal(js.status,200)
  const bundle=await js.text()
  assert.ok(bundle.includes('codefreeform.com/api/contact-api/'),'Old contact provider remains visible')
  assert.ok(bundle.includes('data-service'),'Published form marker missing')
  console.log('LIVE_RELEASE_ASSET',asset)
  ready=true
  break
 }catch(e){console.log('WAIT_FOR_PUBLIC_RELEASE',i,e.message);await sleep(8000)}
}
assert.ok(ready,'CodeFreeForm is not yet visible in published HTML/JS')
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
try{
 const page=await browser.newPage({viewport:{width:1150,height:780}})
 page.on('pageerror',e=>console.error('PAGE_ERROR',e.message))
 page.on('requestfailed',r=>{if(r.url().startsWith(api))console.error('FORM_REQUEST_FAILED',r.failure()?.errorText)})
 let answer=null
 page.on('response',async r=>{if(r.url().startsWith(api)){
   answer={status:r.status(),body:await r.text().catch(()=>'')}
   console.log('PUBLIC_FORM_API',JSON.stringify(answer).slice(0,750))
 }})
 await page.goto(site+'?final-contact-check='+Date.now()+'#/contact',{waitUntil:'domcontentloaded',timeout:60000})
 const form=page.locator('form[data-service="codefreeform"]')
 await form.waitFor({state:'visible',timeout:60000})
 assert.equal(await form.getAttribute('data-submission'),'json')
 assert.equal(await form.locator('input[name=access_key]').inputValue(),'C4DE51')
 await form.locator('input[name=name]').fill('Controle final portfolio')
 await form.locator('input[name=email]').fill('pro.collomb@gmail.com')
 await form.locator('input[name=subject]').fill(marker)
 await form.locator('textarea[name=message]').fill('Message de vérification finale du formulaire publié. Identifiant : '+marker)
 await form.locator('button[type=submit]').click()
 await page.waitForFunction(()=>{
  const s=document.querySelector('form[data-service="codefreeform"] [role=status]')?.textContent||''
  return s.includes('envoyé avec succès')||s.includes('non confirmé')||s.includes('Connexion au service')
 },null,{timeout:45000})
 const status=(await form.locator('[role=status]').innerText()).trim()
 console.log('FINAL_TEST_MARKER',marker)
 console.log('FINAL_FORM_VISIBLE_STATUS',status)
 assert.match(status,/envoyé avec succès/i,'Public page did not confirm message')
 assert.equal(answer?.status,200,'API did not return HTTP 200')
 const data=JSON.parse(answer.body)
 assert.equal(data.success,true)
 assert.equal(data.email_status,'sent')
 console.log('PUBLIC_FORM_SUCCESS_CHECKED',marker)
}finally{await browser.close()}
