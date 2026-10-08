import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS } from '../data/projects.js'

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const smooth = (t) => t * t * (3 - 2 * t)
const MAIN_COLORS = ['#9790ff', '#83ccff', '#ffb4c2']

const spline = (points) => new THREE.CatmullRomCurve3(
  points.map((p) => new THREE.Vector3(...p)),
  false, 'catmullrom', 0.55
)

function makeWorld() {
  const trunkPoints = [
    [0, 0, 8.8], [0, 0, 2], [-0.18, 0.12, -7], [0.15, 0.05, -15],
    [0, 0, -23],
  ]
  const mainBranches = [
    [[0, 0, -23], [-1.2, 0.1, -29], [-3.9, 0.4, -36], [-6.2, 0.4, -44], [-6.8, 0.5, -50]],
    [[0, 0, -23], [0, 0.35, -30], [0.1, 1.2, -39], [0.4, 1.7, -51]],
    [[0, 0, -23], [1.3, -0.18, -29], [4.1, -0.15, -37], [6.5, -0.2, -50]],
  ]
  const children = PROJECTS_WITH_SLUGS.map((_, index) => {
    const spread = index - (PROJECTS_WITH_SLUGS.length - 1) / 2
    return [
      [-6.8, 0.5, -50],
      [-6.8 + spread * 1.2, 0.5 + Math.sin(index * 2) * 0.35, -56],
      [-6.8 + spread * 2.65, 0.4 + Math.sin(index * 2) * 0.9, -65],
      [-6.8 + spread * 3.1, 0.4 + Math.sin(index * 2) * 1.15, -76],
    ]
  })
  return {
    trunk: spline(trunkPoints),
    main: mainBranches.map((pts) => spline(pts)),
    children: children.map((pts) => spline(pts)),
    routes: mainBranches.map((pts) => spline([...trunkPoints.slice(0, -1), ...pts])),
    details: children.map((pts) => spline([
      ...trunkPoints.slice(0, -1),
      ...mainBranches[0].slice(0, -1),
      ...pts,
    ])),
  }
}

function usePointer() {
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const move = (e) => {
      pointer.current.x = e.clientX / window.innerWidth * 2 - 1
      pointer.current.y = e.clientY / window.innerHeight * 2 - 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return pointer
}

function Tunnel({ curve, color, radius = 3.55, length = 200, wire = true }) {
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, length, radius, 36, false]} />
        <meshStandardMaterial
          side={THREE.BackSide}
          color="#11111d"
          metalness={0.38}
          roughness={0.32}
          emissive={color}
          emissiveIntensity={0.095}
        />
      </mesh>
      {wire && (
        <mesh>
          <tubeGeometry args={[curve, length, radius - 0.07, 20, false]} />
          <meshBasicMaterial
            side={THREE.BackSide}
            wireframe
            color={color}
            transparent
            opacity={0.035}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

function railCurve(curve, angle, radius) {
  const points = []
  const count = 120
  const tangent = new THREE.Vector3()
  const side = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const center = new THREE.Vector3()
  for (let index = 0; index <= count; index += 1) {
    const t = index / count
    curve.getPointAt(t, center)
    curve.getTangentAt(t, tangent)
    side.crossVectors(tangent, UP).normalize()
    binormal.crossVectors(tangent, side).normalize()
    points.push(center.clone()
      .addScaledVector(side, Math.cos(angle) * radius)
      .addScaledVector(binormal, Math.sin(angle) * radius))
  }
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
}

function Rails({ curve, color, radius = 3.35, count = 4 }) {
  const curves = useMemo(
    () => Array.from({ length: count }, (_, i) => railCurve(curve, i * Math.PI * 2 / count, radius)),
    [curve, radius, count]
  )
  return curves.map((line, i) => (
    <mesh key={i}>
      <tubeGeometry args={[line, 230, i % 2 ? 0.012 : 0.027, 7, false]} />
      <meshBasicMaterial color={i % 2 ? '#d8e5ff' : color} transparent opacity={i % 2 ? 0.4 : 0.9}
        depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  ))
}

function Ring({ curve, t, color, radius, index, active, major = false }) {
  const group = useRef()
  const material = useRef()
  const point = useMemo(() => curve.getPointAt(t), [curve, t])
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(FORWARD, curve.getTangentAt(t).normalize()),
    [curve, t]
  )
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.scale.setScalar(1 + (active ? 0.09 : 0) + Math.sin(clock.elapsedTime * 0.7 + index) * 0.012)
      group.current.rotation.z = clock.elapsedTime * (index % 2 ? -0.012 : 0.012)
    }
    if (material.current) {
      material.current.opacity = (major ? 0.78 : 0.2) + (active ? 0.2 : 0)
    }
  })
  return (
    <group ref={group} position={point} quaternion={rotation}>
      <mesh>
        <torusGeometry args={[radius, major ? 0.075 : 0.025, 16, 130]} />
        <meshBasicMaterial ref={material} color={color} transparent opacity={major ? 0.78 : 0.2}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {major && (
        <mesh>
          <torusGeometry args={[radius, 0.18, 9, 105]} />
          <meshBasicMaterial color={color} transparent opacity={0.08}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  )
}

function RingSeries({ curve, color, radius = 3.35, count = 11, active = false }) {
  return Array.from({ length: count }, (_, index) => {
    const t = 0.07 + index * 0.86 / (count - 1)
    return <Ring key={index} curve={curve} color={color} radius={radius}
      index={index} t={t} major={index === 0 || index === count - 1} active={active} />
  })
}

function Gate({ curve, color, radius, active, title, index }) {
  const group = useRef()
  const point = useMemo(() => curve.getPointAt(0.19), [curve])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(FORWARD, curve.getTangentAt(0.19).normalize()),
    [curve]
  )
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.scale.setScalar(1 + (active ? 0.12 : 0) + Math.sin(clock.elapsedTime * 0.9 + index) * 0.017)
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.24 + index) * 0.018
  })
  return (
    <group ref={group} position={point} quaternion={quaternion}>
      <mesh>
        <torusGeometry args={[radius, 0.085, 18, 160]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.98 : 0.7}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <torusGeometry args={[radius, 0.23, 12, 110]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.17 : 0.08}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color={color} intensity={active ? 15 : 5} distance={12} />
    </group>
  )
}

