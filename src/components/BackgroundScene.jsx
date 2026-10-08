import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Line, MeshTransmissionMaterial, PointMaterial, Points } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const clamp = (value) => Math.min(Math.max(value, 0), 1)

function usePointer() {
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return pointer
}

function useFlightPath() {
  return useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0, 0.15, 8.5),
          new THREE.Vector3(0, 0.05, 2.7),
          new THREE.Vector3(-0.9, 0.55, -8),
          new THREE.Vector3(1.45, -0.45, -20),
          new THREE.Vector3(-1.25, 0.35, -34),
          new THREE.Vector3(0.65, -0.15, -48),
          new THREE.Vector3(0, 0, -61),
        ],
        false,
        'catmullrom',
        0.5
      ),
    []
  )
}

function ScrollDriver({ state }) {
  useFrame(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const target = maxScroll > 0 ? clamp(window.scrollY / maxScroll) : 0
    const previous = state.current.progress
    state.current.progress += (target - state.current.progress) * 0.045
    state.current.velocity += ((state.current.progress - previous) - state.current.velocity) * 0.16
  })
  return null
}

function CameraRig({ curve, state, pointer }) {
  const { camera } = useThree()
  const current = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const destination = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const progress = clamp(state.current.progress)
    const eased = progress * progress * (3 - 2 * progress)
    curve.getPointAt(eased, current)
    curve.getPointAt(Math.min(eased + 0.028, 1), ahead)

    tangent.copy(ahead).sub(current).normalize()
    side.crossVectors(tangent, UP).normalize()

    destination
      .copy(current)
      .addScaledVector(side, pointer.current.x * 0.28)
      .addScaledVector(UP, -pointer.current.y * 0.18 + Math.sin(clock.elapsedTime * 0.32) * 0.035)

    camera.position.lerp(destination, 0.065)

    lookAt
      .copy(ahead)
      .addScaledVector(side, pointer.current.x * 0.14)
      .addScaledVector(UP, -pointer.current.y * 0.08)

    camera.lookAt(lookAt)

    const speed = Math.min(Math.abs(state.current.velocity) * 1500, 1)
    const targetFov = 44 + speed * 6
    camera.fov += (targetFov - camera.fov) * 0.07
    camera.updateProjectionMatrix()
  })

  return null
}

function HeroSculpture({ curve, state }) {
  const group = useRef()
  const knot = useRef()
  const outer = useRef()
  const position = useMemo(() => curve.getPointAt(0.1), [curve])

  useFrame(({ clock }) => {
    const progress = state.current.progress
    const proximity = Math.max(0, 1 - Math.abs(progress - 0.1) / 0.18)
    if (group.current) {
      group.current.rotation.y = clock.elapsedTime * 0.09
      group.current.rotation.x = Math.sin(clock.elapsedTime * 0.22) * 0.12
      group.current.scale.setScalar(0.92 + proximity * 0.14)
    }
    if (knot.current) knot.current.rotation.z = clock.elapsedTime * 0.08
    if (outer.current) outer.current.rotation.z = -clock.elapsedTime * 0.055
  })

  return (
    <Float speed={0.65} rotationIntensity={0.08} floatIntensity={0.18}>
      <group ref={group} position={position}>
        <mesh ref={knot}>
          <torusKnotGeometry args={[1.45, 0.42, 220, 36, 2, 3]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.85}
            roughness={0.08}
            ior={1.16}
            chromaticAberration={0.03}
            anisotropy={0.25}
            samples={6}
            color="#8f84ff"
          />
        </mesh>

        <mesh ref={outer} rotation={[Math.PI / 2.7, 0, 0]}>
          <torusGeometry args={[2.45, 0.035, 16, 160]} />
          <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.12} emissive="#786cff" emissiveIntensity={0.3} />
        </mesh>

        <mesh rotation={[Math.PI / 2.05, 0.15, 0.4]}>
          <torusGeometry args={[2.9, 0.012, 12, 160]} />
          <meshBasicMaterial color="#d9e0ff" transparent opacity={0.28} />
        </mesh>

        <pointLight color="#7b6cff" intensity={18} distance={8} />
        <pointLight color="#d9f5ff" intensity={6} distance={7} position={[1.5, 1.2, 1.8]} />
      </group>
    </Float>
  )
}

function Gateway({ curve, fraction, scale = 1, state, tilt = 0 }) {
  const group = useRef()
  const ring = useRef()
  const disk = useRef()
  const position = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()),
    [curve, fraction]
  )

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) / 0.1)
    if (group.current) group.current.scale.setScalar(scale * (1 + proximity * 0.12))
    if (ring.current) ring.current.rotation.z = tilt + clock.elapsedTime * 0.05
    if (disk.current) disk.current.material.opacity = 0.025 + proximity * 0.07
  })

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={ring}>
        <torusGeometry args={[3.65, 0.065, 18, 150]} />
        <meshStandardMaterial color="#dcdcff" metalness={0.96} roughness={0.13} emissive="#7163ff" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={disk}>
        <circleGeometry args={[3.5, 96]} />
        <meshBasicMaterial color="#9c94ff" transparent opacity={0.03} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function MonolithField({ curve, state }) {
  const items = useMemo(() => {
    return Array.from({ length: 9 }, (_, index) => {
      const t = 0.46 + index * 0.045
      const center = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t).normalize()
      const side = new THREE.Vector3().crossVectors(tangent, UP).normalize()
      const direction = index % 2 === 0 ? 1 : -1
      center.addScaledVector(side, direction * (2.3 + (index % 3) * 0.45))
      center.y += ((index % 4) - 1.5) * 0.58
      return {
        t,
        position: center.toArray(),
        rotation: [0.12 * (index % 3), 0.22 * direction, 0.08 * direction],
        height: 2.7 + (index % 3) * 1.05,
      }
    })
  }, [curve])

  return items.map((item, index) => (
    <Monolith key={index} item={item} index={index} state={state} />
  ))
}

