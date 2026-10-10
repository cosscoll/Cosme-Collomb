import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
const site='http://127.0.0.1:4178/Cosme-Collomb/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178','--strictPort'],{stdio:'inherit'})
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function ready(){
 for(let i=0;i<90;i++){try{const r=await fetch(site);if(r.ok)return}catch{};await sleep(400)}
 throw Error('Vite preview failed')
}
let browser
try{
 await ready()
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-gpu-sandbox']})
 const page=await browser.newPage({viewport:{width:390,height:844}})
 const errors=[]
 page.on('pageerror',error=>errors.push(String(error)))
 await page.goto(site+'#/projets/ouvertures-d-echecs-en-3d',{waitUntil:'domcontentloaded',timeout:60000})
 await page.locator('.journey-entrance h1').waitFor({state:'visible',timeout:60000})
 await page.waitForFunction(()=>window.__portfolioFlight?.mode==='detail',{timeout:60000})
 // Simulate an impatient visitor immediately scrolling to the very bottom.
 // The page must wait for the camera to traverse the complete return corridor.
 await page.waitForTimeout(1300)
 await page.evaluate(()=>{
   window.__loopFrames=[]
   window.__loopTimer=setInterval(()=>{
     const f=window.__portfolioFlight
     if(!f)return
     window.__loopFrames.push({at:performance.now(),...f})
   },45)
   window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})
 })
 await page.waitForFunction(()=>{
  const f=window.__portfolioFlight
  return f?.mode==='projects'&&!f.transiting&&Math.abs(f.t-f.forkTarget)<.005
 },null,{timeout:115000})
 const frames=await page.evaluate(()=>{
   clearInterval(window.__loopTimer)
   return window.__loopFrames||[]
 })
 console.log('FORWARD_LOOP_FRAMES',frames.length)
 const moving=frames.filter(f=>f.mode==='detail'&&!f.transiting)
 assert.ok(moving.length>35,'Actual loop camera was not tracked')
 let worstReverse=1,reverseCount=0,worstTeleport=0,worstSpin=0
 for(let i=1;i<moving.length;i++){
   const prev=moving[i-1],next=moving[i]
   assert.ok(next.t+1e-5>=prev.t,'Project tunnel travelled BACKWARDS in spline coordinate')
   const dx=next.position.map((v,k)=>v-prev.position[k])
   const step=Math.hypot(...dx)
   if(step<.014)continue
   const forward=next.direction
   const dot=dx.reduce((sum,v,k)=>sum+v*forward[k],0)/(step*Math.hypot(...forward))
   worstReverse=Math.min(worstReverse,dot)
   if(dot<-.1)reverseCount++
   // Samples come from a timer, not every WebGL frame. Two rendered frames
   // can legitimately land between snapshots on slow software GPUs. Bound
   // actual metres per second rather than the arbitrary sampled distance.
   const elapsedMs=Math.max(1,next.at-prev.at)
   const physicalLimit=Math.max(.95,15*elapsedMs/1000+.40)
   assert.ok(step<=physicalLimit,
     'Camera teleported '+step.toFixed(2)+'m in '+elapsedMs.toFixed(0)+
     'ms (safe limit '+physicalLimit.toFixed(2)+'m)')
   worstTeleport=Math.max(worstTeleport,step)
   const qa=prev.quaternion,qb=next.quaternion
   const inner=Math.min(1,Math.abs(qa.reduce((sum,v,k)=>sum+v*qb[k],0)))
   const angle=2*Math.acos(inner)
   worstSpin=Math.max(worstSpin,angle)
   assert.ok(angle<.65,'Camera snapped orientation by '+(angle*180/Math.PI).toFixed(1)+'°')
 }
 assert.equal(reverseCount,0,'POV repeatedly faces backward while moving along loop')
 assert.ok(moving.at(-1).t>.955,'The return corridor never reached the open fork chamber')
 const approach=frames.filter(f=>f.transiting &&
   f.from==='/projets/ouvertures-d-echecs-en-3d' &&
   f.to==='/projets' && f.progress!==null && f.progress<.52)
 assert.ok(approach.length>=4,'No physical return transition was rendered')
 assert.ok(approach[0].departureT>.95,
   'Return flight teleported to the project entrance instead of taking its captured eye position')
 for(let i=1;i<approach.length;i++)
   assert.ok(approach[i].sampleT+.00001>=approach[i-1].sampleT,
     'Return flight travelled backward toward the old project entrance')
 const start=approach[0].position,end=approach.at(-1).position
 assert.ok(Math.hypot(...start.map((v,k)=>v-end[k]))>2.5,
   'Camera turned in place at the junction instead of moving into the chamber')
 assert.deepEqual(errors,[],'Unexpected JavaScript errors')
 console.log('FORWARD_LOOP_RESULT',JSON.stringify({
   frames:frames.length,detailFrames:moving.length,reverseCount,
   worstForwardDot:worstReverse,worstStepMetres:worstTeleport,
   maximumFrameSpinDegrees:worstSpin*180/Math.PI,
   returnedToFork:true
 }))
}finally{
 await browser?.close()
 server.kill('SIGTERM')
}
