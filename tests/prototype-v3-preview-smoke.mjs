import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'

const url='http://127.0.0.1:4177/Cosme-Collomb/prototype-3d/v3/'
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4177','--strictPort'],{stdio:'inherit'})
let browser
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function waitPreview(){
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('Vite preview terminated')
    try{if((await fetch(url)).ok)return}catch{}
    await pause(300)
  }
  throw Error('Immersive V3 not served at '+url)
}
async function shot(page,label){
  try{
    const filename='test-output/v3-'+label+'.jpg'
    await page.screenshot({path:filename,type:'jpeg',quality:55,timeout:10000})
    console.log('V3 SCREENSHOT FILE '+filename)
    if(['interior','in-tunnel','back-at-hub'].includes(label)){
      const raw=(await page.screenshot({type:'jpeg',quality:23,timeout:10000})).toString('base64')
      const tag=label.toUpperCase().replaceAll('-','_')
      console.log('V3_IMAGE_'+tag+'_START'+raw+'V3_IMAGE_'+tag+'_END')
    }
  }catch(err){console.warn('Screenshot not available:',err.message)}
}
async function run(){
  await waitPreview()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-gpu-sandbox'
  ]})
  const page=await browser.newPage({viewport:{width:1200,height:790}})
  const errors=[]
  page.on('pageerror',e=>{errors.push(e.message);console.error('V3 runtime error:',e.message)})
  page.on('console',m=>{if(m.type()==='error')console.error('V3 console:',m.text())})
  const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(res.status(),200)
  await page.waitForFunction(()=>Boolean(window.__v3Proof),null,{timeout:60000})
  const initial=await page.evaluate(()=>{
    const p=window.__v3Proof
    return {phase:p.phase,position:p.camera,origin:p.origin,opaque:p.materialsOpaque,
      roof:p.hubRoofOpaque,atriumWalls:p.hasHubWalls,inside:p.cameraInside,
      choices:p.fiveChoices,defects:p.defects,loops:p.loops}
  })
  assert.equal(initial.phase,'idle')
  assert.equal(initial.choices,5)
  assert.ok(initial.opaque,'Tunnel walls are transparent')
  assert.ok(initial.roof,'The hub has no opaque roof')
  assert.ok(initial.atriumWalls,'Hub has no surrounding opaque walls')
  assert.ok(initial.inside,'Camera starts outside the carrefour volume')
  assert.deepEqual(initial.defects,[])
  assert.ok(Math.hypot(...initial.position.map((v,i)=>v-initial.origin[i]))<.000001)
  for(const p of initial.loops)assert.ok(Math.hypot(...p.start.map((v,i)=>v-p.end[i]))<.000001)
  console.log('V3 IMMERSIVE BOOT:',JSON.stringify({opaqueWalls:initial.opaque,closedRoof:initial.roof,
    enclosedHub:initial.atriumWalls,inside:initial.inside,choices:initial.choices}))
  await shot(page,'interior')
  await page.evaluate(()=>window.__v3Proof.speedUp(2.5))
  for(let i=0;i<1;i++){
    await page.locator('button.choice').nth(i).click()
    await page.waitForFunction(index=>window.__v3Proof?.selected===index,i,{timeout:35000})
    if(i===0){
      await page.waitForFunction(()=>window.__v3Proof?.built>=8,null,{timeout:35000})
      const constructing=await page.evaluate(()=>({phase:window.__v3Proof.phase,eye:window.__v3Proof.camera,origin:window.__v3Proof.origin}))
      assert.equal(constructing.phase,'building')
      assert.ok(Math.hypot(...constructing.eye.map((x,j)=>x-constructing.origin[j]))<.000001,
        'Eye moves before the tunnel is fully constructed')
      await shot(page,'building')
    }
    await page.waitForFunction(()=>window.__v3Proof?.phase==='travelling',null,{timeout:85000})
    const pieceCount=await page.evaluate(()=>window.__v3Proof.built)
    assert.equal(pieceCount,56,'Tunnel is still open when the camera starts moving')
    await page.waitForFunction(()=>window.__v3Proof?.phase==='travelling'&&window.__v3Proof.loopU>.33,null,{timeout:120000})
    const walls=await page.evaluate(i=>window.__v3Proof.testOcclusion(i,.38),i)
    console.log('V3 tunnel occlusion',i+1,JSON.stringify(walls))
    assert.ok(Object.values(walls).every(Boolean),
      'A visible exterior leak exists in tunnel '+(i+1)+': '+JSON.stringify(walls))
    if(i===0)await shot(page,'in-tunnel')
    await page.waitForFunction(n=>window.__v3Proof?.phase==='idle'&&window.__v3Proof.completed===n,i+1,{timeout:165000})
    const finish=await page.evaluate(()=>({p:window.__v3Proof.camera,o:window.__v3Proof.origin,
      step:window.__v3Proof.maxStep,inside:window.__v3Proof.cameraInside,
      choices:document.querySelectorAll('button.choice:not(:disabled)').length}))
    const error=Math.hypot(...finish.p.map((v,j)=>v-finish.o[j]))
    console.log('V3 finished tunnel',i+1,'return error:',error.toFixed(8),
      'maximum camera frame step:',finish.step.toFixed(4))
    assert.ok(error<1e-6,'Camera teleported upon returning to crossroads')
    assert.ok(finish.step<.53,'Camera leaps more than 53cm in one frame')
    assert.ok(finish.inside,'Camera exits the real interior volume')
    assert.equal(finish.choices,5,'Crossroads did not reopen all five selectable tunnels')
    if(i===0)await shot(page,'back-at-hub')
  }
  assert.deepEqual(errors,[],'Uncaught V3 JavaScript error')
  console.log('V3 PREVIEW SMOKE PASSED: first enclosed opaque route, no exterior visibility through roof/walls/floor, camera indoors, built before crossing, five continuous returns, zero teleports')
}
try{await run()}catch(error){console.error('V3 BROWSER TEST FAILED:',error);process.exitCode=1}
finally{await browser?.close();server.kill('SIGTERM')}
