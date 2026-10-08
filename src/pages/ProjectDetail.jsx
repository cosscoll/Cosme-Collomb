import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Reveal from '../components/Reveal.jsx'
import { PROJECTS_WITH_SLUGS } from '../data/projects.js'

export default function ProjectDetail() {
  const { slug } = useParams()
  const index = PROJECTS_WITH_SLUGS.findIndex((p) => p.slug === slug)
  const project = PROJECTS_WITH_SLUGS[index]
  if (!project) return <section className="section page-section"><h1 className="page-title">Projet introuvable.</h1><Link className="text-link" to="/projets">Retour aux projets ↗</Link></section>
  const previous = PROJECTS_WITH_SLUGS[(index - 1 + PROJECTS_WITH_SLUGS.length) % PROJECTS_WITH_SLUGS.length]
  const next = PROJECTS_WITH_SLUGS[(index + 1) % PROJECTS_WITH_SLUGS.length]
  const stories = [['Le défi', project.challenge],["L'approche", project.approach],['Le résultat', project.outcome]].filter(([, value]) => value)
  return (
    <section className="section page-section project-detail-page">
      <Reveal><Link to="/projets" className="eyebrow">← Retour aux projets</Link></Reveal>
      <Reveal delay={0.06} y={70}><h1 className="page-title project-detail-title">{project.title}</h1></Reveal>
      <Reveal delay={0.12}><p className="page-lead">{project.description}</p></Reveal>
      <motion.div className="project-detail-console" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
        <div><span>INDEX</span><strong>{String(index + 1).padStart(2, '0')}</strong></div><div><span>STATUT</span><strong>EXPÉRIENCE LIVE</strong></div>{project.year && <div><span>ANNÉE</span><strong>{project.year}</strong></div>}{project.role && <div><span>RÔLE</span><strong>{project.role}</strong></div>}
      </motion.div>
      <div className="project-detail-body"><div className="tag-row">{project.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>{stories.map(([title,text],i)=><Reveal key={title} delay={Math.min(i*.08,.2)}><article className="project-story"><p className="eyebrow">{title}</p><h2>{text}</h2></article></Reveal>)}<Reveal delay={0.18}><div className="project-actions">{project.link && project.link !== '#' && <a className="cta-orb" href={project.link} target="_blank" rel="noreferrer"><span>Voir le projet</span><i>↗</i></a>}{project.repoLink && <a className="text-link" href={project.repoLink} target="_blank" rel="noreferrer">Voir le code <span>↗</span></a>}</div></Reveal></div>
      <div className="project-next-grid"><Link to={`/projets/${previous.slug}`}><span>← PRÉCÉDENT</span><strong>{previous.title}</strong></Link><Link to={`/projets/${next.slug}`}><span>SUIVANT →</span><strong>{next.title}</strong></Link></div>
    </section>
  )
}
