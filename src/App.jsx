import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import CursorGlow from './components/CursorGlow.jsx'
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
    if (this.state.failed) return <FallbackTunnel />
    return this.props.children
  }
}


function FallbackTunnel() {
  return (
    <div className="tunnel-fallback" aria-hidden="true">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="tunnel-a"><stop stopColor="#36316c" stopOpacity=".6"/><stop offset=".56" stopColor="#10101c" stopOpacity=".65"/><stop offset="1" stopColor="#060608"/></radialGradient>
          <linearGradient id="tunnel-b"><stop stopColor="#9c94ff"/><stop offset=".48" stopColor="#d5d3ff"/><stop offset="1" stopColor="#7b8ff4"/></linearGradient>
          <filter id="tunnel-glow"><feGaussianBlur stdDeviation="5"/></filter>
        </defs>
        <rect width="1200" height="800" fill="url(#tunnel-a)"/>
        <g stroke="url(#tunnel-b)" fill="none">
          <ellipse cx="610" cy="410" rx="430" ry="290" strokeOpacity=".16" strokeWidth="7"/>
          <ellipse cx="610" cy="410" rx="340" ry="230" strokeOpacity=".23" strokeWidth="5"/>
          <ellipse cx="610" cy="410" rx="258" ry="177" strokeOpacity=".37" strokeWidth="5"/>
          <ellipse cx="610" cy="410" rx="185" ry="125" strokeOpacity=".58" strokeWidth="5"/>
          <ellipse cx="610" cy="410" rx="116" ry="77" strokeOpacity=".84" strokeWidth="5"/>
          <ellipse cx="610" cy="410" rx="62" ry="42" strokeOpacity=".95" strokeWidth="3"/>
          <path d="M180 410L548 410 M1040 410L672 410 M610 120L610 368 M610 700L610 452" strokeOpacity=".27" strokeWidth="3"/>
          <path d="M610 410 Q465 375 190 185 M610 410 Q755 370 1015 180 M610 410 Q610 490 610 745" strokeOpacity=".35" strokeWidth="4"/>
        </g>
        <ellipse cx="610" cy="410" rx="185" ry="125" fill="none" stroke="#9487ff" strokeOpacity=".28" strokeWidth="18" filter="url(#tunnel-glow)"/>
      </svg>
    </div>
  )
}

function WebGLScene({ veilRef, pathname, hovered }) {
  const [supported, setSupported] = useState(null)
  useEffect(() => {
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      setSupported(Boolean(gl))
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      setSupported(false)
    }
  }, [])

  if (supported === false) return <FallbackTunnel />
  if (supported === null) return <FallbackTunnel />

  return (
    <SceneErrorBoundary>
      <Suspense fallback={<FallbackTunnel />}>
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
