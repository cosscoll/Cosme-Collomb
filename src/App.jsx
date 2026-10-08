import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { HashRouter, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { PROJECTS_WITH_SLUGS as PROJECTS } from './data/projects.js'
import { PROJECT_STORIES } from './data/projectStories.js'
import { NAV_ITEMS, navigationContext } from './navigation/siteNavigation.js'
import './styles/rebuilt.css'

const World = lazy(() => import('./components/World.jsx'))

const routes = [
  { path: '/projets', label: 'Projets', caption: 'Un aperçu de mes réalisations', number: '01', key: 'projects' },
  { path: '/parcours', label: 'Parcours', caption: 'La réflexion derrière les idées', number: '02', key: 'experience' },
  { path: '/contact', label: 'Contact', caption: 'Et si on créait quelque chose ?', number: '03', key: 'contact' }
]

class Boundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('3D unavailable; navigation remains active.', error) }
  render() { return this.state.failed ? null : this.props.children }
}

function ScrollReset() {
  const { pathname, state } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if(pathname === '/projets' && state?.fromJourney) {
      // Framer Motion waits for the preceding page to exit before mounting.
      // Locate the actual crossroads after that transition.
      // The 3D camera is positioned at PROJECT_LOOKOUT_T when this section
      // begins, so scrolling directly to its top must produce the same pose.
      let attempts=0
      let frame=0
      const navigateToFork=()=>{
        const target=document.getElementById('project-crossroads')
        if(target)window.scrollTo({top:target.offsetTop,behavior:'instant'})
        else if(attempts++<120)frame=requestAnimationFrame(navigateToFork)
      }
      frame=requestAnimationFrame(navigateToFork)
      return ()=>cancelAnimationFrame(frame)
    }
  }, [pathname,state])
  return null
}

function Background({ pathname, hovered, transit }) {
  const bgRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [enabled, setEnabled] = useState(null)
  useEffect(() => {
    let supported = false
    try {
      const canvas = document.createElement('canvas')
      supported = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {}
    setEnabled(supported)
  }, [])
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!bgRef.current) return
        const fork = document.getElementById('junction')
        const offset = fork?.offsetTop || window.innerHeight
        const phase = Math.max(0, Math.min(1,
          (window.scrollY - offset + window.innerHeight * .38) / (window.innerHeight * .8)))
        bgRef.current.style.setProperty('--fork', pathname === '/' ? String(phase) : '1')
        bgRef.current.style.setProperty('--journey', String(
          window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)))
      })
    }
    update()
    window.addEventListener('scroll', update, {passive: true})
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  return (
    <div ref={bgRef} className="scene-backdrop" data-hovered={hovered} aria-hidden="true">
      <div className={'scene-css-art ' + (ready ? 'scene-css-art--hidden' : '')}>
        <span className="fallback-glow" />
        <span className="fallback-fold fallback-fold-one" />
        <span className="fallback-fold fallback-fold-two" />
        <span className="fallback-fold fallback-fold-three" />
        <span className="fallback-edge" />
        <span className="fallback-branch fallback-branch-left" />
        <span className="fallback-branch fallback-branch-center" />
        <span className="fallback-branch fallback-branch-right" />
      </div>
      {enabled && (
        <Boundary>
          <Suspense fallback={null}>
            <World pathname={pathname} hovered={hovered} transit={transit} onReady={() => setReady(true)} />
          </Suspense>
        </Boundary>
      )}
      <div className="scene-shading" />
    </div>
  )
}

