import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

export const NAV_ITEMS=[
  {to:'/',label:'Accueil',number:'00',caption:'Revenir au début de l’exploration'},
  {to:'/projets',label:'Projets',number:'01',caption:`${PROJECTS.length} chemins à explorer`},
  {to:'/parcours',label:'Parcours',number:'02',caption:'Mon approche et mes compétences'},
  {to:'/contact',label:'Contact',number:'03',caption:'Échanger et créer ensemble'}
]

export const projectHref=(project)=>'/projets/'+project.slug

export function navigationContext(pathname='/'){
  if(pathname==='/')return {
    current:'Accueil',back:null,trail:[{to:'/',label:'Accueil'}]
  }
  if(pathname==='/projets')return {
    current:'Projets',back:{to:'/',label:'Retour à l’accueil'},
    trail:[{to:'/',label:'Accueil'},{to:'/projets',label:'Projets'}]
  }
  const project=PROJECTS.find(p=>projectHref(p)===pathname)
  if(project)return {
    current:project.title,
    back:{to:'/projets',label:'Retour aux projets'},
    trail:[
      {to:'/',label:'Accueil'},
      {to:'/projets',label:'Projets'},
      {to:pathname,label:project.title}
    ]
  }
  const page=NAV_ITEMS.find(item=>item.to===pathname || (pathname==='/experience'&&item.to==='/parcours'))
  const label=page?.label||'Accueil'
  return {
    current:label,back:{to:'/',label:'Retour à l’accueil'},
    trail:[{to:'/',label:'Accueil'},{to:pathname,label}]
  }
}
