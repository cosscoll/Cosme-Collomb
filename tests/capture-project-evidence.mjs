import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir,writeFile } from 'node:fs/promises'
import { browserOptions } from './browser-options.mjs'
await mkdir('test-output/project-evidence',{recursive:true})
const options={...browserOptions}
if(process.env.HTTPS_PROXY)options.proxy={server:process.env.HTTPS_PROXY}
const browser=await chromium.launch(options)
const report=[]
async function visit(name,url,after) {
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1})
 page.setDefaultTimeout(20000)
 await page.route(/fonts\.(googleapis|gstatic)\.com/,route=>route.abort())
 try {
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000})
  assert.ok(response?.ok(),'HTTP '+response?.status()+' '+url)
  await page.waitForTimeout(4500)
  if(after)await after(page)
  await page.evaluate(()=>document.fonts.ready)
  await page.waitForTimeout(1000)
  await page.screenshot({path:'test-output/project-evidence/'+name+'.jpg',type:'jpeg',quality:76,timeout:40000})
  report.push({name,url,status:response.status(),title:await page.title()})
  console.log('PROJECT EVIDENCE CAPTURED',name,response.status())
 } finally {await page.close()}
}
try {
 await visit('chess-home','https://cosscoll.github.io/Chess-Openings/')
 await visit('chess-board','https://cosscoll.github.io/Chess-Openings/',async p=>{
  await p.locator('.opening-card').first().click()
  await p.locator('.opening-page.is-active').waitFor()
  await p.waitForTimeout(1800)
 })
 await visit('poker-table','https://cosscoll.github.io/PokerStats/',async p=>{
  for(let i=0;i<2;i++){
   await p.locator('#hero-slots .card-slot').nth(i).click()
   await p.locator('.picker-card-btn:not([disabled])').first().click()
  }
  await p.waitForTimeout(1000)
  await p.evaluate(()=>window.scrollTo(0,0))
 })
 await visit('beer-builder','https://cosscoll.github.io/MyBeer/')
 await visit('beer-catalogue','https://cosscoll.github.io/MyBeer/',async p=>{
  await p.locator('#catalog-open').click()
  await p.locator('#catalog-overlay').waitFor({state:'visible'})
 })
 await visit('eurorare-home','https://cosscoll.github.io/Is-my-coin-rare-/')
 await visit('eurorare-catalogue','https://cosscoll.github.io/Is-my-coin-rare-/pieces.html')
 await visit('ifsi-home','https://cosscoll.github.io/Berenice.ifsy/')
 await visit('ifsi-courses','https://cosscoll.github.io/Berenice.ifsy/etudier.html')
 await visit('iagile-home','https://cosscoll.github.io/IAgile/')
 await visit('iagile-course','https://cosscoll.github.io/IAgile/formations/sites-web-3d.html')
 await visit('tcg-collection','https://cosscoll.github.io/TCG-Thomas-Deseur/collection-validee/')
 await visit('tcg-prototype','https://cosscoll.github.io/TCG-Thomas-Deseur/prototype-booster/')
 const floot=await fetch('https://budget-illimite-tcg.floot.app/',{signal:AbortSignal.timeout(20000)})
 assert.ok(floot.ok,'Floot public homepage HTTP '+floot.status)
 report.push({name:'tcg-game',url:'https://budget-illimite-tcg.floot.app/',status:floot.status})
} finally {
 await writeFile('test-output/project-evidence/report.json',JSON.stringify(report,null,2))
 await browser.close()
}
assert.equal(report.length,14)
console.log('PROJECT EVIDENCE RESULT',JSON.stringify({captures:13,publicLinks:14}))
