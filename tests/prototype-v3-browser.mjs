import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'

const url='http://127.0.0.1:4176/Cosme-Collomb/prototype-3d/v3/'
const server=spawn(process.execPath,[
  'node_modules/vite/bin/vite.js','preview','--host','127.0.0.1',
  '--port','4176','--strictPort'
],{stdio:'inherit'})
let browser=null
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const euclidean=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const shot=async(page,name)=>{
  try{
    await page.screenshot({path:'test-output/v3-'+name+'.jpg',type:'jpeg',
      quality:40,timeout:7000,animations:'disabled'})
    console.log('V3 image captured:',name)
  }catch(error){console.log('V3 optional screenshot unavailable:',name,error.message)}
}
async function ready(){
  for(let i=0;i<90;i++){
    if(server.exitCode!==null)throw new Error('V3 preview server exited')
    try{const r=await fetch(url);if(r.ok)return}catch{}
    await sleep(450)
  }
  throw new Error('V3 preview server unavailable')
}
async function run(){
  await ready()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage','--disable-gpu-sandbox'
  ]})
  const page=await browser.newPage({viewport:{width:960,height:630}})
  page.setDefaultTimeout(30000)
  const errors=[]
  page.on('pageerror',error=>errors.push(String(error)))
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  await page.waitForFunction(()=>window.__v3Proof?.phase==='idle',{timeout:30000})
  const origin=await page.evaluate(()=>{
    const p=window.__v3Proof
    return {
      position:p.camera,quaternion:p.quaternion,choices:p.fiveChoices,
      roof:p.hubRoofOpaque,walls:p.hasHubWalls,
      opaque:p.materialsOpaque,inside:p.cameraInside,
      loops:p.loops,defects:p.defects,version:p.version
    }
  })
  assert.equal(origin.version,'V3-immersion-opaque-interiors')
  assert.equal(origin.choices,5,'Not five gates in the original crossroads')
  assert.equal(origin.opaque,true,'Tunnel walls are transparent')
  assert.equal(origin.roof,true,'Hub roof is not opaque')
  assert.equal(origin.walls,true,'Atrium wall geometry is missing')
  assert.equal(origin.inside,true,'The camera starts outside the 3D atrium')
  assert.deepEqual(origin.defects,[],'Invalid 3D tunnel path topology')
  for(const loop of origin.loops){
    assert.ok(euclidean(loop.start,loop.end)<1e-6,
      'A route does not return to the original junction')
  }
  console.log('V3 START: all five enclosed loops join one unchanged room')
  await shot(page,'original-crossroads')
  await page.evaluate(()=>window.__v3Proof.speedUp(3))
  for(let i=0;i<5;i++){
    const start=await page.evaluate(()=>window.__v3Proof.camera)
    assert.ok(euclidean(start,origin.position)<.07,
      'Loop '+i+' did not start at exactly the same crossroads')
    const before=await page.evaluate(()=>window.__v3Proof.completed)
    const selected=await page.evaluate(i=>window.__v3Proof.selectPath(i),i)
    assert.equal(selected,true,'Could not enter project tunnel '+i)
    if(i===0){
      await page.waitForFunction(()=>window.__v3Proof.phase==='building'&&
        window.__v3Proof.built>3&&window.__v3Proof.built<55,
      null,{timeout:16000})
      const building=await page.evaluate(()=>({
        count:window.__v3Proof.built,
        camera:window.__v3Proof.camera
      }))
      assert.ok(euclidean(building.camera,origin.position)<.04,
        'The camera moves before the 3D tunnel is assembled')
      await shot(page,'actual-tunnel-construction')
    }
    // The passage is first constructed with the camera stationary, then
    // its opaque walls become available before the visitor travels inside.
    await page.waitForFunction(()=>window.__v3Proof.phase==='travelling',
      null,{timeout:35000})
    const proof=await page.evaluate(i=>({
      built:window.__v3Proof.built,
      ray:window.__v3Proof.testOcclusion(i,.44),
      wallOpaque:window.__v3Proof.materialsOpaque
    }),i)
    assert.equal(proof.built,56,'Bridge is incomplete when camera enters')
    assert.ok(proof.wallOpaque,'Bridge is transparent')
    // Floor and ceiling geometry must physically enclose the camera.
    assert.ok(proof.ray.roof&&proof.ray.floor,
      'Project '+(i+1)+' has an open roof or missing floor: '+JSON.stringify(proof.ray))
    if(i===0)await shot(page,'enclosed-project-tunnel')
    await page.waitForFunction(count=>{
      const p=window.__v3Proof
      return p.phase==='idle'&&p.completed===count+1
    },before,{timeout:75000})
    const end=await page.evaluate(()=>({
      position:window.__v3Proof.camera,
      quaternion:window.__v3Proof.quaternion,
      choices:window.__v3Proof.fiveChoices,
      maxStep:window.__v3Proof.maxStep,
      inside:window.__v3Proof.cameraInside
    }))
    const displacement=euclidean(end.position,origin.position)
    const dot=Math.min(1,Math.abs(end.quaternion.reduce((sum,v,j)=>
      sum+v*origin.quaternion[j],0)))
    const degrees=2*Math.acos(dot)*180/Math.PI
    assert.ok(displacement<.08,
      'Project '+(i+1)+' teleports back to a different crossroads: '+displacement)
    assert.ok(degrees<2.0,
      'Project '+(i+1)+' returns facing a wall: angle '+degrees)
    assert.equal(end.choices,5,'Not all five gates are usable after a trip')
    assert.equal(end.inside,true,'Camera is no longer in enclosed atrium')
    assert.ok(end.maxStep<.61,'A 3D frame moved the camera too far: '+end.maxStep)
    assert.equal(await page.locator('button.choice:enabled').count(),5,
      'A gate remained blocked after visiting project '+(i+1))
    console.log('V3 LOOP '+(i+1)+'/5 OK:',
      JSON.stringify({returnMeters:displacement,headingDegrees:degrees,
        maxFrameStep:end.maxStep,choices:end.choices}))
    if(i===0)await shot(page,'restored-five-way-fork')
  }
  assert.deepEqual(errors,[],'JavaScript exception in a 3D loop')
  console.log('V3 FULL QUALITY AUDIT PASSED: five enclosed project loops, opaque walls, visible 3D assembly, identical physical crossroads on all five returns, all five choices available, no camera teleport')
}
try{await run()}catch(error){console.error('V3 QUALITY AUDIT FAILED:',error);process.exitCode=1}
finally{await browser?.close();server.kill('SIGTERM')}
