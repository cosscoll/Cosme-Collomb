import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function CursorGlow() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(pointer: coarse)').matches) return

    const quickX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const quickY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })

    const handleMove = (e) => {
      quickX(e.clientX)
      quickY(e.clientY)
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 380,
        height: 380,
        marginLeft: -190,
        marginTop: -190,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(124,92,255,0.16) 0%, rgba(124,92,255,0) 70%)',
        pointerEvents: 'none',
        zIndex: 1,
        willChange: 'transform',
      }}
    />
  )
}
