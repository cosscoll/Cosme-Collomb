import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] })
try {
 const page = await browser.newPage({ viewport: {width: 1100, height: 830}})
 await page.goto('https://formspree.io/create', {waitUntil:'domcontentloaded',timeout:45000})
 await page.waitForTimeout(2200)
 console.log('FORM_PROVIDER_URL',page.url())
 console.log('FORM_PROVIDER_TITLE',await page.title())
 console.log('FORM_PROVIDER_INPUTS',JSON.stringify(await page.locator('input').evaluateAll(els=>els.map(e=>({type:e.type,name:e.name,placeholder:e.placeholder,id:e.id,required:e.required}))).catch(()=>[])))
 console.log('FORM_PROVIDER_BUTTONS',JSON.stringify((await page.getByRole('button').allTextContents()).slice(0,20)))
 console.log('FORM_PROVIDER_TEXT',((await page.locator('body').innerText()).slice(0,1700)).replace(/\s+/g,' '))
} finally {await browser.close()}
