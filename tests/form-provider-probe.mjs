import { chromium } from 'playwright'
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}})
 await page.goto('https://codefreeform.com/',{waitUntil:'domcontentloaded',timeout:45000})
 await page.waitForTimeout(1200)
 console.log('CODEFREEFORM_URL',page.url())
 console.log('CODEFREEFORM_INPUTS',JSON.stringify(await page.locator('input').evaluateAll(els=>els.map(e=>({type:e.type,name:e.name,id:e.id,placeholder:e.placeholder}))).catch(()=>[])))
 console.log('CODEFREEFORM_BUTTONS',JSON.stringify((await page.getByRole('button').allTextContents()).slice(0,28)))
 console.log('CODEFREEFORM_TEXT',(await page.locator('body').innerText()).slice(0,1750).replace(/\s+/g,' '))
} finally {await browser.close()}