function Header({menuOpen,setMenuOpen}) {
  const {pathname}=useLocation()
  const context=navigationContext(pathname)
  const toggleRef=useRef(null)
  const menuRef=useRef(null)

  useEffect(()=>{
    if(!menuOpen)return
    const onKey=(event)=>{
      if(event.key==='Escape'){
        event.preventDefault()
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
      // Keep keyboard focus inside the open navigation, without making
      // the immersive background difficult to escape.
      if(event.key==='Tab'&&menuRef.current){
        const controls=[...menuRef.current.querySelectorAll('a[href],button:not([disabled])')]
        if(!controls.length)return
        const first=controls[0],last=controls[controls.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',onKey)
    return ()=>window.removeEventListener('keydown',onKey)
  },[menuOpen,setMenuOpen])
  useEffect(()=>{
    if(menuOpen){
      // Focus the first usable navigation link when the drawer opens.
      const frame=requestAnimationFrame(()=>menuRef.current?.querySelector('a[href]')?.focus())
      return ()=>cancelAnimationFrame(frame)
    }
  },[menuOpen])

  return <>
    <header className={'topbar topbar-v2 '+(menuOpen?'topbar-v2-open':'')}>
      <div className="topbar-main">
        <Link to="/" className="brand-mark" aria-label="Retour à l’accueil du portfolio">
          <span className="brand-monogram">C<span>.</span></span>
          <span className="brand-sub">COSME<br/>COLLOMB</span>
        </Link>
        <nav className="header-primary" aria-label="Navigation rapide">
          {NAV_ITEMS.map(item=><Link key={item.to} to={item.to}
            className={context.trail.some(p=>p.to===item.to)&&
              item.to=== (context.trail.length>1?context.trail[1].to:'/')?'is-current':''}
            aria-current={pathname===item.to?'page':undefined}>{item.label}</Link>)}
        </nav>
        <div className="header-controls">
          {pathname!=='/'&&<Link to="/" className="header-home-link" aria-label="Aller à l’accueil">
            <span aria-hidden="true">⌂</span><span>Accueil</span>
          </Link>}
          {context.back&&
            <Link to={context.back.to} state={pathname.startsWith('/projets/')?{fromJourney:true}:undefined}
              className="header-return" aria-label={context.back.label}>
              <span className="header-return-arrow" aria-hidden="true">←</span>
              <span className="header-return-label">{context.back.to==='/projets'?'Projets':'Retour'}</span>
            </Link>}
          <button type="button" ref={toggleRef} className={'header-menu-toggle '+(menuOpen?'is-open':'')}
            aria-expanded={menuOpen} aria-controls="portfolio-navigation-panel"
            aria-label={menuOpen?'Fermer le menu de navigation':'Ouvrir le menu de navigation'}
            onClick={()=>setMenuOpen(open=>!open)}>
            <span className="menu-button-label">{menuOpen?'FERMER':'MENU'}</span>
            <span className="menu-button-symbol" aria-hidden="true"><i/><i/></span>
          </button>
        </div>
      </div>
      {pathname!=='/'&&<nav className="header-breadcrumb" aria-label="Vous êtes ici">
        {context.trail.map((item,i)=>(
          <span key={item.to+'-'+i} className="header-crumb">
            {i>0&&<span className="crumb-divider" aria-hidden="true">/</span>}
            {i===context.trail.length-1?
              <span aria-current="page" className="crumb-current">{item.label}</span>:
              <Link to={item.to}>{item.label}</Link>}
          </span>
        ))}
      </nav>}
    </header>
    <AnimatePresence>
      {menuOpen&&<motion.div className="navigation-layer" key="navigation-layer"
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        transition={{duration:.28}}>
        <button type="button" className="navigation-scrim"
          aria-label="Fermer le menu" onClick={()=>setMenuOpen(false)}/>
        <motion.nav id="portfolio-navigation-panel" ref={menuRef}
          role="dialog" aria-modal="true" aria-label="Menu de navigation"
          className="navigation-drawer"
          initial={{opacity:0,y:-18,scale:.985}}
          animate={{opacity:1,y:0,scale:1}}
          exit={{opacity:0,y:-12,scale:.99}}
          transition={{duration:.46,ease:[.16,1,.3,1]}}>
          <div className="navigation-drawer-heading">
            <div><span className="micro-label">LE PORTFOLIO / 2026</span>
              <p>Choisissez une direction</p></div>
            <button className="navigation-close" type="button" onClick={()=>setMenuOpen(false)}
              aria-label="Fermer le menu">✕ <span>Fermer</span></button>
          </div>
          <div className="navigation-drawer-columns">
            <div className="navigation-main-links">
              {NAV_ITEMS.map(item=><Link key={item.to} to={item.to} onClick={()=>setMenuOpen(false)}
                aria-current={pathname===item.to?'page':undefined}
                className={(pathname===item.to?'is-active':'')}>
                <span className="navigation-link-number">{item.number}</span>
                <span className="navigation-link-text">
                  <strong>{item.label}</strong><small>{item.caption}</small>
                </span>
                <span className="navigation-link-arrow" aria-hidden="true">↗</span>
              </Link>)}
            </div>
            <div className="navigation-projects">
              <span className="micro-label">EXPLORER UN PROJET</span>
              {PROJECTS.map((project,i)=><Link key={project.slug}
                className={pathname==='/projets/'+project.slug?'is-active':''}
                to={'/projets/'+project.slug} onClick={()=>setMenuOpen(false)}>
                <span>{String(i+1).padStart(2,'0')}</span>
                <strong>{project.title}</strong>
                <span aria-hidden="true">↗</span>
              </Link>)}
              <p>Vous pouvez aussi continuer l’exploration en faisant défiler la page.</p>
            </div>
          </div>
        </motion.nav>
      </motion.div>}
    </AnimatePresence>
  </>
}

function Chapter({ index, children, className='', id, label }) {
  return (
    <section id={id} className={'chapter chapter-' + index + ' ' + className} aria-label={label}>
      <div className="chapter-content">{children}</div>
    </section>
  )
}

function ScrollLabel() {
  const { scrollYProgress } = useScroll()
  const height = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  return (
    <div className="scroll-index" aria-hidden="true">
      <span>SCROLL TO EXPLORE</span>
      <div className="scroll-track"><motion.div className="scroll-progress" style={{height}} /></div>
      <span>↓</span>
    </div>
  )
}

function Landing() {
  const hero = useRef(null)
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 100])
  const opacity = useTransform(scrollYProgress, [0, .76, 1], [1, 1, 0])
  return (
    <section ref={hero} className="landing" aria-label="Présentation">
      <motion.div className="hero-editorial" style={{y,opacity}}>
        <motion.p className="micro-label" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:.3,duration:.7}}>
          INNOVATION <span className="little-star">✳</span> DESIGN <span className="little-star">✳</span> DIGITAL
        </motion.p>
        <motion.h1 initial={{opacity:0,y:65}} animate={{opacity:1,y:0}} transition={{duration:1.25,delay:.35,ease:[.16,1,.3,1]}}>
          Donner forme<br/>aux <em>idées.</em>
        </motion.h1>
        <motion.div className="landing-lower" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.9,delay:1.05}}>
          <p>Je conçois des expériences digitales<br/>qui ont quelque chose à raconter.</p>
          <button className="round-scroll" type="button" onClick={() => document.getElementById('junction')?.scrollIntoView({behavior:'smooth'})} aria-label="Découvrir les chemins">
            <span>↓</span>
          </button>
        </motion.div>
      </motion.div>
      <div className="hero-folio" aria-hidden="true">CC / 001</div>
    </section>
  )
}

