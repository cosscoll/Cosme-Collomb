import { chromium } from 'playwright'
const base='https://cosscoll.github.io/Cosme-Collomb/'
const marker='PORTFOLIO-CODEFREEFORM-TEST-'+Date.now()
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}})
 page.on('response',async res=>{if(res.url().includes('codefreeform.com/api/contact-api')) {
  let body=''; try{body=(await res.text()).slice(0,800)}catch{}
  console.log('FORM_API_RESPONSE',res.status(),res.url(),body)
 }})
 page.on('requestfailed',r=>{if(r.url().includes('codefreeform'))console.log('FORM_API_NETWORK_ERROR',r.failure()?.errorText)})
 page.on('console',m=>{if(m.type()==='error')console.log('BROWSER_ERROR',m.text().slice(0,200))})
 await page.goto(base+'?form-check='+Date.now()+'#/contact',{waitUntil:'domcontentloaded',timeout:60000})
 const form=page.locator('form.portfolio-contact-form')
 await form.waitFor({state:'visible',timeout:45000})
 await form.locator('input[name=name]').fill('Portfolio automated integration check')
 await form.locator('input[name=email]').fill('pro.collomb@gmail.com')
 await form.locator('input[name=subject]').fill(marker)
 await form.locator('textarea[name=message]').fill('Test de réception pour le portfolio Cosme Collomb. Référence de contrôle '+marker+'.')
 console.log('MESSAGE_TEST_MARKER',marker)
 await page.evaluate(()=>{
  const form=document.querySelector('form.portfolio-contact-form')
  form.action='https://codefreeform.com/api/contact-api/'
  form.method='POST'
  form.enctype='application/x-www-form-urlencoded'
  let field=form.querySelector('input[name=access_key]')
  if(!field){field=document.createElement('input');field.type='hidden';field.name='access_key';form.appendChild(field)}
  field.value='C4DE51'
  HTMLFormElement.prototype.submit.call(form)
 })
 await page.waitForTimeout(8500)
 console.log('FORM_FINAL_URL',page.url())
 const bodyText=await page.locator('body').innerText({timeout:5000}).catch(()=>'')
 console.log('FORM_FINAL_CONTENT',bodyText.slice(0,750))
}finally{await browser.close()}
