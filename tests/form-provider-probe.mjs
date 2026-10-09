import { chromium } from 'playwright'
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
try{
 const page=await browser.newPage({viewport:{width:1100,height:840}})
 await page.goto('https://www.easyformapi.com/',{waitUntil:'domcontentloaded',timeout:50000})
 await page.getByRole('button',{name:'Get Access Key'}).first().click()
 await page.waitForTimeout(1800)
 console.log('ACCESS_KEY_MODAL_URL',page.url())
 console.log('ACCESS_KEY_MODAL_INPUTS',JSON.stringify(await page.locator('input').evaluateAll(els=>els.map(e=>({type:e.type,name:e.name,id:e.id,placeholder:e.placeholder,outer:e.outerHTML.slice(0,350)})))))
 console.log('ACCESS_KEY_MODAL_BUTTONS',JSON.stringify((await page.getByRole('button').allTextContents()).slice(0,20)))
 console.log('ACCESS_KEY_MODAL_TEXT',((await page.locator('body').innerText()).slice(0,2000)).replace(/\s+/g,' '))
}finally{await browser.close()}