function Monolith({ item, index, state }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - item.t) * 5.5)
    ref.current.rotation.y = item.rotation[1] + Math.sin(clock.elapsedTime * 0.18 + index) * 0.025
    ref.current.position.y = item.position[1] + Math.sin(clock.elapsedTime * 0.3 + index * 0.7) * 0.08
    ref.current.scale.setScalar(0.94 + proximity * 0.08)
  })

  return (
    <mesh ref={ref} position={item.position} rotation={item.rotation}>
      <boxGeometry args={[0.28, item.height, 1.1]} />
      <meshPhysicalMaterial
        color={index % 2 ? '#282834' : '#111118'}
        metalness={0.82}
        roughness={0.18}
        clearcoat={1}
        clearcoatRoughness={0.09}
      />
    </mesh>
  )
}

function FinalOrb({ curve, state }) {
  const shell = useRef()
  const core = useRef()
  const position = useMemo(() => curve.getPointAt(0.9), [curve])

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - 0.9) / 0.16)
    if (shell.current) {
      shell.current.rotation.x = clock.elapsedTime * 0.055
      shell.current.rotation.y = clock.elapsedTime * 0.07
      shell.current.scale.setScalar(1 + proximity * 0.18)
    }
    if (core.current) core.current.scale.setScalar(0.78 + proximity * 0.25)
  })

  return (
    <group position={position}>
      <mesh ref={shell}>
        <icosahedronGeometry args={[2.2, 4]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={1.05}
          roughness={0.06}
          ior={1.2}
          chromaticAberration={0.02}
          samples={5}
          color="#d9ddff"
        />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.62, 48, 48]} />
        <meshStandardMaterial color="#ffffff" emissive="#786cff" emissiveIntensity={6} roughness={0.12} />
      </mesh>
      <pointLight color="#786cff" intensity={24} distance={11} />
    </group>
  )
}

function SparseParticles() {
  const points = useRef()
  const count = 420
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 16
      data[i * 3 + 1] = (Math.random() - 0.5) * 11
      data[i * 3 + 2] = 8 - Math.random() * 72
    }
    return data
  }, [])

  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.z = Math.sin(clock.elapsedTime * 0.025) * 0.018
  })

  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled>
      <PointMaterial transparent color="#e8e7ff" size={0.022} sizeAttenuation depthWrite={false} opacity={0.38} />
    </Points>
  )
}

function PathLine({ curve }) {
  const points = useMemo(() => curve.getPoints(120), [curve])
  return <Line points={points} color="#7064ff" transparent opacity={0.13} lineWidth={0.75} />
}

function Scene({ veilRef }) {
  const curve = useFlightPath()
  const pointer = usePointer()
  const state = useRef({ progress: 0, velocity: 0 })

  useFrame(() => {
    if (!veilRef?.current) return
    const speed = Math.min(Math.abs(state.current.velocity) * 1300, 1)
    veilRef.current.style.opacity = String(0.88 - speed * 0.08)
  })

  return (
    <>
      <fog attach="fog" args={['#060608', 10, 66]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[4, 7, 7]} intensity={1.3} color="#ffffff" />
      <pointLight position={[-4, 2, -13]} intensity={8} color="#7569ff" distance={18} />
      <pointLight position={[3, -2, -39]} intensity={7} color="#d7e7ff" distance={18} />

      <Suspense fallback={null}>
        <Environment preset="city" background={false} />
      </Suspense>

      <PathLine curve={curve} />
      <HeroSculpture curve={curve} state={state} />
      <Gateway curve={curve} fraction={0.31} scale={1.05} state={state} />
      <Gateway curve={curve} fraction={0.59} scale={1.16} state={state} tilt={0.7} />
      <Gateway curve={curve} fraction={0.78} scale={1.28} state={state} tilt={-0.45} />
      <MonolithField curve={curve} state={state} />
      <FinalOrb curve={curve} state={state} />
      <SparseParticles />

      <ScrollDriver state={state} />
      <CameraRig curve={curve} state={state} pointer={pointer} />

      <EffectComposer multisampling={0}>
        <Bloom intensity={0.7} luminanceThreshold={0.45} luminanceSmoothing={0.8} mipmapBlur />
        <Vignette offset={0.22} darkness={0.72} />
        <Noise opacity={0.009} />
      </EffectComposer>
    </>
  )
}

export default function BackgroundScene({ veilRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 8.5], fov: 44, near: 0.1, far: 100 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <Scene veilRef={veilRef} />
    </Canvas>
  )
}
