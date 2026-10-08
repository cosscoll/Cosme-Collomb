import { Suspense, useEffect, useRef, useState } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BackgroundScene from './components/BackgroundScene.jsx'
import CursorGlow from './components/CursorGlow.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import Experience from './pages/Experience.jsx'
import Contact from './pages/Contact.jsx'
import { NAME } from './data/site.js'

const NAV_LINKS = [
  { to: '/projets', label: 'Projets' },
  { to: '/experience', label: 'Parcours' },
  { to: '/contact', label: 'Contact' },
]

function Loader() {
  return (
    <motion.div className="loader-screen" exit={{ opacity: 0, filter: 'blur(12px)' }} transition={{ duration: 0.7 }}>
      <div className="loader-mark">
        <motion.div
          className="loader-ring loader-ring-a"
          animate={{ rotate: 360, scale: [0.9, 1.05, 0.9] }}
          transition={{ rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.8, repeat: Infinity } }}
        />
        <motion.div
          className="loader-ring loader-ring-b"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
        <span>CC</span>
      </div>
      <div className="loader-copy">
        <span>INITIALISING EXPERIENCE</span>
        <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </motion.div>
  )
}

function Nav() {
  const { pathname } = useLocation()
  return (
    <motion.nav
      className="site-nav"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to="/" className="nav-brand">
        <span className="nav-brand-dot" />
        <span>{NAME}</span>
      </Link>
      <div className="nav-links">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.to || pathname.startsWith(`${link.to}/`)
          return (
            <Link key={link.to} to={link.to} className={active ? 'active' : ''}>
              {active && <motion.span className="nav-active-pill" layoutId="nav-active" />}
              <span className="nav-label">{link.label}</span>
            </Link>
          )
        })}
      </div>
      <span className="nav-mode">INTERACTIVE / 3D</span>
    </motion.nav>
  )
}

function BackgroundLayer() {
  const veilRef = useRef(null)
  return (
    <div className="background-layer" aria-hidden="true">
      <Suspense fallback={null}>
        <BackgroundScene name={NAME} veilRef={veilRef} />
      </Suspense>
      <div ref={veilRef} className="scene-veil" />
      <div className="scene-grid" />
    </div>
  )
}

function RouteTransition({ children, routeKey }) {
  return (
    <motion.div
      key={routeKey}
      className="route-stage"
      initial={{ opacity: 0, clipPath: 'inset(5% 0 5% 0)', filter: 'blur(14px)' }}
      animate={{ opacity: 1, clipPath: 'inset(0% 0 0% 0)', filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.985, filter: 'blur(10px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<RouteTransition routeKey="home"><Home /></RouteTransition>} />
        <Route path="/projets" element={<RouteTransition routeKey="projects"><Projects /></RouteTransition>} />
        <Route path="/projets/:slug" element={<RouteTransition routeKey="project"><ProjectDetail /></RouteTransition>} />
        <Route path="/experience" element={<RouteTransition routeKey="experience"><Experience /></RouteTransition>} />
        <Route path="/contact" element={<RouteTransition routeKey="contact"><Contact /></RouteTransition>} />
      </Routes>
    </AnimatePresence>
  )
}

function AppShell() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 1250)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" />}</AnimatePresence>
      <BackgroundLayer />
      <div className="site-grain" aria-hidden="true" />
      <CursorGlow />
      <Nav />
      <ScrollToTop />
      <main className="site-main">
        <AnimatedRoutes />
      </main>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}
