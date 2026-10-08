import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { routeInfo, scrollT, arrivalT } from '../scene/transit.js'
import { createBridgeCurve, bridgeGrowth, bridgeTravel, bridgeDrawCount } from '../scene/bridge.js'
import {
  PATHS, PROJECT_BRANCH_COLORS, PROJECT_FORK_OPEN, PROJECT_FORK_CLOSE,
  createSkin, createSeam, detailReturning
} from '../scene/geometry.js'

const UP=new THREE.Vector3(0,1,0)
const FORWARD=new THREE.Vector3(0,0,1)
const clamp=n=>Math.min(1,Math.max(0,n))
const smooth=n=>{const v=clamp(n);return v*v*(3-2*v)}

function Shell({path,branch=false,transit=null}) {
  // Closed 360° surface, with no overlapping opaque walls inside the hub.
  const start=branch?PROJECT_FORK_OPEN:0
  const end=branch?PROJECT_FORK_CLOSE:1
  const radius=branch?2.85:4.25
  const divisions=branch?104:300
  const radial=branch?40:64
  const seamsCount=branch?3:7
  const geometry=useMemo(()=>createSkin(path,{
    radius,lengthSegments:divisions,radialSegments:radial,start,end
  }),[path,branch])
  const material=useRef(null)
  useFrame(({clock},delta)=>{
    if(!material.current)return
    const p=transit?Math.min(1,Math.max(0,(performance.now()-transit.startedAt)/transit.duration)):0
    const fade=p<.12?1:p<.36?1-(p-.12)/.24*.84:p<.70?.16:.16+(p-.70)/.30*.84
    material.current.opacity=THREE.MathUtils.damp(material.current.opacity,fade,9,Math.min(delta,.05))
  })
  useEffect(()=>()=>geometry.dispose(),[geometry])
  const seams=useMemo(()=>
    Array.from({length:seamsCount},(_,i)=>
      createSeam(path,i*Math.PI*2/seamsCount,{radius,segments:branch?100:140,start,end})),
    [path,branch]
  )
  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial ref={material} transparent opacity={1} depthWrite vertexColors side={THREE.BackSide}
          metalness={.58} roughness={.29}
          clearcoat={.88} clearcoatRoughness={.17}
          emissive="#514962" emissiveIntensity={.2}/>
      </mesh>
      {seams.map((seam,index)=>(
        <mesh key={index}>
          <tubeGeometry args={[seam,160,index%2===0?.018:.009,6,false]}/>
          <meshBasicMaterial color={index%3===0?'#f2d9d0':'#d4d8ff'}
            transparent opacity={index%2===0?.58:.28}
            depthWrite={false} toneMapped={false}/>
        </mesh>
      ))}
    </group>
  )
}

// The distant destinations have illuminated thresholds, not second walls
// intersecting the path occupied by the visitor.
function DirectionGate({path,color,at=.69,hovered=false,radius=2.55}) {
  const ring=useMemo(()=>{
    const position=path.getPointAt(at)
    const tangent=path.getTangentAt(at)
    const side=new THREE.Vector3().crossVectors(tangent,UP).normalize()
    const second=new THREE.Vector3().crossVectors(tangent,side).normalize()
    const vertices=[]
    for(let i=0;i<100;i++){
      const theta=i*Math.PI*2/100
      const r=radius*(1+.038*Math.sin(theta*5))
      vertices.push(position.clone().addScaledVector(side,Math.cos(theta)*r)
        .addScaledVector(second,Math.sin(theta)*r))
    }
    return new THREE.CatmullRomCurve3(vertices,true,'centripetal')
  },[path,at,radius])
  const ref=useRef()
  useFrame(({clock})=>{
    if(ref.current){
      ref.current.material.opacity=(hovered?.84:.34)+.055*Math.sin(clock.elapsedTime*1.25)
    }
  })
  return (
    <mesh ref={ref}>
      <tubeGeometry args={[ring,135,.046,8,true]}/>
      <meshBasicMaterial color={color} transparent opacity={.42}
        depthWrite={false} toneMapped={false}/>
    </mesh>
  )
}

