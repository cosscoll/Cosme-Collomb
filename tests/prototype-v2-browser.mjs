import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'

const url='http://127.0.0.1:4175/Cosme-Collomb/prototype-3d/v2/'
const server=spawn(process.execPath,[
  'node_modules/vite/bin/vite.js','preview','--host','127.0.0.1',
  '--port','4175','--strictPort'
],{stdio:'inherit'})
let browser
const wait=ms=>new Promise(r=>setTimeout(r,ms))
async function serverReady(){
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('Vite preview exited unexpectedly')
    try{const result=await fetch(url);if(result.ok)return}catch{}
    await wait(350)
  }
  throw Error('Compiled V2 not served at '+url)
}
async function photo(page,part){
  try{
    const file='test-output/v2-'+part+'.jpg'
    await page.screenshot({path:file,type:'jpeg',quality:48,timeout:10000})
    console.log('V2 screenshot:',file)
    if(['carrefour','construction','premier-projet','retour'].includes(part)){
      const base64=(await page.screenshot({
        type:'jpeg',quality:22,timeout:10000
      })).toString('base64')
      console.log('V2_IMAGE_'+part.toUpperCase().replace(/-/g,'_')+'_START'+base64+'V2_IMAGE_'+part.toUpperCase().replace(/-/g,'_')+'_END')
    }
  }catch(error){console.warn('Optional V2 screenshot could not be taken:',part,error.message)}
}
async function run(){
  await serverReady()
  await mkdir('test-output',{recursive:true})
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage','--disable-gpu-sandbox'
  ]})
  const page=await browser.newPage({viewport:{width:1160,height:750}})
  page.setDefaultTimeout(80000)
  const errors=[]
  page.on('pageerror',error=>{errors.push(String(error));console.error('V2 pageerror',String(error))})
  page.on('console',message=>{if(message.type()==='error')console.error('V2 console',message.text())})
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})
  assert.equal(response.status(),200)
  await page.waitForFunction(()=>Boolean(window.__v2Proof),null,{timeout:60000})
  const init=await page.evaluate(()=>{
    const p=window.__v2Proof
    return {stage:p.stage,projects:p.projects,loops:p.loops,camera:p.camera,origin:p.original,diagnostics:p.diagnostics}
  })
  assert.equal(init.stage,'idle')
  assert.equal(init.projects.length,5)
  assert.equal(await page.locator('button.choice').count(),5)
  assert.deepEqual(init.diagnostics,[])
  for(let i=0;i<5;i++){
    const l=init.loops[i]
    assert.ok(Math.hypot(...l.start.map((n,k)=>n-l.end[k]))<.000001,
      'Project '+(i+1)+' route is not a REAL closed spatial loop')
  }
  console.log('V2 real five-way carrefour:',JSON.stringify({names:init.projects,lengths:init.loops.map(l=>l.length)}))
  await photo(page,'carrefour')
  await page.evaluate(()=>window.__v2Proof.speedUp(1.65))
  for(let project=0;project<5;project++){
    // Repeat from the identical perspective, not five independent page loads.
    const previousTrip=await page.evaluate(()=>window.__v2Proof.tripCount)
    await page.locator('button.choice').nth(project).click()
    await page.waitForFunction(i=>window.__v2Proof?.selected===i,project,{timeout:30000})
    await page.waitForFunction(()=>window.__v2Proof?.pieces>=10,null,{timeout:45000})
    if(project===0){
      const before=await page.evaluate(()=>({
        p:window.__v2Proof.camera,original:window.__v2Proof.original,
        stage:window.__v2Proof.stage,pieces:window.__v2Proof.pieces
      }))
      assert.equal(before.stage,'build')
      assert.ok(Math.hypot(...before.p.map((n,k)=>n-before.original[k]))<.00000001,
        'Camera moves while bridge is under construction')
      await photo(page,'construction')
    }
    await page.waitForFunction(()=>window.__v2Proof?.stage==='loop',null,{timeout:100000})
    const start=await page.evaluate(()=>({pieces:window.__v2Proof.pieces,camera:window.__v2Proof.camera}))
    assert.equal(start.pieces,56,'Camera entered before all 56 bridge sections existed')
    await page.waitForFunction(()=>window.__v2Proof?.stage==='loop'&&window.__v2Proof.loopU>.52,null,{timeout:150000})
    if(project===0)await photo(page,'premier-projet')
    // Require same DOM/Canvas and same world; no React route replacement.
    assert.equal(await page.locator('canvas#scene').count(),1)
    await page.waitForFunction(n=>window.__v2Proof?.stage==='idle'&&
      window.__v2Proof.tripCount===n,previousTrip+1,{timeout:160000})
    const end=await page.evaluate(()=>({
      p:window.__v2Proof.camera,o:window.__v2Proof.original,
      collisions:window.__v2Proof.collisions,step:window.__v2Proof.maxStep,
      stage:window.__v2Proof.stage,trips:window.__v2Proof.tripCount
    }))
    const distance=Math.hypot(...end.p.map((v,i)=>v-end.o[i]))
    console.log('V2 completed loop:',project+1,'returned hub camera drift:',
      distance.toFixed(8),'m, largest rendered step:',
      end.step.toFixed(3),'m, collisions:',end.collisions)
    assert.ok(distance<.000001,'Project '+project+' teleports instead of returning to hub viewpoint')
    assert.equal(end.collisions,0,'Camera crossed an opaque bridge element on project '+project)
    assert.ok(end.step<1.2,'Camera jumps more than 1.2m on a single rendered frame')
    assert.equal(await page.locator('button.choice:enabled').count(),5,
      'The original five-choice crossroads is blocked after a project')
    if(project===0)await photo(page,'retour')
  }
  assert.deepEqual(errors,[],'JavaScript error during one of five full 3D loops')
  console.log('V2 BROWSER PASSED: five selectable open paths, five distinct physical loops, construction before crossing, camera back at exactly same crossroads, no geometry intersection, no teleport, no scene swap')
}
try{await run()}catch(e){console.error('V2 BROWSER FAILED:',e);process.exitCode=1}
finally{await browser?.close();server.kill('SIGTERM')}