function Junction({ setHovered }) {
  return (
    <Chapter id="junction" index="junction" className="junction" label="Choix de navigation">
      <div className="junction-intro">
        <span className="micro-label">01 / CHOISIR UNE DIRECTION</span>
        <h2>Un univers.<br/><em>Plusieurs chemins.</em></h2>
        <p>Le parcours se divise ici. Choisissez ce que vous souhaitez explorer.</p>
      </div>
      <nav className="branch-list" aria-label="Explorer le portfolio">
        {routes.map((r,i) => (
          <motion.div key={r.key} initial={{opacity:0,y:35}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.35}} transition={{duration:.7,delay:i*.09}}>
            <Link to={r.path} className="branch-link"
              onMouseEnter={() => setHovered(r.key)} onMouseLeave={() => setHovered('')}
              onFocus={() => setHovered(r.key)} onBlur={() => setHovered('')}>
              <span className="branch-number">{r.number}</span>
              <span className="branch-name">{r.label}<small>{r.caption}</small></span>
              <span className="branch-arrow">↗</span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="section-signature">EXPLORE / CREATE / EVOLVE</div>
    </Chapter>
  )
}

function WorkPreview() {
  const selection = [PROJECTS[2], PROJECTS[4], PROJECTS[0]].filter(Boolean)
  return (
    <Chapter id="works" index="work" className="work-chapter" label="Projets sélectionnés">
      <div className="section-topline"><span className="micro-label">02 / PROJETS SÉLECTIONNÉS</span><span>UNE IDÉE DEVIENT UNE EXPÉRIENCE</span></div>
      <h2 className="oversized-statement">Le fond.<br/><em>Et la forme.</em></h2>
      <div className="work-cases">
        {selection.map((project,i)=>(
          <Link key={project.slug} className="work-case" to={'/projets/'+project.slug}>
            <span className="work-case-count">0{i+1} / SELECTED</span>
            <strong>{project.title}</strong>
            <span className="work-case-type">{project.tags?.slice(0,2).join(' · ')}</span>
            <span className="work-case-arrow">↗</span>
          </Link>
        ))}
      </div>
      <Link to="/projets" className="underlined-link">Tous les projets <span>↗</span></Link>
    </Chapter>
  )
}

function Philosophy() {
  return (
    <Chapter index="manifesto" className="manifesto" label="Approche et compétences">
      <span className="micro-label">03 / MA MANIÈRE DE CRÉER</span>
      <h2>Une direction<br/>claire. <em>Un impact</em><br/>qui reste.</h2>
      <div className="manifesto-lower">
        <p>Marketing, stratégie digitale, design et développement : je rapproche les idées de leur réalisation, sans sacrifier l'usage à l'effet.</p>
        <Link to="/parcours" className="underlined-link">Découvrir mon parcours <span>↗</span></Link>
      </div>
    </Chapter>
  )
}

function Closing() {
  return (
    <Chapter index="final" className="closing" label="Prendre contact">
      <span className="micro-label">04 / LA SUITE</span>
      <h2>Et si on faisait<br/><em>quelque chose</em><br/>ensemble ?</h2>
      <Link to="/contact" className="big-circle-link"><span>PARLONS-EN ↗</span></Link>
      <p className="closing-caption">Chaque beau projet commence par une conversation.</p>
    </Chapter>
  )
}

function Home({ setHovered }) {
  return <><Landing /><Junction setHovered={setHovered}/><WorkPreview /><Philosophy /><Closing /></>
}

function PageIntro({ kicker, title, italic, text }) {
  return (
    <section className="interior-intro">
      <motion.div initial={{opacity:0,y:52}} animate={{opacity:1,y:0}} transition={{duration:1,ease:[.16,1,.3,1]}}>
        <p className="micro-label">{kicker}</p>
        <h1>{title}<br/><em>{italic}</em></h1>
        {text && <p className="interior-lead">{text}</p>}
      </motion.div>
      <span className="interior-index">COSME COLLOMB / PORTFOLIO</span>
    </section>
  )
}

function ProjectIndex({ setHovered }) {
  const {state}=useLocation()
  // Restore only AFTER this exact five-way crossroads has mounted. An earlier
  // global scroll reset can run before Framer Motion swaps the detail DOM,
  // which left the camera twenty metres back in a closed-looking corridor.
  useLayoutEffect(()=>{
    if(!state?.fromJourney)return
    const target=document.getElementById('project-crossroads')
    if(target)window.scrollTo({top:target.offsetTop,behavior:'instant'})
  },[state])
  return <>
    <PageIntro kicker="LE CARREFOUR / CINQ DIRECTIONS" title="Cinq projets." italic="Cinq chemins."
      text="À chaque embranchement, un projet. Choisissez votre direction, avancez dans son univers puis revenez ici en poursuivant votre exploration." />
    <section id="project-crossroads" className="project-crossroads" aria-label="Carrefour des cinq projets">
      <div className="crossroads-top">
        <span className="micro-label">CARREFOUR 02 / 05 ACCÈS</span>
        <p>Survolez un chemin pour le mettre en lumière. Cliquez pour entrer.</p>
      </div>
      <h2 className="crossroads-heading">Quelle direction<br/><em>prendre ?</em></h2>
      <nav className="fork-choices" aria-label="Choisir un tunnel projet">
        {PROJECTS.map((p,i)=>(
          <motion.div key={p.slug} initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}}
            viewport={{once:true,amount:.2}} transition={{duration:.65,delay:i*.055}}>
            <Link to={'/projets/'+p.slug} className={'fork-choice fork-choice-'+i}
              onMouseEnter={()=>setHovered('project-'+i)} onMouseLeave={()=>setHovered('')}
              onFocus={()=>setHovered('project-'+i)} onBlur={()=>setHovered('')}>
              <span className="fork-number">{String(i+1).padStart(2,'0')}</span>
              <span className="fork-title">{p.title}<small>{p.tags?.slice(0,2).join(' / ')}</small></span>
              <span className="fork-direction">↗</span>
            </Link>
          </motion.div>
        ))}
      </nav>
      <p className="crossroads-footnote">Chaque chemin est une exploration au scroll. À la fin, vous reviendrez à cette intersection.</p>
      <Link to="/" className="underlined-link">← Retour à l'accueil</Link>
    </section>
  </>
}

