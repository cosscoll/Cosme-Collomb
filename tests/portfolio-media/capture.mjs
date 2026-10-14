import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {mkdir,writeFile} from 'node:fs/promises'
import {spawn,spawnSync} from 'node:child_process'
import {browserOptions} from '../browser-options.mjs'
await mkdir('test-output/portfolio-media',{recursive:true})
const root='test-output/portfolio-media'
const browser=await chromium.launch(browserOptions)
const report=[]
async function capture(name,url,actions,{video=true}={}){
 const context=await browser.newContext({viewport:{width:1280,height:800},...(video?{recordVideo:{dir:root+'/raw',size:{width:1280,height:800}}}:{})})
 const page=await context.newPage();page.setDefaultTimeout(22000)
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort())
 const started=Date.now()
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});assert.ok(response.ok())
  await page.waitForTimeout(3500)
  if(actions)await actions(page)
  await page.waitForTimeout(1500)
  await page.screenshot({path:root+'/'+name+'.jpg',type:'jpeg',quality:80})
  if(video)await page.waitForTimeout(Math.max(1500,32000-(Date.now()-started)))
  report.push({name,url,status:response.status(),title:await page.title(),video})
 }finally{
  const recording=page.video();await context.close()
  if(video){const path=await recording.path();const r=spawnSync('ffmpeg',['-y','-ss','2','-i',path,'-t','30','-vf','fps=10,scale=960:600','-an','-c:v','libx264','-crf','34','-preset','slow','-movflags','+faststart',root+'/'+name+'.mp4'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr.slice(-800))}
 }
 console.log('REAL PROJECT MEDIA',name)
}
const pause=p=>p.waitForTimeout(1800)
try{
 await capture('chess-demo','https://cosscoll.github.io/Chess-Openings/',async p=>{await p.locator('.opening-card').first().click();await pause(p);for(let i=0;i<4;i++){await p.locator('#next-move').click();await pause(p)}})
 await capture('poker-demo','https://cosscoll.github.io/PokerStats/',async p=>{for(let i=0;i<2;i++){await p.locator('#hero-slots .card-slot').nth(i).click();await p.locator('.picker-card-btn:not([disabled])').first().click();await pause(p)}for(let i=0;i<3;i++){await p.locator('#board-slots-flop .card-slot').nth(i).click();await p.locator('.picker-card-btn:not([disabled])').nth(i+2).click();await pause(p)}})
 await capture('beer-demo','https://cosscoll.github.io/MyBeer/',async p=>{for(let i=0;i<3;i++){await p.locator('.step.active [role="radio"]').last().click();await pause(p);await p.locator('.step.active [data-action="next"]').click();await pause(p)}await p.locator('#catalog-open').click();await pause(p)})
 await capture('eurorare-demo','https://cosscoll.github.io/Is-my-coin-rare-/pieces.html',async p=>{await p.getByRole('button',{name:'France',exact:true}).first().click();await pause(p);await p.evaluate(()=>window.scrollTo({top:500,behavior:'smooth'}));await pause(p)})
 await capture('ifsi-demo','https://cosscoll.github.io/Berenice.ifsy/quiz.html',async p=>{await p.locator('#quick-start').click();await pause(p);await p.locator('.quiz-choice').first().click();await pause(p);await p.locator('#quiz-session').scrollIntoViewIfNeeded()})
 await capture('iagile-demo','https://cosscoll.github.io/IAgile/formations/sites-web-3d.html',async p=>{for(const y of [300,650,1000]){await p.evaluate(y=>window.scrollTo({top:y,behavior:'smooth'}),y);await pause(p)}})
 await capture('tcg-demo','https://cosscoll.github.io/TCG-Thomas-Deseur/prototype-booster/',async p=>{await p.locator('#start').click();await pause(p);for(let i=0;i<4;i++){await p.locator('#next').click();await pause(p)}})
 // These historical source versions are rendered locally without publication.
 const oldChess=spawn('python3',['-m','http.server','4188','--directory','/tmp/chess-before'],{stdio:'ignore'})
 const oldBeer=spawn('python3',['-m','http.server','4189','--directory','/tmp/beer-before'],{stdio:'ignore'})
 try{await new Promise(r=>setTimeout(r,1500));await capture('chess-before','http://127.0.0.1:4188/',async p=>{await p.locator('.opening-card').first().click();await pause(p)},{video:false});await capture('beer-before','http://127.0.0.1:4189/',null,{video:false})}finally{oldChess.kill();oldBeer.kill()}
}finally{await writeFile(root+'/report.json',JSON.stringify(report,null,2));await browser.close()}
assert.equal(report.length,9)
