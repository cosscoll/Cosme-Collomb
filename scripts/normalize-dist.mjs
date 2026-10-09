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
