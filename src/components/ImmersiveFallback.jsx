import { useEffect, useState } from 'react'

const bound = (n) => Math.max(0, Math.min(1, n))
const FRAMES = Array.from({ length: 10 }, (_, i) => i)
const COLORS = ['#aba4ff', '#91d9ff', '#efb1dc']

/**
 * The lightweight architectural scene remains animated without WebGL.
 * All paths are still accessible through the real HTML navigation.
 */
export default function ImmersiveFallback({ pathname = '/', hovered = '' }) {
  const [travel, setTravel] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const fork = document.getElementById('embranchements')
        const distance = pathname === '/'
          ? Math.max(window.innerHeight, fork?.offsetTop || window.innerHeight * 1.2)
          : Math.max(window.innerHeight, document.documentElement.scrollHeight - window.innerHeight)
        setTravel(bound(window.scrollY / distance))
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  const forkVisible = pathname !== '/' || travel > 0.42
  const active = hovered === 'projects' || pathname.startsWith('/projets') ? 0
    : hovered === 'experience' || pathname === '/experience' ? 1
      : hovered === 'contact' || pathname === '/contact' ? 2 : -1

  return (
    <div className="architectural-fallback" aria-hidden="true">
      <div className="architecture-haze" />
      <div className="architecture-ray architecture-ray-a" />
      <div className="architecture-ray architecture-ray-b" />
      <div className="architecture-scenery">
        {FRAMES.map((i) => {
          const z = -185 - i * 155 + travel * 680
          const phase = i * 0.65 + travel * 1.6
          return (
            <div className={'architecture-frame ' + (i % 3 === 0 ? 'architecture-frame-main' : '')}
              key={i}
              style={{
                transform: 'translate(-50%, -50%) translateZ(' + z + 'px) rotateZ(' + (phase * 1.5) + 'deg)',
                opacity: z > 250 ? 0 : Math.min(0.95, 0.28 + (10 - i) * 0.04),
              }}>
              <span className="architecture-frame-edge" />
              <span className="architecture-frame-line" />
            </div>
          )
        })}
        <div className="architecture-horizon"
          style={{ transform: 'translate(-50%, -50%) scale(' + (1 + travel * 0.7) + ')' }} />
        {forkVisible && (
          <div className="architecture-forks">
            {COLORS.map((color, i) => (
              <div key={i}
                className={'architecture-fork ' + (active === i ? 'architecture-fork-active' : '')}
                style={{
                  '--fork-color': color,
                  transform: 'translate(-50%, -50%) translateX(' + ((i - 1) * 34) + 'vw) rotateY(' + ((1 - i) * 17) + 'deg) translateZ(-250px)',
                }}>
                <span className="architecture-fork-ring" />
                <span className="architecture-fork-line" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="architecture-vignette" />
    </div>
  )
}
