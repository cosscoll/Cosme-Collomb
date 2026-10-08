import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import Reveal from '../components/Reveal.jsx'
import { TAGLINE, BIO } from '../data/site.js'
import { PROJECTS_WITH_SLUGS } from '../data/projects.js'
import { EXPERIENCE } from '../data/experience.js'

function Hero() {
  const section = useRef(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 130])
  const opacity = useTransform(scrollYProgress, [0, 0.62, 1], [1, 0.8, 0])

  return (
    <section ref={section} className="hero-stage hero-minimal">
      <motion.div className="hero-copy minimal-copy" style={{ y, opacity }}>
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.7 }}
        >
          Portfolio
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 28, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 1.15, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
        >
          Créer moins.<br />
          <span>Faire ressentir plus.</span>
        </motion.h1>
        <motion.p
          className="hero-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.45, duration: 0.8 }}
        >
          {TAGLINE}
        </motion.p>
      </motion.div>

      <div className="scroll-cue" aria-hidden="true"><span /></div>
    </section>
  )
}

const FORKS = [
  { to: '/projets', key: 'projects', n: '01', label: 'Projets', detail: 'Explorer mes réalisations' },
  { to: '/experience', key: 'experience', n: '02', label: 'Parcours', detail: 'Découvrir mon histoire' },
  { to: '/contact', key: 'contact', n: '03', label: 'Contact', detail: 'Imaginer la suite' },
]

function ForkSection({ onBranchHover }) {
  return (
    <section id="embranchements" className="section fork-section" aria-labelledby="fork-title">
      <div className="fork-content">
        <Reveal><p className="eyebrow">Première bifurcation</p></Reveal>
        <Reveal delay={0.08} y={48}>
          <h2 className="fork-heading" id="fork-title">Choisissez votre chemin.</h2>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="fork-explain">Le tunnel se divise. Chaque voie mène à une partie du portfolio.</p>
        </Reveal>
        <nav className="fork-options" aria-label="Choisir une direction dans le portfolio">
          {FORKS.map((fork, i) => (
            <motion.div key={fork.key}
              initial={{ opacity: 0, y: 42 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.72, delay: i * 0.11 }}>
              <Link to={fork.to} className="fork-link"
                onMouseEnter={() => onBranchHover(fork.key)}
                onMouseLeave={() => onBranchHover('')}
                onFocus={() => onBranchHover(fork.key)}
                onBlur={() => onBranchHover('')}>
                <span className="fork-number">{fork.n}</span>
                <span className="fork-name">{fork.label}<small>{fork.detail}</small></span>
                <span className="fork-arrow" aria-hidden="true">↗</span>
              </Link>
            </motion.div>
          ))}
        </nav>
      </div>
    </section>
  )
}

function About() {
  return (
    <section className="section quiet-section">
      <div className="quiet-content">
        <Reveal><p className="eyebrow">Approche</p></Reveal>
        <Reveal delay={0.08} y={55}>
          <h2 className="quiet-title">Des interfaces simples.<br />Une profondeur invisible au premier regard.</h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="section-body">{BIO}</p>
        </Reveal>
      </div>
    </section>
  )
}

function ProjectRow({ project, index }) {
  return (
    <motion.article
      className="project-row"
      initial={{ opacity: 0, y: 70 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.85, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/projets/${project.slug}`}>
        <span className="project-row-index">0{index + 1}</span>
        <div>
          <h3>{project.title}</h3>
          <p>{project.description}</p>
        </div>
        <span className="project-row-arrow">↗</span>
      </Link>
    </motion.article>
  )
}

function FeaturedProjects() {
  const featured = PROJECTS_WITH_SLUGS.filter((project) => project.featured).slice(0, 2)
  if (!featured.length) return null

  return (
    <section className="section quiet-section projects-quiet">
      <div className="quiet-content wide">
        <Reveal><p className="eyebrow">Sélection</p></Reveal>
        <Reveal delay={0.08}>
          <h2 className="quiet-title">Deux projets.<br />Deux expériences différentes.</h2>
        </Reveal>

        <div className="project-rows">
          {featured.map((project, index) => <ProjectRow key={project.slug} project={project} index={index} />)}
        </div>

        <Reveal delay={0.15}>
          <Link className="text-link" to="/projets">Voir tous les projets <span>↗</span></Link>
        </Reveal>
      </div>
    </section>
  )
}

function ExperienceTeaser() {
  if (!EXPERIENCE.length) return null
  const latest = EXPERIENCE[0]

  return (
    <section className="section quiet-section">
      <div className="quiet-content">
        <Reveal><p className="eyebrow">Parcours</p></Reveal>
        <Reveal delay={0.08} y={55}>
          <h2 className="quiet-title">{latest.role}</h2>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="experience-line">{latest.org} <span>—</span> {latest.period}</p>
        </Reveal>
        <Reveal delay={0.2}>
          <Link className="text-link" to="/experience">Voir le parcours <span>↗</span></Link>
        </Reveal>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="section final-stage quiet-final">
      <Reveal y={70}>
        <p className="eyebrow">Contact</p>
        <h2 className="final-title quiet-final-title">Une idée.<br /><span>Un espace pour la rendre mémorable.</span></h2>
        <Link className="text-link final-link" to="/contact">Me contacter <span>↗</span></Link>
      </Reveal>
    </section>
  )
}

export default function Home({ onBranchHover = () => {} }) {
  return (
    <>
      <Hero />
      <ForkSection onBranchHover={onBranchHover} />
      <About />
      <FeaturedProjects />
      <ExperienceTeaser />
      <FinalCTA />
    </>
  )
}