function Junction({ world, activeChoice }) {
  const hub = world.trunk.getPointAt(0.98)
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.045
  })
  return (
    <group position={hub}>
      <mesh ref={ref} rotation={[0.04, 0, 0]}>
        <torusGeometry args={[4.03, 0.065, 18, 160]} />
        <meshBasicMaterial color="#cccaff" transparent opacity={0.65}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#9991ff" intensity={7} distance={15} />
    </group>
  )
}

function Dust() {
  const points = useRef()
  const positions = useMemo(() => {
    const data = new Float32Array(420 * 3)
    for (let i = 0; i < 420; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 24
      data[i * 3 + 1] = (Math.random() - 0.5) * 13
      data[i * 3 + 2] = 9 - Math.random() * 87
    }
    return data
  }, [])
  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.z = Math.sin(clock.elapsedTime * 0.03) * 0.015
  })
  return (
    <Points ref={points} positions={positions} stride={3}>
      <PointMaterial color="#eeeaff" size={0.025} transparent opacity={0.5}
        sizeAttenuation depthWrite={false} />
    </Points>
  )
}

function CameraRig({ world, mode, projectIndex, pointer }) {
  const { camera } = useThree()
  const position = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const near = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])
  const bank = useMemo(() => new THREE.Quaternion(), [])
  const clockState = useRef({progress:0,velocity:0})
  const first = useRef(true)
  const mouseScale = mode === 'home' ? 0.13 : 0.22

  useFrame(({ clock, size }, delta) => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const scrollTarget = clamp(window.scrollY / maxScroll)
    const dt = Math.min(delta, 0.05)
    const ease = 1 - Math.exp(-dt * 3.5)
    const former = clockState.current.progress
    clockState.current.progress += (scrollTarget - former) * ease
    clockState.current.velocity += ((clockState.current.progress - former) - clockState.current.velocity) * 0.12

    let curve = world.trunk
    let t = clamp(clockState.current.progress / 0.38) * 0.92

    if (mode === 'projects') {
      curve = world.routes[0]
      t = 0.27 + clockState.current.progress * 0.62
    } else if (mode === 'experience') {
      curve = world.routes[1]
      t = 0.3 + clockState.current.progress * 0.62
    } else if (mode === 'contact') {
      curve = world.routes[2]
      t = 0.42 + clockState.current.progress * 0.55
    } else if (mode === 'detail') {
      curve = world.details[Math.max(0, projectIndex)] || world.routes[0]
      t = 0.62 + clockState.current.progress * 0.34
    }

    curve.getPointAt(t, position)
    curve.getPointAt(clamp(t + 0.035), near)
    curve.getPointAt(clamp(t + 0.065), look)
    tangent.copy(near).sub(position).normalize()
    side.crossVectors(tangent, UP).normalize()

    desired.copy(position)
      .addScaledVector(side, pointer.current.x * mouseScale)
      .addScaledVector(UP, pointer.current.y * -mouseScale * 0.65)
      .addScaledVector(UP, Math.sin(clock.elapsedTime * 0.26) * 0.03)

    if (first.current) {
      camera.position.copy(desired)
      first.current = false
    } else {
      camera.position.lerp(desired, 1 - Math.exp(-dt * 3.2))
    }

    matrix.lookAt(camera.position, look, UP)
    quat.setFromRotationMatrix(matrix)
    const bankStrength = Math.sin(t * Math.PI * 2) * 0.045
    bank.setFromAxisAngle(FORWARD, bankStrength)
    quat.multiply(bank)
    camera.quaternion.slerp(quat, 1 - Math.exp(-dt * 4))

    const boost = Math.min(Math.abs(clockState.current.velocity) * 850, 1)
    camera.fov += (45 + boost * 5.5 - camera.fov) * (1 - Math.exp(-dt * 5))
    camera.updateProjectionMatrix()
  })
  return null
}

