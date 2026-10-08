import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { HashRouter, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { PROJECTS_WITH_SLUGS as PROJECTS } from './data/projects.js'
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
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.documentElement.style.scrollBehavior = 'auto'
    const id = requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = '' })
    return () => cancelAnimationFrame(id)
  }, [pathname])
  return null
}

function Background({ pathname, hovered }) {
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
  useEffect(() => setReady(false), [pathname])
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
            <World pathname={pathname} hovered={hovered} onReady={() => setReady(true)} />
          </Suspense>
        </Boundary>
      )}
      <div className="scene-shading" />
    </div>
  )
}

function Header() {
  const { pathname } = useLocation()
  return (
    <header className="topbar">
      <Link to="/" className="brand-mark" aria-label="Cosme Collomb, accueil">
        <span className="brand-monogram">C<span>.</span></span>
        <span className="brand-sub">COSME<br/>COLLOMB</span>
      </Link>
      <span className="topbar-center">PORTFOLIO <span>—</span> 2026</span>
      <nav className="header-links" aria-label="Navigation principale">
        {routes.map(r => <Link key={r.key} className={pathname.startsWith(r.path) ? 'current' : ''} to={r.path}>{r.label}</Link>)}
      </nav>
    </header>
  )
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
  return <>
    <PageIntro kicker="EXPLORATION / PROJETS" title="Un projet." italic="Un univers." text="Interfaces interactives, outils utiles et expériences digitales conçues pour être explorées." />
    <section className="interior-body">
      <div className="section-topline"><span>INDEX DES PROJETS</span><span>{String(PROJECTS.length).padStart(2,'0')} EXPÉRIENCES</span></div>
      <div className="all-projects">
        {PROJECTS.map((p,i)=><Link to={'/projets/'+p.slug} className="project-line" key={p.slug}
          onMouseEnter={()=>setHovered('project-'+i)} onMouseLeave={()=>setHovered('')}>
          <span className="project-number">{String(i+1).padStart(2,'0')}</span>
          <span className="project-line-main"><strong>{p.title}</strong><small>{p.tags?.slice(0,3).join('  /  ')}</small></span>
          <span className="project-line-arrow">↗</span>
        </Link>)}
      </div>
      <Link to="/" className="underlined-link">← Revenir au carrefour</Link>
    </section>
  </>
}

function ProjectDetail({slug}) {
  const i=PROJECTS.findIndex(p=>p.slug===slug)
  const p=PROJECTS[i]
  if(!p)return <PageIntro kicker="ERREUR" title="Projet" italic="introuvable." />
  const next=PROJECTS[(i+1)%PROJECTS.length]
  return <>
    <PageIntro kicker={'PROJET / '+String(i+1).padStart(2,'0')} title={p.title} italic="" text={p.description} />
    <section className="interior-body detail-body">
      <div className="section-topline"><span>EXPLORATION</span><span>UNE RÉALISATION DE COSME COLLOMB</span></div>
      <div className="detail-metadata"><span>DOMAINES</span><p>{p.tags?.join(' — ')}</p></div>
      <div className="detail-buttons">
        {p.link && <a className="detail-primary" href={p.link} target="_blank" rel="noopener noreferrer">Explorer le projet <span>↗</span></a>}
        {p.repoLink && <a className="underlined-link" href={p.repoLink} target="_blank" rel="noopener noreferrer">Voir le code source <span>↗</span></a>}
      </div>
      <Link to={'/projets/'+next.slug} className="next-project">PROCHAIN PROJET <strong>{next.title} ↗</strong></Link>
      <Link to="/projets" className="underlined-link">← Tous les projets</Link>
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

function RouteView({ pathname, setHovered }) {
  if(pathname === '/')return <Home setHovered={setHovered}/>
  if(pathname === '/projets')return <ProjectIndex setHovered={setHovered}/>
  if(pathname.startsWith('/projets/'))return <ProjectDetail slug={pathname.split('/')[2]}/>
  if(pathname === '/parcours' || pathname === '/experience')return <About/>
  if(pathname === '/contact')return <Contact/>
  return <Home setHovered={setHovered}/>
}

function Shell() {
  const {pathname}=useLocation()
  const [hovered,setHovered]=useState('')
  useEffect(()=>setHovered(''),[pathname])
  return <>
    <ScrollReset/>
    <Background pathname={pathname} hovered={hovered}/>
    <Header/>
    <ScrollLabel/>
    <main id="content">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={pathname} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.5}}>
          <RouteView pathname={pathname} setHovered={setHovered}/>
        </motion.div>
      </AnimatePresence>
    </main>
    <footer className="site-footer"><span>© 2026 COSME COLLOMB</span><span>FAIT POUR ÊTRE EXPLORÉ</span><a href="https://github.com/cosscoll" target="_blank" rel="noopener noreferrer">GITHUB ↗</a></footer>
  </>
}

export default function App() {
  return <HashRouter><Shell/></HashRouter>
}
