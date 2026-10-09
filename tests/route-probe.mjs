import { chromium } from 'playwright'
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
const routes=[
 ['chess','ouvertures-d-echecs-en-3d'],
 ['poker','probabilites-hold-em'],
 ['beer','brasserie-virtuelle'],
 ['eurorare','eurorare'],
 ['ifsi','plateforme-ifsi-berenice'],
 ['iagile','iagile-formations-a-l-ia'],
 ['tcg','budget-illimite-tcg-thomas-deseur'],
 ['ucp','uncoupdepouce']
]
let failures=0
try{
 for(const mode of ['desktop','mobile']){
  const context=await browser.newContext({viewport:mode==='mobile'?{width:390,height:844}:{width:1280,height:820}})
  await context.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    if(type==='webgl'||type==='webgl2')return null
    return original.call(this,type,...args)
   }
  })
  for(const [name,slug] of routes){
   const page=await context.newPage()
   console.log('ROUTE_CHECK_START',mode,name)
   try{
    await page.goto('https://cosscoll.github.io/Cosme-Collomb/#/projets/'+slug,{waitUntil:'domcontentloaded',timeout:17000})
    await page.locator('.journey-entrance h1').waitFor({state:'visible',timeout:17000})
    const title=await page.locator('.journey-entrance h1').innerText()
    const internal=await page.locator('a.journey-back').getAttribute('href')
    const external=(await page.locator('a.detail-primary').count())?await page.locator('a.detail-primary').getAttribute('href'):'none'
    const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
    console.log('ROUTE_CHECK_SUCCESS',JSON.stringify({mode,name,slug,title,internal,external,width}))
   }catch(err){failures++;console.error('ROUTE_CHECK_FAIL',mode,name,err.message.slice(0,200))}
   finally{await page.close().catch(()=>{})}
  }
  await context.close()
 }
}finally{await browser.close()}
console.log('ROUTE_CHECK_RESULT',JSON.stringify({total:routes.length*2,failed:failures}))
if(failures)process.exitCode=1
