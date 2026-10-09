import { renameSync,existsSync,readFileSync } from 'node:fs'
const source='dist/index.source.html'
const output='dist/index.html'
if(!existsSync(source))throw new Error('Vite did not generate '+source)
renameSync(source,output)
const html=readFileSync(output,'utf8')
if(!html.includes('/Cosme-Collomb/assets/'))
  throw new Error('Production HTML has no compiled JS/CSS assets')
if(html.includes('src="/src/main.jsx"'))
  throw new Error('Production HTML still references uncompiled React source')
console.log('Built production entry:',output)
const prototypeSource='dist/prototype-3d/index.source.html'
const prototypeOutput='dist/prototype-3d/index.html'
if(!existsSync(prototypeSource))
  throw new Error('3D proof of concept was not compiled: '+prototypeSource)
renameSync(prototypeSource,prototypeOutput)
const demoHtml=readFileSync(prototypeOutput,'utf8')
if(!demoHtml.includes('/Cosme-Collomb/assets/'))
  throw new Error('3D demo is missing its compiled JavaScript and CSS')
if(demoHtml.includes('src="/src/prototype-3d/main.js"'))
  throw new Error('3D demo still points to uncompiled source')
console.log('Built isolated 3D proof:',prototypeOutput)
const v2Source='dist/prototype-3d/v2/index.source.html'
const v2Output='dist/prototype-3d/v2/index.html'
if(!existsSync(v2Source))throw Error('Five-loop 3D V2 did not compile')
renameSync(v2Source,v2Output)
const v2Html=readFileSync(v2Output,'utf8')
if(!v2Html.includes('/Cosme-Collomb/assets/')||
  v2Html.includes('src="/src/prototype-3d/v2.js"'))
  throw Error('Five-loop demo does not load compiled assets')
console.log('Built five-loop V2 proof:',v2Output)
