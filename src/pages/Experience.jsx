import Reveal from '../components/Reveal.jsx'
import { EXPERIENCE } from '../data/experience.js'

function TimelineEntry({ entry, isLast }) {
  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)', marginTop: 6 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: 'var(--line)', marginTop: 8 }} />}
      </div>
      <div style={{ paddingBottom: '3rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>{entry.period}</p>
        <h3 style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)', marginTop: '0.4rem' }}>{entry.role}</h3>
        <p style={{ color: 'var(--accent)', marginTop: '0.2rem' }}>{entry.org}</p>
        <p style={{ color: 'var(--muted)', marginTop: '0.75rem', maxWidth: 560, lineHeight: 1.7 }}>{entry.description}</p>
        {entry.tags?.length > 0 && <div className="tag-row">{entry.tags.map((t) => <span key={t}>{t}</span>)}</div>}
      </div>
    </div>
  )
}

export default function Experience() {
  return (
    <section className="section page-section">
      <Reveal><p className="eyebrow">Parcours</p></Reveal>
      <Reveal delay={0.1}><h1 className="page-title">Ce que j'ai fait jusqu'ici.</h1></Reveal>
      <div style={{ marginTop: '4rem', maxWidth: 680 }}>
        {EXPERIENCE.map((entry, i) => <Reveal key={`${entry.role}-${entry.org}`} delay={Math.min(i * 0.08, 0.4)}><TimelineEntry entry={entry} isLast={i === EXPERIENCE.length - 1} /></Reveal>)}
      </div>
    </section>
  )
}
