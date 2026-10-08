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
