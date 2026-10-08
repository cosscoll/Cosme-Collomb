import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointMaterial, Points } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
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
          new THREE.Vector3(0, 0, 8.8),
          new THREE.Vector3(0.15, 0.08, 2.6),
          new THREE.Vector3(-0.75, 0.55, -7),
          new THREE.Vector3(-1.8, -0.35, -17),
          new THREE.Vector3(1.65, -0.8, -29),
          new THREE.Vector3(2.1, 0.65, -41),
          new THREE.Vector3(-1.55, 0.45, -53),
          new THREE.Vector3(-0.45, -0.3, -65),
          new THREE.Vector3(0, 0, -76),
        ],
        false,
        'catmullrom',
        0.6
      ),
    []
  )
}

function ScrollDriver({ state }) {
  useFrame(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const target = maxScroll > 0 ? clamp(window.scrollY / maxScroll) : 0
    const previous = state.current.progress

    state.current.progress += (target - state.current.progress) * 0.048
    state.current.velocity += ((state.current.progress - previous) - state.current.velocity) * 0.14
  })

  return null
}

function CameraRig({ curve, state, pointer }) {
  const { camera } = useThree()
  const current = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const aheadFar = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const nextTangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const destination = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const targetQuat = useMemo(() => new THREE.Quaternion(), [])
  const rollQuat = useMemo(() => new THREE.Quaternion(), [])
  const rotationMatrix = useMemo(() => new THREE.Matrix4(), [])
  const bendCross = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const progress = clamp(state.current.progress)
    const eased = progress * progress * (3 - 2 * progress)

    curve.getPointAt(eased, current)
    curve.getPointAt(Math.min(eased + 0.022, 1), ahead)
    curve.getPointAt(Math.min(eased + 0.05, 1), aheadFar)

    tangent.copy(ahead).sub(current).normalize()
    nextTangent.copy(aheadFar).sub(ahead).normalize()
    side.crossVectors(tangent, UP).normalize()

    const pointerAmount = 0.17 + Math.min(Math.abs(state.current.velocity) * 420, 0.2)

    destination
      .copy(current)
      .addScaledVector(side, pointer.current.x * pointerAmount)
      .addScaledVector(UP, -pointer.current.y * pointerAmount * 0.62)
      .addScaledVector(UP, Math.sin(clock.elapsedTime * 0.24) * 0.022)

    camera.position.lerp(destination, 0.072)

    lookTarget
      .copy(aheadFar)
      .addScaledVector(side, pointer.current.x * 0.075)
      .addScaledVector(UP, -pointer.current.y * 0.05)

    rotationMatrix.lookAt(camera.position, lookTarget, UP)
    targetQuat.setFromRotationMatrix(rotationMatrix)

    bendCross.crossVectors(tangent, nextTangent)
    const bend = bendCross.dot(UP)
    const scrollBoost = Math.min(Math.abs(state.current.velocity) * 1200, 1)
    const roll = THREE.MathUtils.clamp(-bend * 2.7, -0.12, 0.12) - pointer.current.x * 0.01

    rollQuat.setFromAxisAngle(Z_AXIS, roll * (0.72 + scrollBoost * 0.28))
    targetQuat.multiply(rollQuat)
    camera.quaternion.slerp(targetQuat, 0.078)

    const targetFov = 45 + scrollBoost * 6.5
    camera.fov += (targetFov - camera.fov) * 0.07
    camera.updateProjectionMatrix()
  })

  return null
}

function TunnelShell({ curve }) {
  return (
    <>
      <mesh>
        <tubeGeometry args={[curve, 460, 4.82, 56, false]} />
        <meshStandardMaterial
          color="#10101a"
          roughness={0.28}
          metalness={0.48}
          emissive="#17142b"
          emissiveIntensity={0.6}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh>
        <tubeGeometry args={[curve, 460, 4.7, 40, false]} />
        <meshBasicMaterial
          color="#9188ff"
          wireframe
          transparent
          opacity={0.055}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

function createRailCurve(curve, angle, radius = 4.42) {
  const points = []
  const segments = 110

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const center = curve.getPointAt(t)
    const tangent = curve.getTangentAt(t).normalize()

    let normal = new THREE.Vector3().crossVectors(tangent, UP)
    if (normal.lengthSq() < 0.0001) normal.set(1, 0, 0)
    normal.normalize()

    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()
    const offset = normal
      .clone()
      .multiplyScalar(Math.cos(angle) * radius)
      .add(binormal.clone().multiplyScalar(Math.sin(angle) * radius))

    points.push(center.clone().add(offset))
  }

  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
}

function LightRails({ curve }) {
  const rails = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) =>
        createRailCurve(curve, (Math.PI * 2 * index) / 8)
      ),
    [curve]
  )

  return rails.map((rail, index) => {
    const primary = index % 2 === 0

    return (
      <mesh key={index}>
        <tubeGeometry args={[rail, 360, primary ? 0.028 : 0.014, 10, false]} />
        <meshBasicMaterial
          color={primary ? '#9289ff' : '#dce7ff'}
          transparent
          opacity={primary ? 0.9 : 0.38}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    )
  })
}