function JourneyStation({number,kicker,title,children,align=''}) {
  return <section className={'journey-station '+align} aria-label={kicker}>
    <motion.div className="journey-content" initial={{opacity:0,y:45}}
      whileInView={{opacity:1,y:0}} viewport={{once:false,amount:.35}}
      transition={{duration:.8,ease:[.16,1,.3,1]}}>
      <span className="micro-label">{number} / {kicker}</span>
      <h2>{title}</h2>
      {children}
    </motion.div>
    <div className="journey-rail" aria-hidden="true"><span>{number}</span><span>↓</span></div>
  </section>
}

function ProjectDetail({slug,onJourneyFinished}) {
  const i=PROJECTS.findIndex(p=>p.slug===slug)
  const p=PROJECTS[i]
  // The end of each project's scroll journey leads back to the SAME physical
  // five-way junction, not a second UI containing only four alternatives.
  useEffect(()=>{
    if(!p)return
    let travelled=false
    let returned=false
    let pollTimer=0
    const mountedAt=performance.now()
    const followScroll=()=>{
      const total=document.documentElement.scrollHeight-window.innerHeight
      if(total<500 || returned)return
      if(window.scrollY>total*.45)travelled=true
      if(travelled && window.scrollY>=total-30 &&
        performance.now()-mountedAt>1100){
        // A journey can reach the page bottom while its inbound 3D transit
        // is still active. Only mark it complete once a NEW return flight
        // has actually started, otherwise the user gets stranded at the end.
        returned=Boolean(onJourneyFinished())
      }
    }
    const poll=()=>{
      followScroll()
      if(!returned)pollTimer=window.setTimeout(poll,180)
    }
    window.addEventListener('scroll',followScroll,{passive:true})
    pollTimer=window.setTimeout(poll,180)
    return ()=>{
      window.removeEventListener('scroll',followScroll)
      window.clearTimeout(pollTimer)
    }
  },[slug,onJourneyFinished])
  if(!p)return <PageIntro kicker="ERREUR" title="Projet" italic="introuvable." />
  const story=PROJECT_STORIES[i]
  return <>
    <section className="journey-entrance">
      <motion.div initial={{opacity:0,y:70}} animate={{opacity:1,y:0}}
        transition={{duration:1.1,ease:[.16,1,.3,1]}}>
        <p className="micro-label">CHEMIN {String(i+1).padStart(2,'0')} / {String(PROJECTS.length).padStart(2,'0')} — VOYAGE INTERACTIF</p>
        <h1>{p.title}</h1>
        <p className="journey-intro">{story.introduction}</p>
        <div className="journey-instructions"><span className="journey-instructions-icon">↓</span>
          Faites défiler pour avancer dans ce tunnel et découvrir le projet.
        </div>
      </motion.div>
      <Link className="journey-back" to="/projets" state={{fromJourney:true}}>← Les cinq chemins</Link>
    </section>
    <JourneyStation number="01" kicker="LE POINT DE DÉPART" title="L'idée." >
      <p>{story.idea}</p>
      <p className="journey-secondary">{p.description}</p>
    </JourneyStation>
    <JourneyStation number="02" kicker="DANS L'EXPÉRIENCE" title="À explorer." align="journey-right">
      <p>{story.experience}</p>
    </JourneyStation>
    <JourneyStation number="03" kicker="LES FONCTIONNALITÉS" title="Ce qui prend vie.">
      <div className="journey-features">
        {story.features.map((feature,index)=><div key={feature}><span>{String(index+1).padStart(2,'0')}</span><strong>{feature}</strong></div>)}
      </div>
    </JourneyStation>
    <JourneyStation number="04" kicker="VOIR LA RÉALISATION" title="Le projet, en vrai." align="journey-right">
      <p>Le meilleur moyen de découvrir cette réalisation reste de l'utiliser.</p>
      <div className="journey-actions">
        {p.link && <a className="detail-primary" href={p.link} target="_blank" rel="noopener noreferrer">Ouvrir le projet <span>↗</span></a>}
        {p.repoLink && <a className="underlined-link" href={p.repoLink} target="_blank" rel="noopener noreferrer">Explorer le code ↗</a>}
      </div>
      <p className="journey-secondary">Continuez à descendre : le tunnel vous ramène maintenant à l'intersection.</p>
    </JourneyStation>
    <section className="journey-return" id="return-to-projects" aria-label="Retour au carrefour des projets">
      <motion.div initial={{opacity:0,y:40}} whileInView={{opacity:1,y:0}}
        viewport={{once:false,amount:.25}} transition={{duration:.9}}>
        <p className="micro-label">05 / RETOUR AU CARREFOUR</p>
        <h2>De retour.<br/><em>Quel autre chemin ?</em></h2>
        <p>Vous avez parcouru {p.title}. Avancez jusqu'au bout : le tunnel vous reconduit automatiquement devant les cinq mêmes chemins.</p>
        <Link to="/projets" state={{fromJourney:true}} className="underlined-link">← Revenir maintenant au carrefour des cinq projets <span>↗</span></Link>
      </motion.div>
    </section>
  </>
}

