import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const FONT_5x7 = {
  A: ['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
  B: ['####.','#...#','#...#','####.','#...#','#...#','####.'],
  C: ['.####','#....','#....','#....','#....','#....','.####'],
  D: ['####.','#...#','#...#','#...#','#...#','#...#','####.'],
  E: ['#####','#....','#....','####.','#....','#....','#####'],
  F: ['#####','#....','#....','####.','#....','#....','#....'],
  G: ['.####','#....','#....','#.###','#...#','#...#','.####'],
  H: ['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
  I: ['#####','..#..','..#..','..#..','..#..','..#..','#####'],
  J: ['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
  K: ['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],
  L: ['#....','#....','#....','#....','#....','#....','#####'],
  M: ['#...#','##.##','#.#.#','#...#','#...#','#...#','#...#'],
  N: ['#...#','##..#','#.#.#','#..##','#...#','#...#','#...#'],
  O: ['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
  P: ['####.','#...#','#...#','####.','#....','#....','#....'],
  Q: ['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],
  R: ['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
  S: ['.####','#....','#....','.###.','....#','....#','####.'],
  T: ['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
  U: ['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],
  V: ['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
  W: ['#...#','#...#','#...#','#.#.#','#.#.#','##.##','#...#'],
  X: ['#...#','.#.#.','..#..','..#..','..#..','.#.#.','#...#'],
  Y: ['#...#','.#.#.','..#..','..#..','..#..','..#..','..#..'],
  Z: ['#####','....#','...#.','..#..','.#...','#....','#####'],
}

const MAX_NAME_WIDTH = 6.1
const ASSEMBLE_DURATION = 1.9

function buildNameVoxels(name, maxWidth) {
  const letterGap = 1
  const spaceWidth = 3
  const chars = []
  let cursorCells = 0

  for (const rawChar of name.toUpperCase()) {
    if (rawChar === ' ') {
      cursorCells += spaceWidth
      continue
    }
    const bitmap = FONT_5x7[rawChar]
    if (!bitmap) {
      cursorCells += spaceWidth
      continue
    }
    chars.push({ bitmap, xCells: cursorCells })
    cursorCells += 5 + letterGap
  }

  const totalWidthCells = Math.max(cursorCells - letterGap, 1)
  const voxelSize = maxWidth / totalWidthCells
  const endPositions = []

  chars.forEach(({ bitmap, xCells }) => {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (bitmap[row][col] === '#') {
          endPositions.push(new THREE.Vector3((xCells + col) * voxelSize, (6 - row) * voxelSize, 0))
        }
      }
    }
  })

  const totalWidth = totalWidthCells * voxelSize
  const totalHeight = 6 * voxelSize
  endPositions.forEach((point) => {
    point.x -= totalWidth / 2
    point.y -= totalHeight / 2
  })

  return { endPositions, voxelSize }
}

export default function AssemblingName({ name, position = [0, 1.45, 1.7] }) {
  const mesh = useRef()
  const group = useRef()

  const data = useMemo(() => {
    const { endPositions, voxelSize } = buildNameVoxels(name, MAX_NAME_WIDTH)
    const startPositions = endPositions.map(
      () => new THREE.Vector3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10, -7 - Math.random() * 24)
    )
    const burstPositions = endPositions.map((end) => {
      const direction = new THREE.Vector3(end.x * 0.35 + (Math.random() - 0.5), end.y * 0.35 + (Math.random() - 0.5), -1.8 - Math.random() * 3)
      return end.clone().add(direction.multiplyScalar(1.2 + Math.random() * 1.8))
    })
    const startQuats = endPositions.map(() =>
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI))
    )
    const burstQuats = endPositions.map(() =>
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2))
    )
    return { endPositions, startPositions, burstPositions, startQuats, burstQuats, voxelSize, count: endPositions.length }
  }, [name])

  const identity = useMemo(() => new THREE.Quaternion(), [])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const tempPosition = useMemo(() => new THREE.Vector3(), [])
  const tempQuat = useMemo(() => new THREE.Quaternion(), [])
  const tempScale = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    if (!mesh.current) return

    const intro = Math.min(clock.elapsedTime / ASSEMBLE_DURATION, 1)
    const introEase = 1 - Math.pow(1 - intro, 4)
    const viewportScroll = typeof window === 'undefined' ? 0 : window.scrollY / Math.max(window.innerHeight, 1)
    const breakup = Math.min(Math.max((viewportScroll - 0.3) / 0.75, 0), 1)
    const breakupEase = breakup * breakup * (3 - 2 * breakup)

    for (let i = 0; i < data.count; i += 1) {
      tempPosition.lerpVectors(data.startPositions[i], data.endPositions[i], introEase)
      if (breakupEase > 0) tempPosition.lerp(data.burstPositions[i], breakupEase)

      tempQuat.slerpQuaternions(data.startQuats[i], identity, introEase)
      if (breakupEase > 0) tempQuat.slerp(data.burstQuats[i], breakupEase)

      const scale = THREE.MathUtils.lerp(0.18, 1, introEase) * (1 - breakupEase * 0.6)
      tempScale.setScalar(scale)
      matrix.compose(tempPosition, tempQuat, tempScale)
      mesh.current.setMatrixAt(i, matrix)
    }

    mesh.current.instanceMatrix.needsUpdate = true

    if (group.current) {
      group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.55) * 0.055
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.025
    }
  })

  return (
    <group ref={group} position={position}>
      <instancedMesh ref={mesh} args={[null, null, data.count]}>
        <boxGeometry args={[data.voxelSize * 0.82, data.voxelSize * 0.82, data.voxelSize * 0.82]} />
        <meshStandardMaterial color="#a18bff" emissive="#7c5cff" emissiveIntensity={1.35} roughness={0.12} metalness={0.78} />
      </instancedMesh>
    </group>
  )
}
