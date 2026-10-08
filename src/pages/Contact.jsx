import Reveal from '../components/Reveal.jsx'
import { NAME, EMAIL } from '../data/site.js'

export default function Contact() {
  return (
    <section className="section final-stage">
      <Reveal y={70}>
        <p className="eyebrow">Contact</p>
        <h1 className="final-title">Construisons quelque chose<br /><span>qui reste en tête.</span></h1>
        <a className="text-link" href={`mailto:${EMAIL}`}>{EMAIL} <span>↗</span></a>
        <p style={{ marginTop: '5rem', color: 'var(--muted)', fontSize: '0.8rem' }}>© {new Date().getFullYear()} {NAME}</p>
      </Reveal>
    </section>
  )
}