function About() {
  const expertise=[
    ['01','Conception & stratégie','Cadrage, recherche, parcours utilisateurs et direction de projet digital.'],
    ['02','Sites & expériences web','Création de sites et interfaces interactives, du concept à la mise en ligne.'],
    ['03','Identité & contenus','Direction visuelle, création graphique, vidéo et communication.']
  ]
  return <>
    <PageIntro kicker="LE PARCOURS / MON APPROCHE" title="Faire dialoguer" italic="l'idée et le réel." text="Une approche à la croisée du marketing, de la communication et de la création digitale." />
    <section className="interior-body">
      <div className="section-topline"><span>SAVOIR-FAIRE</span><span>DES IDÉES AUX INTERFACES</span></div>
      {expertise.map(e=><article className="expertise-line" key={e[0]}><span>{e[0]}</span><h2>{e[1]}</h2><p>{e[2]}</p></article>)}
      <p className="about-tail">J'ai notamment conçu des sites vitrines, accompagné des projets digitaux et participé à la création d'identités, de contenus et d'outils interactifs.</p>
      <Link to="/contact" className="underlined-link">Travaillons ensemble <span>↗</span></Link>
    </section>
  </>
}

function Contact() {
  return <>
    <PageIntro kicker="CONTACT / PRENONS LE TEMPS" title="La suite" italic="s'invente ensemble." text="Un projet, une idée, une opportunité ? Parlons-en." />
    <section className="interior-body contact-body">
      <a href="https://github.com/cosscoll" className="contact-giant-link" target="_blank" rel="noopener noreferrer">Retrouvez-moi sur GitHub <span>↗</span></a>
      <p>Ou explorez les projets pour découvrir mes réalisations et leurs liens directs.</p>
      <Link to="/projets" className="underlined-link">Explorer les projets <span>↗</span></Link>
    </section>
  </>
}

