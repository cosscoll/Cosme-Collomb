import { PROJECTS_WITH_SLUGS as projects } from '../src/data/projects.js'
const targets=projects.flatMap(p=>[{project:p.title,type:'site',url:p.link},{project:p.title,type:'github',url:p.repoLink}].filter(r=>r.url))
const results=await Promise.all(targets.map(async entry=>{
 try{
  const start=Date.now()
  const r=await fetch(entry.url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(18000)})
  const body=await r.text()
  const title=body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()?.slice(0,90)||''
  const errorPage=/There isn't a GitHub Pages site here|404: Not Found|Page not found/i.test(body.slice(0,3000))
  return {...entry,HTTP:r.status,final:r.url,size:body.length,title,ok:r.ok&&body.length>180&&!errorPage,ms:Date.now()-start}
 }catch(e){return {...entry,ok:false,error:String(e.message)}}
}))
for(const r of results)console.log('LINK_AUDIT',JSON.stringify(r))
console.log('LINK_AUDIT_TOTAL',JSON.stringify({projects:projects.length,links:targets.length,ok:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length}))
if(results.some(r=>!r.ok))process.exitCode=1
