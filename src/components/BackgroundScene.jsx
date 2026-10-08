import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, MeshTransmissionMaterial, PointMaterial, Points } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import AssemblingName from './AssemblingName.jsx'

const COLORS = ['#8b5cf6', '#4de8ff', '#ff4d9d', '#ffffff']
const UP = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const clamp = (v) => Math.min(Math.max(v, 0), 1)

function usePointer() {
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return pointer
}

function useFlightPath() {
  return useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 7.8),
    new THREE.Vector3(0, 0.2, 1.2),
    new THREE.Vector3(-1.8, 1.1, -8),
    new THREE.Vector3(2.7, -0.9, -17),
    new THREE.Vector3(-2.4, -0.2, -27),
    new THREE.Vector3(2, 1.1, -37),
    new THREE.Vector3(-0.9, -0.8, -47),
    new THREE.Vector3(0, 0, -57),
  ], false, 'catmullrom', 0.42), [])
}

function ScrollDriver({ state }) {
  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const target = max > 0 ? clamp(window.scrollY / max) : 0
    const previous = state.current.progress
    state.current.progress += (target - state.current.progress) * 0.055
    state.current.velocity += ((state.current.progress - previous) - state.current.velocity) * 0.18
  })
  return null
}

function CameraRig({ curve, state, pointer }) {
  const { camera } = useThree()
  const p = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const s = clamp(state.current.progress)
    const eased = s * s * (3 - 2 * s)
    curve.getPointAt(eased, p)
    curve.getPointAt(Math.min(eased + 0.025, 1), ahead)
    tangent.copy(ahead).sub(p).normalize()
    side.crossVectors(tangent, UP).normalize()

    target.copy(p)
      .addScaledVector(side, pointer.current.x * 0.5)
      .addScaledVector(UP, -pointer.current.y * 0.32 + Math.sin(clock.elapsedTime * 0.45) * 0.07)
    camera.position.lerp(target, 0.075)

    look.copy(ahead)
      .addScaledVector(side, pointer.current.x * 0.24)
      .addScaledVector(UP, -pointer.current.y * 0.16)
    camera.lookAt(look)

    const speed = Math.min(Math.abs(state.current.velocity) * 1700, 1)
    const pulse = [0.24, 0.5, 0.75].reduce((sum, x) => sum + Math.exp(-Math.pow((s - x) / 0.04, 2)), 0)
    camera.fov += (48 + speed * 13 + pulse * 5 - camera.fov) * 0.08
    camera.updateProjectionMatrix()
    camera.rotateZ((-pointer.current.x * 0.018 + Math.sin(s * Math.PI * 8) * 0.006) * (0.25 + speed))
  })
  return null
}

function Tunnel({ curve, state }) {
  const frames = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const t = 0.03 + (i / 29) * 0.94
    const point = curve.getPointAt(t)
    const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(t).normalize())
    return { point, q, t, color: COLORS[i % 3], radius: 4.25 + (i % 4) * 0.12 }
  }), [curve])

  return (
    <>
      <mesh>
        <tubeGeometry args={[curve, 180, 5.15, 10, false]} />
        <meshBasicMaterial color="#7258ff" wireframe transparent opacity={0.045} side={THREE.BackSide} />
      </mesh>
      {frames.map((frame, i) => <TunnelRing key={i} {...frame} index={i} state={state} />)}
    </>
  )
}

function TunnelRing({ point, q, t, color, radius, index, state }) {
  const ring = useRef()
  const mat = useRef()
  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - t) * 8)
    if (ring.current) {
      ring.current.rotation.z = clock.elapsedTime * (index % 2 ? 0.035 : -0.03) + index * 0.12
      ring.current.scale.setScalar(1 + proximity * 0.16)
    }
    if (mat.current) mat.current.opacity = 0.09 + proximity * 0.36
  })
  return (
    <group position={point} quaternion={q}>
      <mesh ref={ring}>
        <torusGeometry args={[radius, index % 4 === 0 ? 0.04 : 0.018, 8, 72]} />
        <meshBasicMaterial ref={mat} color={color} transparent opacity={0.1} />
      </mesh>
    </group>
  )
}