function TunnelRing({ curve, fraction, index, state, major = false }) {
  const group = useRef()
  const ring = useRef()
  const ringMaterial = useRef()
  const glowMaterial = useRef()

  const position = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()),
    [curve, fraction]
  )

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) * (major ? 8 : 12))

    if (group.current) {
      const scale = 1 + proximity * (major ? 0.11 : 0.045)
      group.current.scale.setScalar(scale)
    }

    if (ring.current) {
      ring.current.rotation.z =
        (index % 2 === 0 ? 1 : -1) * clock.elapsedTime * (major ? 0.04 : 0.014) +
        index * 0.052
    }

    if (ringMaterial.current) {
      ringMaterial.current.opacity = (major ? 0.78 : 0.28) + proximity * (major ? 0.22 : 0.34)
    }

    if (glowMaterial.current) {
      glowMaterial.current.opacity = (major ? 0.18 : 0.04) + proximity * (major ? 0.16 : 0.08)
    }
  })

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={ring}>
        <torusGeometry args={[4.34, major ? 0.085 : 0.028, major ? 24 : 18, 220]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={major ? '#eef0ff' : '#8177ff'}
          transparent
          opacity={major ? 0.78 : 0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh>
        <torusGeometry args={[4.34, major ? 0.18 : 0.08, 14, 180]} />
        <meshBasicMaterial
          ref={glowMaterial}
          color={major ? '#8b80ff' : '#665cff'}
          transparent
          opacity={major ? 0.18 : 0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {major && (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[4.05, 0.022, 14, 220]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.52}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight color="#8177ff" intensity={14} distance={12} />
        </>
      )}
    </group>
  )
}

function TunnelRings({ curve, state }) {
  const rings = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const fraction = 0.025 + (index / 41) * 0.95
        const major =
          Math.abs(fraction - 0.24) < 0.022 ||
          Math.abs(fraction - 0.5) < 0.022 ||
          Math.abs(fraction - 0.76) < 0.022

        return { fraction, index, major }
      }),
    []
  )

  return rings.map((ring) => (
    <TunnelRing key={ring.index} curve={curve} state={state} {...ring} />
  ))
}

function SectionGlow({ curve, fraction, color, state, index }) {
  const group = useRef()
  const halo = useRef()
  const haloMaterial = useRef()

  const position = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()),
    [curve, fraction]
  )

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) / 0.12)

    if (group.current) {
      group.current.scale.setScalar(0.92 + proximity * 0.2)
      group.current.rotation.z = clock.elapsedTime * (index % 2 ? -0.022 : 0.022)
    }

    if (haloMaterial.current) {
      haloMaterial.current.opacity = 0.025 + proximity * 0.12
    }
  })

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={halo}>
        <circleGeometry args={[4.16, 160]} />
        <meshBasicMaterial
          ref={haloMaterial}
          color={color}
          transparent
          opacity={0.025}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh>
        <ringGeometry args={[3.55, 4.18, 160]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.11}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight color={color} intensity={12} distance={13} />
    </group>
  )
}

function SectionGlows({ curve, state }) {
  return [
    [0.24, '#766cff'],
    [0.5, '#a8c8ff'],
    [0.76, '#766cff'],
  ].map(([fraction, color], index) => (
    <SectionGlow
      key={fraction}
      curve={curve}
      fraction={fraction}
      color={color}
      state={state}
      index={index}
    />
  ))
}

function Dust() {
  const points = useRef()
  const count = 620

  const positions = useMemo(() => {
    const data = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const radius = 1.8 + Math.random() * 2.55
      const angle = Math.random() * Math.PI * 2

      data[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.3
      data[i * 3 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.3
      data[i * 3 + 2] = 9 - Math.random() * 88
    }

    return data
  }, [])

  useFrame(({ clock }) => {
    if (!points.current) return
    points.current.rotation.z = Math.sin(clock.elapsedTime * 0.03) * 0.014
  })

  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color="#f1f0ff"
        size={0.026}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  )
}

function Scene({ veilRef }) {
  const curve = useFlightPath()
  const pointer = usePointer()
  const state = useRef({ progress: 0, velocity: 0 })

  useFrame(() => {
    if (!veilRef?.current) return

    const speed = Math.min(Math.abs(state.current.velocity) * 1400, 1)
    veilRef.current.style.opacity = String(0.46 - speed * 0.06)
  })

  return (
    <>
      <fog attach="fog" args={['#060608', 10, 88]} />

      <ambientLight intensity={0.34} />
      <directionalLight position={[3, 6, 6]} intensity={1.6} color="#f5f6ff" />
      <pointLight position={[0, 0, 1]} intensity={8} color="#8177ff" distance={14} />
      <pointLight position={[2, -1, -25]} intensity={7} color="#a9c4ff" distance={19} />
      <pointLight position={[-2, 1, -52]} intensity={7} color="#756cff" distance={20} />

      <TunnelShell curve={curve} />
      <LightRails curve={curve} />
      <TunnelRings curve={curve} state={state} />
      <SectionGlows curve={curve} state={state} />
      <Dust />

      <ScrollDriver state={state} />
      <CameraRig curve={curve} state={state} pointer={pointer} />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.75}
          mipmapBlur
        />
        <Vignette offset={0.26} darkness={0.46} />
      </EffectComposer>
    </>
  )
}

export default function BackgroundScene({ veilRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.8], fov: 45, near: 0.1, far: 110 }}
      dpr={[1, 1.7]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.22,
      }}
    >
      <Scene veilRef={veilRef} />
    </Canvas>
  )
}
