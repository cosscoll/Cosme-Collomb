import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import Reveal from '../components/Reveal.jsx'
import { NAME, TAGLINE, BIO } from '../data/site.js'
import { PROJECTS_WITH_SLUGS } from '../data/projects.js'
import { EXPERIENCE } from '../data/experience.js'

const MARQUEE_ITEMS = ['STRATÉGIE', 'DESIGN', '3D', 'WEBGL', 'MOTION', 'IA', 'EXPÉRIENCE', 'INTERACTION']

function Hero() {
  const section = useRef(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] })
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.58, 1], [1, 0.8, 0])
  const metaY = useTransform(scrollYProgress, [0, 1], [0, -80])

  return (
    <section ref={section} id="top" className="hero-stage">
      <motion.div className="hero-copy" style={{ y: copyY, opacity: copyOpacity }}>
        <motion.p className="eyebrow hero-eyebrow" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.7 }}>
          Portfolio expérimental — {new Date().getFullYear()}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 34, filter: 'blur(12px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 1.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}>
          Je construis des expériences digitales qui <span>se vivent.</span>
        </motion.h1>
        <motion.p className="hero-tagline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.55, duration: 0.8 }}>
          {TAGLINE}
        </motion.p>
      </motion.div>
      <motion.div className="hero-meta" style={{ y: metaY }}>
        <span>WEBGL / MOTION / INTERACTION</span><span className="hero-meta-dot" /><span>SCROLL TO ENTER</span>
      </motion.div>
      <div className="hero-status" aria-hidden="true"><span className="status-pulse" /><span>LIVE EXPERIENCE</span></div>
      <div className="scroll-cue" aria-hidden="true"><span /></div>
    </section>
  )
}

function Marquee() {
  const line = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div className="marquee-shell" aria-hidden="true">
      <motion.div className="marquee-track" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
        {line.map((item, index) => <span key={`${item}-${index}`}>{item}<i>✦</i></span>)}
      </motion.div>
    </div>
  )
}

function About() {
  return (
    <section id="about" className="section cinematic-section about-stage">
      <div className="section-grid-label">01 / APPROCHE</div>
      <div className="section-sticky-copy">
        <Reveal><p className="eyebrow">À propos</p></Reveal>
        <Reveal delay={0.08} y={70}><h2 className="mega-copy">Pas de pages statiques.<br /><span>Des expériences qui réagissent.</span></h2></Reveal>
        <Reveal delay={0.16}><p className="section-body">{BIO}</p></Reveal>
      </div>
      <div className="floating-index">01</div>
    </section>
  )
}

function ProjectCard({ project, index }) {
  return (
    <motion.article className="featured-project" initial={{ opacity: 0, y: 90, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.9, delay: Math.min(index * 0.08, 0.2), ease: [0.16, 1, 0.3, 1] }}>
      <Link to={`/projets/${project.slug}`} className="featured-project-link">
        <div className="featured-project-index">0{index + 1}</div>
        <div className="featured-project-copy">
          <div className="featured-project-topline"><span>PROJET SÉLECTIONNÉ</span><span>EXPLORE ↗</span></div>
          <h3>{project.title}</h3><p>{project.description}</p>
          <div className="tag-row">{project.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="featured-project-orbit" aria-hidden="true"><span className="orbit-a" /><span className="orbit-b" /><span className="orbit-dot" /></div>
      </Link>
    </motion.article>
  )
}

function FeaturedProjects() {
  const featured = PROJECTS_WITH_SLUGS.filter((project) => project.featured)
  if (featured.length === 0) return null
  return (
    <section className="section cinematic-section projects-stage">
      <div className="section-grid-label">02 / SÉLECTION</div>
      <div className="projects-heading-row"><Reveal><p className="eyebrow">Projets sélectionnés</p></Reveal><Reveal delay={0.08}><h2 className="mega-copy compact">Quelques terrains de jeu.</h2></Reveal></div>
      <div className="featured-projects-stack">{featured.map((project, index) => <ProjectCard key={project.slug} project={project} index={index} />)}</div>
      <Reveal delay={0.15}><Link className="text-link" to="/projets">Voir tous les projets <span>↗</span></Link></Reveal>
    </section>
  )
}

function ExperienceTeaser() {
  if (EXPERIENCE.length === 0) return null
  const latest = EXPERIENCE[0]
  return (
    <section className="section cinematic-section experience-stage">
      <div className="section-grid-label">03 / PARCOURS</div>
      <div className="experience-rail">
        <Reveal><p className="eyebrow">Dernière expérience</p></Reveal>
        <Reveal delay={0.08} y={60}><h2 className="mega-copy compact">{latest.role}</h2></Reveal>
        <Reveal delay={0.14}><div className="experience-meta-card"><span>{latest.org}</span><span>{latest.period}</span><p>{latest.description}</p></div></Reveal>
        <Reveal delay={0.2}><Link className="text-link" to="/experience">Explorer mon parcours <span>↗</span></Link></Reveal>
      </div>
      <div className="floating-index">03</div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="section final-stage">
      <Reveal y={80}><p className="eyebrow">04 / CONTACT</p><h2 className="final-title">Une idée mérite mieux<br /><span>qu’un site ordinaire.</span></h2><Link className="cta-orb" to="/contact"><span>Me contacter</span><i>↗</i></Link></Reveal>
    </section>
  )
}

export default function Home() {
  return <><Hero /><Marquee /><About /><FeaturedProjects /><ExperienceTeaser /><FinalCTA /></>
}