function Portal({ curve, fraction, color, state, index }) {
  const group = useRef()
  const ring = useRef()
  const point = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()), [curve, fraction])

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) / 0.075)
    if (group.current) group.current.scale.setScalar(1 + proximity * 0.28)
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * (index % 2 ? 0.28 : -0.24)
  })

  return (
    <group ref={group} position={point} quaternion={q}>
      <mesh ref={ring}>
        <torusGeometry args={[3.85, 0.09, 18, 96]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[4.42, 0.022, 10, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.32} />
      </mesh>
      <mesh>
        <ringGeometry args={[3.2, 4.82, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Portals({ curve, state }) {
  return [
    [0.24, '#8b5cf6'], [0.5, '#4de8ff'], [0.75, '#ff4d9d'], [0.93, '#8b5cf6'],
  ].map(([fraction, color], index) => (
    <Portal key={fraction} curve={curve} fraction={fraction} color={color} state={state} index={index} />
  ))
}

function Core({ curve, state }) {
  const group = useRef()
  const wire = useRef()
  const point = useMemo(() => curve.getPointAt(0.115), [curve])
  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - 0.1) / 0.17)
    if (group.current) {
      group.current.rotation.x = clock.elapsedTime * 0.12
      group.current.rotation.y = clock.elapsedTime * 0.18
      group.current.scale.setScalar(0.88 + proximity * 0.34)
    }
    if (wire.current) wire.current.rotation.y = clock.elapsedTime * -0.3
  })
  return (
    <Float speed={1.35} rotationIntensity={0.2} floatIntensity={0.35}>
      <group ref={group} position={point}>
        <mesh>
          <icosahedronGeometry args={[1.65, 3]} />
          <MeshTransmissionMaterial thickness={0.9} roughness={0.12} transmission={1} ior={1.18} chromaticAberration={0.08} color="#7b68ff" />
        </mesh>
        <mesh ref={wire} scale={1.18}>
          <icosahedronGeometry args={[1.65, 1]} />
          <meshBasicMaterial color="#4de8ff" wireframe transparent opacity={0.32} />
        </mesh>
        <pointLight color="#8b5cf6" intensity={13} distance={8} />
      </group>
    </Float>
  )
}

function Debris({ curve, state }) {
  const configs = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const t = 0.05 + Math.random() * 0.9
    const center = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t).normalize()
    const side = new THREE.Vector3().crossVectors(tangent, UP).normalize()
    center.addScaledVector(side, (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 2.7))
    center.y += (Math.random() - 0.5) * 5.5
    return {
      t, position: center.toArray(), baseY: center.y, color: COLORS[i % COLORS.length],
      scale: 0.25 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.01, type: i % 3,
    }
  }), [curve])
  return configs.map((config, i) => <DebrisPiece key={i} config={config} state={state} />)
}

function DebrisPiece({ config, state }) {
  const mesh = useRef()
  useFrame(({ clock }) => {
    if (!mesh.current) return
    mesh.current.rotation.x += config.spin
    mesh.current.rotation.y -= config.spin * 0.7
    mesh.current.position.y = config.baseY + Math.sin(clock.elapsedTime * 0.55 + config.phase) * 0.18
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - config.t) * 5)
    mesh.current.scale.setScalar(config.scale * (1 + proximity * 0.2))
  })
  return (
    <mesh ref={mesh} position={config.position}>
      {config.type === 0 ? <boxGeometry args={[0.55,0.55,0.55]} /> : config.type === 1 ? <octahedronGeometry args={[0.5,0]} /> : <tetrahedronGeometry args={[0.52,0]} />}
      <meshStandardMaterial color={config.color} emissive={config.color} emissiveIntensity={0.35} wireframe transparent opacity={0.32} metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

function Particles() {
  const ref = useRef()
  const count = 1800
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      data[i * 3] = (Math.random() - 0.5) * 18
      data[i * 3 + 1] = (Math.random() - 0.5) * 13
      data[i * 3 + 2] = 8 - Math.random() * 70
    }
    return data
  }, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.05) * 0.05
  })
  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled>
      <PointMaterial transparent color="#ffffff" size={0.028} sizeAttenuation depthWrite={false} opacity={0.58} />
    </Points>
  )
}

function Scene({ name, veilRef }) {
  const curve = useFlightPath()
  const pointer = usePointer()
  const state = useRef({ progress: 0, velocity: 0 })

  useFrame(() => {
    if (!veilRef?.current) return
    const speed = Math.min(Math.abs(state.current.velocity) * 1500, 1)
    veilRef.current.style.opacity = String(0.82 - speed * 0.12)
  })

  return (
    <>
      <fog attach="fog" args={['#07070b', 7, 61]} />
      <ambientLight intensity={0.28} />
      <pointLight position={[4, 5, 4]} intensity={7} color="#8b5cf6" distance={18} />
      <pointLight position={[-5, -3, -8]} intensity={6} color="#4de8ff" distance={19} />
      <pointLight position={[2, 4, -24]} intensity={5} color="#ff4d9d" distance={20} />
      <Suspense fallback={null}><Environment preset="city" background={false} /></Suspense>
      <Tunnel curve={curve} state={state} />
      <Core curve={curve} state={state} />
      <Debris curve={curve} state={state} />
      <Portals curve={curve} state={state} />
      <Particles />
      <AssemblingName name={name} position={[0, 1.45, 1.7]} />
      <ScrollDriver state={state} />
      <CameraRig curve={curve} state={state} pointer={pointer} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.05} luminanceThreshold={0.16} luminanceSmoothing={0.82} mipmapBlur />
        <ChromaticAberration offset={[0.0011, 0.0016]} />
        <Vignette offset={0.16} darkness={0.82} />
        <Noise opacity={0.018} />
      </EffectComposer>
    </>
  )
}

export default function BackgroundScene({ name = 'TON NOM', veilRef }) {
  return (
    <Canvas camera={{ position: [0, 0, 7.8], fov: 48, near: 0.1, far: 100 }} dpr={[1, 1.6]} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
      <Scene name={name} veilRef={veilRef} />
    </Canvas>
  )
}