function RouteMarkers({mode,hovered}) {
  // Deliberately omit other opaque corridors near the junction:
  // they intersect the camera's continuous wall, creating wall clipping.
  const mainColors=['#b5a5ff','#a4e0e1','#eab9ac']
  return <group>
    {PATHS.arms.map((path,i)=>(
      <DirectionGate key={i} path={path} color={mainColors[i]}
        hovered={hovered===['projects','experience','contact'][i]}
        at={.82} radius={2.35}/>
    ))}
    {(mode==='projects'||mode==='detail') && PATHS.children.map((path,i)=>(
      <DirectionGate key={'sub'+i} path={path}
        color={PROJECT_BRANCH_COLORS[i]}
        hovered={hovered==='project-'+i}
        at={.55} radius={2.45}/>
    ))}
  </group>
}

// Light traces make the five-way split legible while keeping the atrium open:
// unlike five intersecting cylinders, these lines never obstruct the camera.
function ForkGuide({path,color,active}) {
  const connector=useMemo(()=>{
    const samples=Array.from({length:42},(_,i)=>path.getPointAt(.045+i/41*.49))
    return new THREE.CatmullRomCurve3(samples,false,'centripetal')
  },[path])
  return <mesh>
    <tubeGeometry args={[connector,105,active?.055:.025,7,false]}/>
    <meshBasicMaterial color={color} transparent opacity={active?.96:.55}
      depthWrite={false} toneMapped={false}/>
  </mesh>
}

function Sparkles() {
  const data=useMemo(()=>{
    const pts=new Float32Array(420*3)
    for(let i=0;i<420;i++){
      pts[i*3]=(Math.random()-.5)*35
      pts[i*3+1]=(Math.random()-.5)*21
      pts[i*3+2]=12-Math.random()*108
    }
    return pts
  },[])
  return <points>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[data,3]}/></bufferGeometry>
    <pointsMaterial size={.025} color="#eee4f8" opacity={.42}
      sizeAttenuation transparent depthWrite={false}/>
  </points>
}

