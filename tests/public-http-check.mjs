import assert from 'node:assert/strict'

const site=process.env.PUBLIC_SITE
if(!site?.startsWith('https://'))throw new Error('No published Pages URL returned by GitHub')
const homepage=site.endsWith('/')?site:site+'/'
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))

let last
for(let attempt=1;attempt<=24;attempt++){
  try{
    // Static GitHub Pages hosting must serve both index.html and the actual
    // versioned JS bundle. An Actions success by itself is not sufficient.
    const response=await fetch(homepage+'?publish-check='+Date.now(),
      {headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(13000)})
    if(!response.ok)throw new Error('Public homepage HTTP '+response.status)
    const html=await response.text()
    if(!html.includes('id="root"'))throw new Error('Published homepage lacks React root')
    if(!html.includes('Cosme Collomb'))throw new Error('Wrong page served')
    const script=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].find(match=>match[1].endsWith('.js'))
    if(!script)throw new Error('Published homepage has no JavaScript bundle')
    const asset=new URL(script[1],homepage)
    const js=await fetch(asset,{signal:AbortSignal.timeout(13000)})
    if(!js.ok)throw new Error('Published JS asset HTTP '+js.status)
    const jsContent=await js.text()
    assert.ok(jsContent.length>1000,'Published JS asset unexpectedly empty')
    console.log('PUBLIC SITE VERIFIED:',homepage,'HTTP 200; JS bundle HTTP 200',jsContent.length,'bytes')
    process.exit(0)
  }catch(err){
    last=err
    console.log('Public site not yet ready',attempt+'/24:',err.message)
    await wait(3500)
  }
}
throw new Error('GitHub reported a deployment but the public website is unavailable: '+last?.message)