function RouteView({ pathname, setHovered, onJourneyFinished }) {
  if(pathname === '/')return <Home setHovered={setHovered}/>
  if(pathname === '/projets')return <ProjectIndex setHovered={setHovered}/>
  if(pathname.startsWith('/projets/'))return <ProjectDetail slug={pathname.split('/')[2]} onJourneyFinished={onJourneyFinished}/>
  if(pathname === '/parcours' || pathname === '/experience')return <About/>
  if(pathname === '/contact')return <Contact/>
  return <Home setHovered={setHovered}/>
}

// Navigation is intercepted before React Router replaces the page.
const TRANSIT_MS=4200
const TRANSIT_MIDPOINT=2400
function TransitionCurtain({transit}) {
  if(!transit)return null
  const project=PROJECTS.find(p=>transit.to==='/projets/'+p.slug)
  const name=project?.title || (transit.to==='/projets'?'Les projets':
    transit.to==='/parcours'||transit.to==='/experience'?'Le parcours':
    transit.to==='/contact'?'Contact':'Accueil')
  // A readable, non-occluding indicator — there is no white flash,
  // no full-screen transition overlay and no teleport masking.
  return <div className="bridge-wayfinding" data-bridge-transition="active"
    role="status" aria-label={'Construction du tunnel vers '+name}>
    <span className="bridge-wayfinding-kicker">LE CHEMIN SE CONSTRUIT</span>
    <strong>{name}</strong>
    <span className="bridge-wayfinding-track" aria-hidden="true"><i/></span>
  </div>
}