function CameraFlight({route,hovered,transit}) {
  const {camera}=useThree()
  const current=useRef(null)
  const wasTransiting=useRef(false)
  const pointer=useRef({x:0,y:0})
  const softPointer=useRef({x:0,y:0})
  const first=useRef(true)
  const position=useMemo(()=>new THREE.Vector3(),[])
  const ahead=useMemo(()=>new THREE.Vector3(),[])
  const direction=useMemo(()=>new THREE.Vector3(),[])
  const right=useMemo(()=>new THREE.Vector3(),[])
  const matrix=useMemo(()=>new THREE.Matrix4(),[])
  const rotation=useMemo(()=>new THREE.Quaternion(),[])
  const goal=useMemo(()=>new THREE.Vector3(),[])
  const scrollPositions=useRef({junction:1,works:2,fork:2})

  useEffect(()=>{
    const onMove=e=>{
      pointer.current.x=e.clientX/window.innerWidth*2-1
      pointer.current.y=e.clientY/window.innerHeight*2-1
    }
    window.addEventListener('pointermove',onMove,{passive:true})
    return ()=>window.removeEventListener('pointermove',onMove)
  },[])

  useFrame(({clock},delta)=>{
    const dt=Math.min(delta,.05)
    const total=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)
    const y=window.scrollY
    const homeJunction=document.getElementById('junction')
    const work=document.getElementById('works')
    const projectFork=document.getElementById('project-crossroads')
    if(homeJunction)scrollPositions.current.junction=homeJunction.offsetTop+homeJunction.offsetHeight*.38
    if(work)scrollPositions.current.works=work.offsetTop
    if(projectFork)scrollPositions.current.fork=projectFork.offsetTop+projectFork.offsetHeight*.35

    // Camera ownership moves to BridgeFlight for the ENTIRE transfer.
    // Leaving the ordinary scroll rig active caused the old teleportation.
    if(transit){wasTransiting.current=true;return}
    const nextT=scrollT(route,{
      scrollY:y,total,junction:scrollPositions.current.junction,
      works:scrollPositions.current.works,projectFork:scrollPositions.current.fork
    })
    if(wasTransiting.current){
      current.current=nextT
      wasTransiting.current=false
    }else{
      current.current=current.current===null?nextT:
        THREE.MathUtils.damp(current.current,nextT,3.4,dt)
    }
    const sample={path:route.path,t:current.current,
      reverse:route.mode==='detail'&&detailReturning(y/total),
      mode:route.mode,index:route.index}

    const t=Math.max(.001,Math.min(.998,sample.t))
    sample.path.getPointAt(t,position)
    sample.path.getPointAt(
      sample.reverse?Math.max(.001,t-.024):Math.min(.999,t+.024),ahead
    )
    sample.path.getTangentAt(t,direction)
    right.crossVectors(direction,UP).normalize()
    softPointer.current.x=THREE.MathUtils.damp(softPointer.current.x,pointer.current.x,3.2,dt)
    softPointer.current.y=THREE.MathUtils.damp(softPointer.current.y,pointer.current.y,3.2,dt)
    // Keep the eye inside the shared radius on both sides of every fork.
    goal.copy(position)
      .addScaledVector(right,softPointer.current.x*.095)
      .addScaledVector(UP,-softPointer.current.y*.06+Math.sin(clock.elapsedTime*.28)*.015)
    camera.position.copy(goal)

    if(!transit && route.mode==='projects' && hovered.startsWith('project-') && y>window.innerHeight*.45){
      const idx=Number(hovered.slice(8))
      if(idx>=0&&idx<PATHS.children.length)
        ahead.lerp(PATHS.children[idx].getPointAt(.55),.06)
    }
    if(!transit && route.mode==='home' && hovered && y>window.innerHeight*.8){
      const idx=['projects','experience','contact'].indexOf(hovered)
      if(idx>=0)ahead.lerp(PATHS.arms[idx].getPointAt(.27),.05)
    }
    matrix.lookAt(camera.position,ahead,UP)
    rotation.setFromRotationMatrix(matrix)
    if(first.current){
      camera.quaternion.copy(rotation)
      first.current=false
    }else{
      camera.quaternion.slerp(rotation,1-Math.exp(-dt*(transit?7:5)))
    }
    const boost=transit?2.3*Math.sin(Math.PI*Math.min(1,
      Math.max(0,(performance.now()-transit.startedAt)/transit.duration))):0
    camera.fov=THREE.MathUtils.damp(camera.fov,45+boost,4,dt)
    camera.updateProjectionMatrix()
  })
  return null
}


