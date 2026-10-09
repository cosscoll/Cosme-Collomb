import { chromium } from 'playwright'
const base = 'https://cosscoll.github.io/Cosme-Collomb/'
const marker = 'PORTFOLIO-NATIVE-WEB3FORMS-' + Date.now()
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--enable-unsafe-swiftshader']})
try{
 const page=await browser.newPage({viewport:{width:1100,height:800}})
 page.on('console',msg=>{if(msg.type()==='error')console.log('BROWSER_ERROR',msg.text().slice(0,350))})
 page.on('requestfailed',req=>{if(req.url().includes('web3forms'))console.log('WEB3FORMS_FAILURE',req.url(),req.failure()?.errorText)})
 page.on('response',async response=>{
    if(response.url().includes('web3forms')){
      let body='';try{body=(await response.text()).slice(0,650)}catch{}
      console.log('WEB3FORMS_NATIVE_HTTP',response.status(),response.url(),body)
    }
 })
 await page.goto(base+'?native-test='+Date.now()+'#/contact',{waitUntil:'domcontentloaded',timeout:60000})
 const form=page.locator('form[data-service="web3forms"]')
 await form.waitFor({state:'visible',timeout:60000})
 await form.locator('input[name=name]').fill('Audit technique portfolio')
 await form.locator('input[name=email]').fill('pro.collomb@gmail.com')
 await form.locator('input[name=subject]').fill(marker)
 await form.locator('textarea[name=message]').fill('Test de livraison par formulaire HTML natif, sans Javascript fetch. Référence '+marker+'.')
 console.log('NATIVE_SUBMISSION_MARKER',marker)
 await page.evaluate(()=>{
  const form=document.querySelector('form[data-service="web3forms"]')
  form.action='https://api.web3forms.com/submit'
  form.method='POST'
  form.enctype='application/x-www-form-urlencoded'
  const input=document.createElement('input')
  input.type='hidden'; input.name='redirect'
  input.value='https://cosscoll.github.io/Cosme-Collomb/#/contact'
  form.appendChild(input)
  HTMLFormElement.prototype.submit.call(form)
 })
 await page.waitForTimeout(15000)
 console.log('NATIVE_SUBMISSION_FINAL_PAGE',page.url())
 const bodyText=await page.locator('body').innerText({timeout:5000}).catch(()=>'(unavailable)')
 console.log('NATIVE_SUBMISSION_FINAL_TEXT',bodyText.slice(0,600))
} finally {await browser.close()}
