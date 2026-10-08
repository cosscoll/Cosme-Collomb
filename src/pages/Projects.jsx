import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Reveal from '../components/Reveal.jsx'
import { PROJECTS_WITH_SLUGS } from '../data/projects.js'

function ProjectCard({ project, index }) {
  return (
    <motion.article className="project-gallery-card" initial={{ opacity: 0, y: 80 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.8, delay: Math.min(index * 0.06, 0.24), ease: [0.16, 1, 0.3, 1] }}>
      <Link to={`/projets/${project.slug}`}>
        <div className="project-gallery-visual"><div className="project-gallery-number">{String(index + 1).padStart(2, '0')}</div><div className="project-gallery-rings" aria-hidden="true"><span /><span /><span /></div><div className="project-gallery-scan" /></div>
        <div className="project-gallery-copy"><div className="project-gallery-heading"><h2>{project.title}</h2><span>↗</span></div><p>{project.description}</p><div className="tag-row">{project.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
      </Link>
    </motion.article>
  )
}

export default function Projects() {
  return (
    <section className="section page-section projects-page">
      <Reveal><p className="eyebrow">Archive / projets</p></Reveal>
      <Reveal delay={0.08} y={70}><h1 className="page-title">Des idées transformées en expériences.</h1></Reveal>
      <Reveal delay={0.15}><p className="page-lead">Chaque projet possède sa propre logique, son propre univers et une expérience interactive dédiée.</p></Reveal>
      <div className="project-gallery">{PROJECTS_WITH_SLUGS.map((project, index) => <ProjectCard key={project.slug} project={project} index={index} />)}</div>
    </section>
  )
}
