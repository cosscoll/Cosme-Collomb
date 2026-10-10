import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const url='http://127.0.0.1:4179/Cosme-Collomb/'
const server=spawn(process.execPath,
 ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179','--strictPort'],
 {stdio:'inherit'})
let browser
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function ready(){for(let i=0;i<90;i++){try{const r=await fetch(url);if(r.ok)return}catch{}await sleep(400)}throw Error('preview did not start')}
try{
 await ready()
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage','--disable-gpu-sandbox']})
 for(const [label,width,height] of [['hero',980,640],['mobile',390,780]]){
  const page=await browser.newPage({viewport:{width,height}})
  page.on('pageerror',e=>console.error('PAGE_ERROR',label,String(e).slice(0,400)))
  await page.goto(url+'#/',{waitUntil:'domcontentloaded',timeout:60000})
  await page.waitForFunction(()=>window.__portfolioFlight?.updatedAt,{timeout:45000})
  await page.waitForTimeout(750)
  console.log('RENDERED_FLIGHT',label,JSON.stringify(await page.evaluate(()=>window.__portfolioFlight)))
  const buffer=await page.screenshot({type:'jpeg',quality:43})
  console.log('SNAPSHOT_JPEG_'+label.toUpperCase()+'='+buffer.toString('base64'))
  if(label==='hero'){
   await page.evaluate(()=>window.scrollTo({top:Math.min(900,document.documentElement.scrollHeight-window.innerHeight),behavior:'instant'}))
   await page.waitForTimeout(2300)
   const next=await page.screenshot({type:'jpeg',quality:43})
   console.log('SNAPSHOT_JPEG_SCROLLED='+next.toString('base64'))
  }
  await page.close()
 }
}finally{await browser?.close();server.kill('SIGTERM')}
