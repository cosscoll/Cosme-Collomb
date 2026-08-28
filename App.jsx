import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HeroScene from './components/HeroScene.jsx'
import Reveal from './components/Reveal.jsx'
import CursorGlow from './components/CursorGlow.jsx'

// ---- Contenu à personnaliser ----
const NAME = 'Ton Nom'
const TAGLINE = "Développeur créatif — j'aime construire des choses qui bougent."
const PROJECTS = [
  {
    title: 'Projet Un',
    description: 'Description courte du projet. Remplace par un vrai projet.',
    tags: ['React', 'Three.js'],
    link: '#',
  },
  {
    title: 'Projet Deux',
    description: 'Description courte du projet. Remplace par un vrai projet.',
    tags: ['WebGL', 'GSAP'],
    link: '#',
  },
  {
    title: 'Projet Trois',
    description: 'Description courte du projet. Remplace par un vrai projet.',
    tags: ['Design', 'Animation'],
    link: '#',
  },
]
// ---------------------------------

function Loader() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0b0b0e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          color: '#f2efe8',
          letterSpacing: '0.2em',
          fontSize: '0.85rem',
          textTransform: 'uppercase',
        }}
      >
        Chargement
      </motion.div>
    </div>
  )
}

function Nav() {
  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem clamp(1.5rem, 6vw, 6rem)',
        zIndex: 20,
        mixBlendMode: 'difference',
      }}
    >
      <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600 }}>{NAME}</span>
      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
        <a href="#work">Projets</a>
        <a href="#about">À propos</a>
        <a href="#contact">Contact</a>
      </div>
    </motion.nav>
  )
}

function Hero() {
  return (
    <section
      id="top"
      className="section"
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr',
        alignItems: 'center',
        position: 'relative',
        paddingTop: '6rem',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 780, pointerEvents: 'none' }}>
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.8 }}
        >
          Portfolio — {new Date().getFullYear()}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.75, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', marginTop: '1rem' }}
        >
          {NAME}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.95, duration: 0.9 }}
          style={{
            marginTop: '1.5rem',
            fontSize: 'clamp(1rem, 2vw, 1.3rem)',
            color: 'var(--muted)',
            maxWidth: 520,
          }}
        >
          {TAGLINE}
        </motion.p>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="section">
      <Reveal>
        <p className="eyebrow">À propos</p>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', marginTop: '1rem', maxWidth: 800 }}>
          Quelques mots sur toi, ton approche, ce qui te fait vibrer dans ton travail.
        </h2>
      </Reveal>
      <Reveal delay={0.2}>
        <p style={{ marginTop: '2rem', maxWidth: 640, color: 'var(--muted)', lineHeight: 1.7 }}>
          Remplace ce paragraphe par ta vraie bio : ton parcours, tes outils de prédilection,
          ce que tu cherches à créer. Deux ou trois phrases suffisent, mieux vaut être précis
          que long.
        </p>
      </Reveal>
    </section>
  )
}

function Projects() {
  return (
    <section id="work" className="section">
      <Reveal>
        <p className="eyebrow">Projets</p>
      </Reveal>
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column' }}>
        {PROJECTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <a
              href={p.link}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '2rem 0',
                borderTop: '1px solid var(--line)',
                transition: 'padding-left 0.35s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.paddingLeft = '1rem')}
              onMouseLeave={(e) => (e.currentTarget.style.paddingLeft = '0')}
            >
              <div>
                <h3 style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}>{p.title}</h3>
                <p style={{ color: 'var(--muted)', marginTop: '0.5rem', maxWidth: 480 }}>
                  {p.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {p.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.7rem',
                      borderRadius: 999,
                      border: '1px solid var(--line)',
                      color: 'var(--muted)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </a>
          </Reveal>
        ))}
        <div className="divider" />
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section id="contact" className="section" style={{ paddingBottom: '6rem' }}>
      <Reveal>
        <p className="eyebrow">Contact</p>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', marginTop: '1rem' }}>
          Parlons de ton prochain projet.
        </h2>
      </Reveal>
      <Reveal delay={0.2}>
        <a
          href="mailto:ton.email@example.com"
          style={{
            display: 'inline-block',
            marginTop: '2rem',
            fontSize: '1.1rem',
            borderBottom: '1px solid var(--accent)',
            color: 'var(--accent)',
          }}
        >
          ton.email@example.com
        </a>
      </Reveal>
      <Reveal delay={0.3}>
        <p style={{ marginTop: '4rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
          © {new Date().getFullYear()} {NAME}
        </p>
      </Reveal>
    </section>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          >
            <Loader />
          </motion.div>
        )}
      </AnimatePresence>

      <CursorGlow />
      <Nav />
      <main>
        <Hero />
        <About />
        <Projects />
        <Contact />
      </main>
    </>
  )
}