function Scene({ mode, projectIndex, hovered, veilRef }) {
  const world = useMemo(() => makeWorld(), [])
  const pointer = usePointer()
  const activeMain = mode === 'home' ? hovered : mode === 'projects' || mode === 'detail'
    ? 'projects' : mode
  const projectHover = hovered && hovered.startsWith('project-')
    ? Number(hovered.slice(8)) : -1

  useFrame(() => {
    if (veilRef?.current && veilRef.current.style.opacity !== '0.26') {
      veilRef.current.style.opacity = '0.26'
    }
  })

  return (
    <>
      <fog attach="fog" args={['#060608', 12, 94]} />
      <ambientLight intensity={0.35} />
      <directionalLight color="#e4e6ff" position={[3, 7, 7]} intensity={1.45} />
      <pointLight color="#9289ff" position={[0, 0, -14]} intensity={12} distance={22} />
      <pointLight color="#8cbcff" position={[-6, 0, -44]} intensity={10} distance={20} />

      <Tunnel curve={world.trunk} radius={4.3} color="#9890ff" length={220} />
      <Rails curve={world.trunk} color="#a8a0ff" radius={4.05} count={8} />
      <RingSeries curve={world.trunk} color="#aaa5ff" radius={4.06} count={14} />
      <Junction world={world} activeChoice={activeMain} />

      {world.main.map((curve, index) => {
        const key = ['projects', 'experience', 'contact'][index]
        const active = activeMain === key
        const color = MAIN_COLORS[index]
        return (
          <group key={key}>
            <Tunnel curve={curve} radius={3.24} color={color} length={200} />
            <Rails curve={curve} radius={3.04} color={color} count={4} />
            <RingSeries curve={curve} color={color} radius={3.04} count={12} active={active} />
            <Gate curve={curve} color={color} radius={3.03} title={key} active={active} index={index} />
          </group>
        )
      })}

      {world.children.map((curve, index) => {
        const active = (mode === 'detail' && index === projectIndex) || projectHover === index
        return (
          <group key={PROJECTS_WITH_SLUGS[index].slug}>
            <Tunnel curve={curve} radius={1.63} color="#9187ff" length={160} wire={false} />
            <Rails curve={curve} radius={1.51} color="#d2caff" count={3} />
            <RingSeries curve={curve} radius={1.5} color="#ada4ff" count={7} active={active} />
            <Gate curve={curve} radius={1.5} color={active ? '#ffffff' : '#a49aff'} active={active} index={index} />
          </group>
        )
      })}

      <Dust />
      <CameraRig world={world} mode={mode} projectIndex={projectIndex} pointer={pointer} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.86} luminanceThreshold={0.36}
          luminanceSmoothing={0.74} mipmapBlur />
        <Vignette darkness={0.37} offset={0.26} />
      </EffectComposer>
    </>
  )
}

export default function BackgroundScene({ veilRef, pathname = '/', hovered = '' }) {
  const mode = pathname.startsWith('/projets/')
    ? 'detail' : pathname === '/projets'
      ? 'projects' : pathname === '/experience'
        ? 'experience' : pathname === '/contact' ? 'contact' : 'home'
  const projectIndex = mode === 'detail'
    ? PROJECTS_WITH_SLUGS.findIndex((p) => pathname === '/projets/' + p.slug)
    : -1

  return (
    <Canvas camera={{ position: [0, 0, 8.8], fov: 45, near: 0.1, far: 115 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <Scene mode={mode} projectIndex={projectIndex} hovered={hovered} veilRef={veilRef} />
    </Canvas>
  )
}