function BridgeFlight({transit}) {
  const {camera}=useThree()
  const bridge=useMemo(()=>{
    const origin=camera.position.clone()
    const heading=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize()
    const from=routeInfo(transit.from)
    const to=routeInfo(transit.to)
    const endT=arrivalT(to,from)
    const end=to.path.getPointAt(endT)
    const endHeading=to.path.getTangentAt(endT).normalize()
    const curve=createBridgeCurve(origin,heading,end,endHeading)
    const radius=3.54
    const radialSegments=48
    const geometry=createSkin(curve,{
      radius,lengthSegments:190,radialSegments
    })
    geometry.setDrawRange(0,0)
    const rails=Array.from({length:5},(_,i)=>{
      const line=createSeam(curve,i*Math.PI*2/5,{radius,segments:170})
      const tube=new THREE.TubeGeometry(line,190,i%2===0?.025:.012,6,false)
      tube.setDrawRange(0,0)
      return tube
    })
    return {curve,geometry,rails,radialSegments}
  },[transit.id,camera])
  const cameraLook=useMemo(()=>new THREE.Vector3(),[])
  const cameraPoint=useMemo(()=>new THREE.Vector3(),[])
  const matrix=useMemo(()=>new THREE.Matrix4(),[])
  const desiredRotation=useMemo(()=>new THREE.Quaternion(),[])
  const started=useRef(false)

  useEffect(()=>()=>{bridge.geometry.dispose();bridge.rails.forEach(g=>g.dispose())},[bridge])
  useFrame((_,delta)=>{
    const p=Math.max(0,Math.min(1,(performance.now()-transit.startedAt)/transit.duration))
    bridge.geometry.setDrawRange(0,bridgeDrawCount(bridge.geometry,p,bridge.radialSegments))
    const grown=bridgeGrowth(p)
    bridge.rails.forEach(rail=>{
      const rows=190
      const verticesPerRow=6*6
      rail.setDrawRange(0,Math.min(rail.index?.count||rows*verticesPerRow,
        Math.floor(rows*grown)*verticesPerRow))
    })
    const t=Math.min(.998,bridgeTravel(p))
    bridge.curve.getPointAt(t,cameraPoint)
    bridge.curve.getPointAt(Math.min(.999,t+.025),cameraLook)
    camera.position.copy(cameraPoint)
    matrix.lookAt(camera.position,cameraLook,UP)
    desiredRotation.setFromRotationMatrix(matrix)
    if(!started.current){
      // Keep the previously rendered angle at takeoff.
      started.current=true
    }
    camera.quaternion.slerp(desiredRotation,1-Math.exp(-Math.min(delta,.05)*4.7))
    const narrow=2.1*Math.sin(p*Math.PI)
    camera.fov=THREE.MathUtils.damp(camera.fov,45+narrow,4,Math.min(delta,.05))
    camera.updateProjectionMatrix()
  })
  return <group renderOrder={8}>
    <mesh geometry={bridge.geometry} renderOrder={8}>
      <meshPhysicalMaterial vertexColors side={THREE.BackSide}
        metalness={.58} roughness={.24} clearcoat={.9}
        clearcoatRoughness={.15} emissive="#65597f"
        emissiveIntensity={.29} depthTest depthWrite/>
    </mesh>
    {bridge.rails.map((rail,i)=><mesh key={i} geometry={rail} renderOrder={9}>
      <meshBasicMaterial color={i%2===0?'#f1ddd9':'#b5dbe3'}
        transparent opacity={i%2===0?.64:.35}
        depthWrite={false} toneMapped={false}/>
    </mesh>)}
    <pointLight position={bridge.curve.getPointAt(.65)}
      color="#d8c5ef" intensity={55} distance={30} decay={2}/>
  </group>
}

function Scene({pathname,hovered,transit}) {
  const route=routeInfo(pathname)
  const {mode,index,path}=route
  return <>
    <color attach="background" args={['#08080f']}/>
    <fog attach="fog" args={['#08080f',22,115]}/>
    <ambientLight intensity={.78} color="#dfd1f1"/>
    <hemisphereLight intensity={.75} color="#fff6e9" groundColor="#29243a"/>
    <directionalLight position={[4,8,12]} color="#ffe9d9" intensity={3.3}/>
    <pointLight position={[-2,-1,-11]} color="#b3a1ef" intensity={38} distance={28} decay={2}/>
    <pointLight position={[3,3,-28]} color="#f1c9bb" intensity={42} distance={30} decay={2}/>
    <pointLight position={[-6,3,-53]} color="#a6cbd9" intensity={45} distance={32} decay={2}/>
    <pointLight position={[3,-2,-77]} color="#9996de" intensity={34} distance={27} decay={2}/>
    <Shell key={mode+'-'+index} path={path} transit={transit}/>
    {mode==='projects' && PATHS.children.map((arm,i)=>(
      <Shell key={'branch-'+i} path={arm} branch transit={transit}/>
    ))}
    {(mode==='projects'||mode==='detail') && PATHS.children.map((arm,i)=>(
      <ForkGuide key={'guide-'+i} path={arm}
        color={PROJECT_BRANCH_COLORS[i]} active={hovered==='project-'+i}/>
    ))}
    <RouteMarkers mode={mode} hovered={hovered}/>
    <Sparkles/>
    <CameraFlight route={route} hovered={hovered} transit={transit}/>
    {transit&&<BridgeFlight key={transit.id} transit={transit}/>}
  </>
}

export default function World({pathname='/',hovered='',transit=null,onReady}) {
  return <Canvas onCreated={onReady}
    camera={{position:[0,0,11],fov:45,near:.12,far:140}}
    dpr={[1,1.65]}
    gl={{alpha:false,antialias:true,powerPreference:'high-performance'}}
    style={{position:'absolute',inset:0}}>
    <Scene pathname={pathname} hovered={hovered} transit={transit}/>
  </Canvas>
}
