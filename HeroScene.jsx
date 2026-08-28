import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere, Points, PointMaterial } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

function Blob() {
  const meshRef = useRef()
  const [target, setTarget] = useState({ x: 0, y: 0 })

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (!meshRef.current) return

    // Ambient rotation
    meshRef.current.rotation.x = Math.sin(t / 4) * 0.3
    meshRef.current.rotation.y += 0.0015

    // Mouse-reactive tilt (lerped for smoothness)
    meshRef.current.rotation.x += (target.y * 0.3 - meshRef.current.rotation.x) * 0.02
    meshRef.current.rotation.y += (target.x * 0.3) * 0.001

    // Gentle breathing scale
    const scale = 1.4 + Math.sin(t * 0.6) * 0.04
    meshRef.current.scale.set(scale, scale, scale)
  })

  const handlePointerMove = (state) => {
    setTarget({
      x: (state.pointer.x || 0),
      y: (state.pointer.y || 0),
    })
  }

  return (
    <Sphere
      ref={meshRef}
      args={[1, 128, 128]}
      onPointerMove={handlePointerMove}
    >
      <MeshDistortMaterial
        color="#7c5cff"
        emissive="#2a1a5e"
        emissiveIntensity={0.4}
        roughness={0.15}
        metalness={0.6}
        distort={0.45}
        speed={1.8}
      />
    </Sphere>
  )
}

function Particles() {
  const ref = useRef()
  const count = 900
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02
  })

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color="#ff5470"
        size={0.02}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
      />
    </Points>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color="#ff5470" />
      <pointLight position={[-3, -2, -2]} intensity={0.8} color="#7c5cff" />
      <Blob />
      <Particles />
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
