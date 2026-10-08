import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import CursorGlow from './components/CursorGlow.jsx'
import ImmersiveFallback from './components/ImmersiveFallback.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import Projects from './pages/Projects.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import Experience from './pages/Experience.jsx'
import Contact from './pages/Contact.jsx'
import { NAME } from './data/site.js'

const BackgroundScene = lazy(() => import('./components/BackgroundScene.jsx'))

const NAV_LINKS = [
  { to: '/projets', label: 'Projets' },
  { to: '/experience', label: 'Parcours' },
  { to: '/contact', label: 'Contact' },
]

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('3D scene disabled after a runtime error:', error)
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}


function WebGLScene({ veilRef, pathname, hovered }) {
  const [supported, setSupported] = useState(null)
  useEffect(() => {
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2')
      setSupported(Boolean(gl))
    } catch {
      setSupported(false)
    }
  }, [])

  if (supported === false) return null
  if (supported === null) return null

  return (
    <SceneErrorBoundary>
      <Suspense fallback={null}>
        <BackgroundScene veilRef={veilRef} pathname={pathname} hovered={hovered} />
      </Suspense>
    </SceneErrorBoundary>
  )
}

function Loader() {
  return (
    <motion.div className="loader-screen" exit={{ opacity: 0 }} transition={{ duration: 0.55 }}>
      <div className="loader-minimal">
        <span>CC</span>
        <motion.i
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  )
}

function Nav() {
  const { pathname } = useLocation()

  return (
    <motion.nav
      className="site-nav nav-minimal"
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.75, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
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
    </motion.nav>
  )
}

function BackgroundLayer({ pathname, hovered }) {
  const veilRef = useRef(null)

  return (
    <div className="background-layer" aria-hidden="true">
      <ImmersiveFallback pathname={pathname} hovered={hovered} />
      <WebGLScene veilRef={veilRef} pathname={pathname} hovered={hovered} />
      <div ref={veilRef} className="scene-veil" />
    </div>
  )
}

function RouteTransition({ children, routeKey }) {
  return (
    <motion.div
      key={routeKey}
      className="route-stage"
      initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes({ onBranchHover }) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<RouteTransition routeKey="home"><Home onBranchHover={onBranchHover} /></RouteTransition>} />
        <Route path="/projets" element={<RouteTransition routeKey="projects"><Projects onBranchHover={onBranchHover} /></RouteTransition>} />
        <Route path="/projets/:slug" element={<RouteTransition routeKey="project"><ProjectDetail /></RouteTransition>} />
        <Route path="/experience" element={<RouteTransition routeKey="experience"><Experience /></RouteTransition>} />
        <Route path="/contact" element={<RouteTransition routeKey="contact"><Contact /></RouteTransition>} />
      </Routes>
    </AnimatePresence>
  )
}

function AppShell() {
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState('')
  const { pathname } = useLocation()

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 900)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <AnimatePresence>{loading && <Loader key="loader" />}</AnimatePresence>
      <BackgroundLayer pathname={pathname} hovered={hovered} />
      <div className="site-grain" aria-hidden="true" />
      <CursorGlow />
      <Nav />
      <ScrollToTop />
      <main className="site-main">
        <AnimatedRoutes onBranchHover={setHovered} />
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
