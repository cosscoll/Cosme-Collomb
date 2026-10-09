import { chromium } from 'playwright'
const marker='PORTFOLIO-CODEFREEFORM-AJAX-'+Date.now()
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
try {
 const page=await browser.newPage()
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER_ERROR',msg.text().slice(0,600))})
 page.on('requestfailed',req=>{if(req.url().includes('codefreeform'))console.log('API_FAILED',req.failure()?.errorText)})
 await page.goto('https://cosscoll.github.io/Cosme-Collomb/?ajax-check='+Date.now()+'#/contact',{waitUntil:'domcontentloaded',timeout:60000})
 await page.locator('form.portfolio-contact-form').waitFor({state:'visible',timeout:45000})
 const result=await page.evaluate(async(marker)=>{
   const payload={access_key:'C4DE51',name:'Portfolio automated AJAX check',email:'pro.collomb@gmail.com',subject:marker,message:'Message test AJAX depuis le site public Cosme Collomb. Reference '+marker}
   try {
     const response=await fetch('https://codefreeform.com/api/contact-api/',{
       method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
       body:JSON.stringify(payload)
     })
     return {status:response.status,ok:response.ok,body:(await response.text()).slice(0,700)}
   }catch(err){return {networkError:String(err)}}
 },marker)
 console.log('AJAX_TEST_MARKER',marker)
 console.log('AJAX_RESULT',JSON.stringify(result))
 if(!result.ok)process.exitCode=1
}finally{await browser.close()}
