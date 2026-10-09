import { chromium } from 'playwright'
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox','--disable-dev-shm-usage']})
try{
 const page=await browser.newPage({viewport:{width:1100,height:850}})
 await page.goto('https://codefreeform.com/',{waitUntil:'domcontentloaded',timeout:45000})
 await page.locator('#keyEmail').fill('pro.collomb@gmail.com')
 await page.getByRole('button',{name:'Generate Key'}).click()
 await page.waitForTimeout(2500)
 console.log('KEY_REQUEST_URL',page.url())
 console.log('KEY_REQUEST_PAGE_TEXT',((await page.locator('body').innerText()).slice(-2100)).replace(/\s+/g,' '))
 console.log('KEY_REQUEST_ALERTS',JSON.stringify(await page.getByRole('alert').allTextContents()))
} finally {await browser.close()}
