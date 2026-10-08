import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointMaterial, Points } from '@react-three/drei'
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

  useFrame(({ clock }) => {
    const progress = clamp(state.current.progress)
    const eased = progress * progress * (3 - 2 * progress)

    curve.getPointAt(eased, current)
    curve.getPointAt(Math.min(eased + 0.022, 1), ahead)
    curve.getPointAt(Math.min(eased + 0.05, 1), aheadFar)

    tangent.copy(ahead).sub(current).normalize()
    nextTangent.copy(aheadFar).sub(ahead).normalize()
    side.crossVectors(tangent, UP).normalize()

    const pointerAmount = 0.18 + Math.min(Math.abs(state.current.velocity) * 450, 0.22)

    destination
      .copy(current)
      .addScaledVector(side, pointer.current.x * pointerAmount)
      .addScaledVector(UP, -pointer.current.y * pointerAmount * 0.65)
      .addScaledVector(UP, Math.sin(clock.elapsedTime * 0.24) * 0.025)

    camera.position.lerp(destination, 0.07)

    lookTarget
      .copy(aheadFar)
      .addScaledVector(side, pointer.current.x * 0.08)
      .addScaledVector(UP, -pointer.current.y * 0.055)

    rotationMatrix.lookAt(camera.position, lookTarget, UP)
    targetQuat.setFromRotationMatrix(rotationMatrix)

    const bend = tangent.clone().cross(nextTangent).dot(UP)
    const scrollBoost = Math.min(Math.abs(state.current.velocity) * 1200, 1)
    const roll = THREE.MathUtils.clamp(-bend * 2.7, -0.12, 0.12) - pointer.current.x * 0.012
    rollQuat.setFromAxisAngle(Z_AXIS, roll * (0.7 + scrollBoost * 0.3))
    targetQuat.multiply(rollQuat)

    camera.quaternion.slerp(targetQuat, 0.075)

    const targetFov = 45 + scrollBoost * 5.5
    camera.fov += (targetFov - camera.fov) * 0.065
    camera.updateProjectionMatrix()
  })

  return null
}

function TunnelShell({ curve }) {
  return (
    <>
      <mesh>
        <tubeGeometry args={[curve, 420, 4.8, 48, false]} />
        <meshStandardMaterial
          color="#09090f"
          roughness={0.34}
          metalness={0.42}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh>
        <tubeGeometry args={[curve, 420, 4.68, 32, false]} />
        <meshBasicMaterial
          color="#8c84ff"
          wireframe
          transparent
          opacity={0.018}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function createRailCurve(curve, angle, radius = 4.44) {
  const points = []
  const segments = 90

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
    () => [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => createRailCurve(curve, angle)),
    [curve]
  )

  return rails.map((rail, index) => (
    <mesh key={index}>
      <tubeGeometry args={[rail, 320, index % 2 === 0 ? 0.018 : 0.012, 8, false]} />
      <meshBasicMaterial
        color={index % 2 === 0 ? '#8d83ff' : '#dce8ff'}
        transparent
        opacity={index % 2 === 0 ? 0.55 : 0.25}
        depthWrite={false}
      />
    </mesh>
  ))
}

function TunnelRing({ curve, fraction, index, state, major = false }) {
  const group = useRef()
  const ring = useRef()
  const ringMaterial = useRef()

  const position = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()),
    [curve, fraction]
  )

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) * (major ? 9 : 13))

    if (group.current) {
      const scale = 1 + proximity * (major ? 0.085 : 0.035)
      group.current.scale.setScalar(scale)
    }

    if (ring.current) {
      ring.current.rotation.z =
        (index % 2 === 0 ? 1 : -1) * clock.elapsedTime * (major ? 0.035 : 0.012) +
        index * 0.045
    }

    if (ringMaterial.current) {
      ringMaterial.current.opacity = (major ? 0.42 : 0.12) + proximity * (major ? 0.4 : 0.18)
    }
  })

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={ring}>
        <torusGeometry args={[4.36, major ? 0.055 : 0.016, major ? 20 : 12, 180]} />
        <meshBasicMaterial
          ref={ringMaterial}
          color={major ? '#cfd5ff' : '#756cff'}
          transparent
          opacity={major ? 0.42 : 0.12}
          depthWrite={false}
        />
      </mesh>

      {major && (
        <>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[4.12, 0.012, 10, 180]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
          </mesh>
          <pointLight color="#7167ff" intensity={10} distance={10} />
        </>
      )}
    </group>
  )
}

function TunnelRings({ curve, state }) {
  const rings = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => {
        const fraction = 0.035 + (index / 33) * 0.93
        const major =
          Math.abs(fraction - 0.25) < 0.026 ||
          Math.abs(fraction - 0.5) < 0.026 ||
          Math.abs(fraction - 0.75) < 0.026

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

  const position = useMemo(() => curve.getPointAt(fraction), [curve, fraction])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, curve.getTangentAt(fraction).normalize()),
    [curve, fraction]
  )

  useFrame(({ clock }) => {
    const proximity = Math.max(0, 1 - Math.abs(state.current.progress - fraction) / 0.12)

    if (group.current) {
      group.current.scale.setScalar(0.94 + proximity * 0.16)
      group.current.rotation.z = clock.elapsedTime * (index % 2 ? -0.018 : 0.018)
    }

    if (halo.current) {
      halo.current.material.opacity = 0.015 + proximity * 0.055
    }
  })

  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh ref={halo}>
        <circleGeometry args={[4.1, 128]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.015}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={color} intensity={7} distance={11} />
    </group>
  )
}

function SectionGlows({ curve, state }) {
  return [
    [0.25, '#756bff'],
    [0.5, '#99b8ff'],
    [0.75, '#756bff'],
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
  const count = 520

  const positions = useMemo(() => {
    const data = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const radius = 2.2 + Math.random() * 2.25
      const angle = Math.random() * Math.PI * 2

      data[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.35
      data[i * 3 + 1] = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.35
      data[i * 3 + 2] = 9 - Math.random() * 88
    }

    return data
  }, [])

  useFrame(({ clock }) => {
    if (!points.current) return
    points.current.rotation.z = Math.sin(clock.elapsedTime * 0.035) * 0.012
  })

  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled>
      <PointMaterial
        transparent
        color="#e8e8ff"
        size={0.018}
        sizeAttenuation
        depthWrite={false}
        opacity={0.34}
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
    veilRef.current.style.opacity = String(0.74 - speed * 0.08)
  })

  return (
    <>
      <fog attach="fog" args={['#060608', 8, 82]} />

      <ambientLight intensity={0.2} />
      <directionalLight position={[3, 6, 6]} intensity={1.15} color="#f5f6ff" />
      <pointLight position={[0, 0, 1]} intensity={5} color="#8177ff" distance={12} />
      <pointLight position={[2, -1, -25]} intensity={4} color="#a9c4ff" distance={16} />
      <pointLight position={[-2, 1, -52]} intensity={4.5} color="#756cff" distance={18} />

      <TunnelShell curve={curve} />
      <LightRails curve={curve} />
      <TunnelRings curve={curve} state={state} />
      <SectionGlows curve={curve} state={state} />
      <Dust />

      <ScrollDriver state={state} />
      <CameraRig curve={curve} state={state} pointer={pointer} />
    </>
  )
}

export default function BackgroundScene({ veilRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.8], fov: 45, near: 0.1, far: 110 }}
      dpr={[1, 1.65]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
    >
      <Scene veilRef={veilRef} />
    </Canvas>
  )
}