function Shell() {
  const {pathname}=useLocation()
  const navigate=useNavigate()
  const [hovered,setHovered]=useState('')
  const [menuOpen,setMenuOpen]=useState(false)
  const [transit,setTransit]=useState(null)
  const transitRef=useRef(null)
  const timers=useRef([])
  const nextId=useRef(0)

  useEffect(()=>{setHovered('');setMenuOpen(false)},[pathname])
  const commitMidpoint=useCallback((journey)=>{
    if(transitRef.current?.id!==journey.id || journey.midpointDone)return
    journey.midpointDone=true
    navigate(journey.to,{state:{
      fromJourney:journey.from.startsWith('/projets/') && journey.to==='/projets',
      fromTransit:true
    }})
  },[navigate])
  const finishTrip=useCallback((journey)=>{
    if(transitRef.current?.id!==journey.id || journey.finished)return
    commitMidpoint(journey)
    journey.finished=true
    transitRef.current=null
    setTransit(null)
  },[commitMidpoint])
  const beginTrip=useCallback((next)=>{
    if(next===pathname || transitRef.current)return false
    const journey={
      id:++nextId.current,from:pathname,to:next,startedAt:performance.now(),
      duration:TRANSIT_MS,sourceScroll:window.scrollY,progress:0,
      midpointDone:false,finished:false
    }
    transitRef.current=journey
    setMenuOpen(false)
    setTransit(journey)
    window.history.scrollRestoration='manual'
    // With WebGL the router follows the real animated camera, not wall-clock
    // timers. This is essential when an expensive GPU frame stalls rendering:
    // a delayed frame may not skip 20 metres down the corridor.
    const has3D=Boolean(document.querySelector('.scene-backdrop canvas'))
    const halfwayDelay=has3D?35000:TRANSIT_MIDPOINT
    const finishDelay=has3D?42000:TRANSIT_MS
    timers.current.push(window.setTimeout(()=>commitMidpoint(journey),halfwayDelay))
    timers.current.push(window.setTimeout(()=>finishTrip(journey),finishDelay))
    return true
  },[pathname,commitMidpoint,finishTrip])

  useEffect(()=>{
    const onMilestone=(event)=>{
      const journey=transitRef.current
      if(!journey || journey.id!==event.detail?.id)return
      if(event.detail.stage==='midpoint')commitMidpoint(journey)
      if(event.detail.stage==='complete')finishTrip(journey)
    }
    window.addEventListener('portfolio:flight-milestone',onMilestone)
    return ()=>window.removeEventListener('portfolio:flight-milestone',onMilestone)
  },[commitMidpoint,finishTrip])

  useEffect(()=>{
    const capture=(event)=>{
      if(event.defaultPrevented || event.button!==0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor=event.target.closest?.('a[href]')
      if(!anchor || anchor.target || anchor.hasAttribute('download') ||
        anchor.dataset.noTransit==='true')return
      let destination
      try{destination=new URL(anchor.href,window.location.href)}catch{return}
      if(destination.origin!==window.location.origin ||
        destination.pathname!==window.location.pathname ||
        !destination.hash.startsWith('#/'))return
      const next=decodeURI(destination.hash.slice(1)).split('?')[0]
      if(next===pathname)return
      event.preventDefault()
      event.stopPropagation()
      beginTrip(next)
    }
    document.addEventListener('click',capture,true)
    return ()=>document.removeEventListener('click',capture,true)
  },[pathname,beginTrip])

  useEffect(()=>()=>timers.current.forEach(window.clearTimeout),[])
  return <>
    <ScrollReset/>
    <Background pathname={pathname} hovered={hovered} transit={transit}/>
    <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen}/>
    <ScrollLabel/>
    <main id="content" className={transit?'content-in-transit':''}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pathname}
          initial={{opacity:0,filter:'blur(15px)',y:28}}
          animate={{opacity:1,filter:'blur(0px)',y:0}}
          exit={{opacity:0,filter:'blur(13px)',y:-26}}
          transition={{duration:.55,ease:[.22,1,.36,1]}}>
          <RouteView pathname={pathname} setHovered={setHovered} onJourneyFinished={()=>beginTrip('/projets')}/>
        </motion.div>
      </AnimatePresence>
    </main>
    <TransitionCurtain transit={transit}/>
    <footer className="site-footer"><span>© 2026 COSME COLLOMB</span><span>FAIT POUR ÊTRE EXPLORÉ</span><a href="https://github.com/cosscoll" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></footer>
  </>
}

export default function App() {
  return <HashRouter><Shell/></HashRouter>
}
