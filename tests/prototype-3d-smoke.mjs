import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

const url='http://127.0.0.1:4174/Cosme-Collomb/prototype-3d/'
const server=spawn(process.execPath,
  ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174','--strictPort'],
  {stdio:'inherit'})
let browser=null
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function waitForServer(){
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw new Error('Preview server exited before ready')
    try{const response=await fetch(url);if(response.ok)return}catch{}
    await sleep(400)
  }
  throw new Error('Compiled 3D demo did not become reachable: '+url)
}
async function screenshot(page,name){
  try{
    const filepath='test-output/3d-'+name+'.jpg'
    const bytes=await page.screenshot({path:filepath,type:'jpeg',quality:50,timeout:9000})
    console.log('3D screenshot:',filepath,bytes.length,'bytes')
    // Small annotated samples let the finished scene, the five-way fork
    // and the growing 3D bridge be inspected visually before publication.
    const encoded=(await page.screenshot({
      type:'jpeg',quality:22,timeout:9000
    })).toString('base64')
    const tag=name.replace(/[^a-z0-9]/gi,'_').toUpperCase()
    console.log('PROOF_'+tag+'_JPEG_START'+encoded+'PROOF_'+tag+'_JPEG_END')
  }catch(error){
    console.warn('Optional software-WebGL screenshot unavailable:',name,error.message)
  }
}
async function run(){
  await waitForServer()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage','--disable-gpu-sandbox'
  ]})
  const page=await browser.newPage({viewport:{width:1060,height:680}})
  const errors=[]
  page.on('pageerror',error=>{errors.push(String(error));console.error('DEMO JS PAGE ERROR:',String(error))})
  page.on('console',message=>{
    if(message.type()==='error')console.error('DEMO CONSOLE ERROR:',message.text())
  })
  page.on('requestfailed',request=>{
    console.error('DEMO FAILED REQUEST:',request.url(),request.failure()?.errorText)
  })
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})
  console.log('3D demo HTTP:',response.status(),'loaded URL:',page.url())
  await page.waitForFunction(()=>Boolean(window.__prototypeProof),null,{timeout:45000})
  const boot=await page.evaluate(()=>{
    const p=window.__prototypeProof
    return {state:p.state,collisions:p.collisions,pathLength:p.pathLength,
      start:p.startingPoint,end:p.destinationPoint,pieces:p.totalPieces}
  })
  assert.equal(boot.state,'idle')
  assert.equal(boot.collisions,0,
    'SWEPT COLLISION: the actual centreline intersects the 3D floor, rail or wall')
  assert.equal(boot.pieces,64)
  assert.ok(boot.pathLength>45&&boot.pathLength<125)
  await screenshot(page,'carrefour')
  console.log('3D proof initial intersection:',JSON.stringify(boot))
  await page.locator('#start').click()
  await page.waitForFunction(()=>window.__prototypeProof?.constructed>=8,null,{timeout:30000})
  const build=await page.evaluate(()=>{
    const p=window.__prototypeProof
    return {stage:p.state,constructed:p.constructed,position:p.camera,u:p.u}
  })
  assert.equal(build.stage,'constructing')
  assert.ok(Math.hypot(...build.position.map((v,i)=>v-boot.start[i]))<.00001,
    'Camera moved or teleported WHILE the bridge was under construction')
  await screenshot(page,'construction')
  await page.waitForFunction(()=>window.__prototypeProof?.state==='outbound',null,{timeout:30000})
  const fullyBuilt=await page.evaluate(()=>window.__prototypeProof.constructed)
  assert.equal(fullyBuilt,64,'Camera entered the bridge before it was fully built')
  await page.waitForFunction(()=>window.__prototypeProof?.state==='arrived',null,{timeout:100000})
  const arrived=await page.evaluate(()=>{
    const p=window.__prototypeProof
    return {position:p.camera,u:p.u,maxFrameDistance:p.maxFrameDistance,collisions:p.collisions,
      constructed:p.constructed}
  })
  assert.ok(Math.hypot(...arrived.position.map((v,i)=>v-boot.end[i]))<.001,
    'Project destination is a teleport to another location')
  assert.ok(arrived.maxFrameDistance<1.2,
    'Camera made a large single-render-frame position jump: '+arrived.maxFrameDistance)
  assert.equal(arrived.collisions,0)
  assert.equal(arrived.constructed,64)
  await screenshot(page,'arrived')
  console.log('3D journey physically arrived:',JSON.stringify(arrived))
  await page.locator('#return').click()
  await page.waitForFunction(()=>window.__prototypeProof?.state==='returning',null,{timeout:30000})
  await page.waitForFunction(()=>window.__prototypeProof?.state==='finished',null,{timeout:100000})
  const finish=await page.evaluate(()=>{
    const p=window.__prototypeProof
    return {position:p.camera,start:p.startingPoint,constructed:p.constructed,
      u:p.u,collisions:p.collisions,maxFrameDistance:p.maxFrameDistance,
      stages:p.samples.reduce((a,b)=>(a[b.stage]=(a[b.stage]||0)+1,a),{})}
  })
  const startDelta=Math.hypot(...finish.position.map((v,i)=>v-boot.start[i]))
  assert.ok(startDelta<.00001,'Return does not end at the IDENTICAL original crossroads')
  assert.equal(finish.u,0,'Return route did not reach u=0')
  assert.equal(finish.collisions,0)
  assert.equal(finish.constructed,64,'Bridge vanished while visitor was still inside')
  assert.ok(finish.maxFrameDistance<1.2,
    'Physical return includes one-frame teleport '+finish.maxFrameDistance)
  assert.equal(await page.locator('#start').isVisible(),true)
  assert.deepEqual(errors,[],'Uncaught JavaScript exception in the 3D prototype')
  await screenshot(page,'retour-carrefour')
  console.log('3D proof back at EXACT same junction:',JSON.stringify({
    returnedDistance:startDelta,maxFrameDistance:finish.maxFrameDistance,
    totalBuilt:finish.constructed,stages:finish.stages
  }))
  console.log('3D PROTOTYPE SMOKE PASSED: real bridge, zero centerline collisions, no teleport, outbound and same-route return')
}
try{
  await run()
}catch(error){
  console.error('3D PROTOTYPE SMOKE FAILED:',error)
  process.exitCode=1
}finally{
  await browser?.close()
  server.kill('SIGTERM')
}
