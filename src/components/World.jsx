import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'
import {
  PATHS, MAIN_HUBS, PROJECT_HUBS,
  PROJECT_BRANCH_COLORS, PROJECT_FORK_OPEN, PROJECT_FORK_CLOSE,
  createSkin, createSeam, detailTravelT, detailReturning
} from '../scene/geometry.js'

const UP=new THREE.Vector3(0,1,0)
const FORWARD=new THREE.Vector3(0,0,1)
const clamp=n=>Math.min(1,Math.max(0,n))
const smooth=n=>{const v=clamp(n);return v*v*(3-2*v)}

function Shell({path,branch=false}) {
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
  useEffect(()=>()=>geometry.dispose(),[geometry])
  const seams=useMemo(()=>
    Array.from({length:seamsCount},(_,i)=>
      createSeam(path,i*Math.PI*2/seamsCount,{radius,segments:branch?100:140,start,end})),
    [path,branch]
  )
  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial vertexColors side={THREE.BackSide}
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

function CameraFlight({path,mode,hub,hovered,projectIndex=0}) {
  const {camera}=useThree()
  const current=useRef(null)
  const target=new THREE.Vector3()
  const ahead=new THREE.Vector3()
  const direction=new THREE.Vector3()
  const right=new THREE.Vector3()
  const goal=new THREE.Vector3()
  const matrix=new THREE.Matrix4()
  const quaternion=new THREE.Quaternion()
  const mouse=useRef({x:0,y:0})
  const softMouse=useRef({x:0,y:0})
  const first=useRef(true)

  useEffect(()=>{
    const onMouse=e=>{
      mouse.current.x=e.clientX/window.innerWidth*2-1
      mouse.current.y=e.clientY/window.innerHeight*2-1
    }
    window.addEventListener('pointermove',onMouse,{passive:true})
    return ()=>window.removeEventListener('pointermove',onMouse)
  },[])

  useFrame(({clock},delta)=>{
    const dt=Math.min(delta,.05)
    const total=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)
    const scrollY=window.scrollY
    let targetT=.025

    if(mode==='home'){
      const section=document.getElementById('junction')
      const work=document.getElementById('works')
      const junction=(section?.offsetTop||window.innerHeight)
        +(section?.offsetHeight||window.innerHeight)*.38
      const works=work?.offsetTop||window.innerHeight*2.2
      if(scrollY<=junction){
        targetT=.025+smooth(scrollY/Math.max(1,junction))*(hub+.012-.025)
      }else if(scrollY<works){
        const phase=smooth((scrollY-junction)/Math.max(1,works-junction))
        targetT=hub+.012+phase*.025
      }else{
        const phase=smooth((scrollY-works)/Math.max(1,total-works))
        targetT=hub+.037+phase*(.955-hub-.037)
      }
    }else if(mode==='detail'){
      targetT=detailTravelT(projectIndex,scrollY/total)
    }else{
      targetT=hub+.008+smooth(scrollY/total)*(.955-hub-.008)
    }

    // IMPORTANT: interpolate parameter t, never the world-space position.
    if(current.current===null)current.current=clamp(targetT)
    else current.current=THREE.MathUtils.damp(current.current,clamp(targetT),3.4,dt)
    const t=current.current

    path.getPointAt(t,target)
    const returning=mode==='detail'&&detailReturning(scrollY/total)
    // Rotate naturally at the last station, then look towards the intersection.
    path.getPointAt(returning?Math.max(.001,t-.023):Math.min(.999,t+.023),ahead)
    path.getTangentAt(t,direction)
    right.crossVectors(direction,UP).normalize()
    softMouse.current.x=THREE.MathUtils.damp(softMouse.current.x,mouse.current.x,3.3,dt)
    softMouse.current.y=THREE.MathUtils.damp(softMouse.current.y,mouse.current.y,3.3,dt)
    goal.copy(target)
      .addScaledVector(right,softMouse.current.x*.10)
      .addScaledVector(UP,-softMouse.current.y*.06+Math.sin(clock.elapsedTime*.3)*.018)

    // Target and mesh are sampled on the same spline. Clearance >= 4 units.
    camera.position.copy(goal)
    if(mode==='projects'&&hovered.startsWith('project-')&&scrollY>window.innerHeight*.45){
      const idx=Number(hovered.slice(8))
      if(Number.isInteger(idx)&&idx>=0&&idx<PATHS.children.length){
        ahead.lerp(PATHS.children[idx].getPointAt(.56),.085)
      }
    }
    if(mode==='home'&&hovered&&scrollY>window.innerHeight*.8){
      const index=['projects','experience','contact'].indexOf(hovered)
      if(index>=0){
        const nearby=PATHS.arms[index].getPointAt(.27)
        ahead.lerp(nearby,.055)
      }
    }
    matrix.lookAt(camera.position,ahead,UP)
    quaternion.setFromRotationMatrix(matrix)
    if(first.current){camera.quaternion.copy(quaternion);first.current=false}
    else camera.quaternion.slerp(quaternion,1-Math.exp(-dt*5))
    camera.fov=THREE.MathUtils.damp(camera.fov,45,5,dt)
    camera.updateProjectionMatrix()
  })
  return null
}

function Scene({pathname,hovered}) {
  const mode=pathname.startsWith('/projets/')?'detail':
    pathname==='/projets'?'projects':
    pathname==='/parcours'||pathname==='/experience'?'experience':
    pathname==='/contact'?'contact':'home'
  const index=Math.max(0,PROJECTS.findIndex(p=>pathname==='/projets/'+p.slug))
  const selected=mode==='experience'?1:mode==='contact'?2:0
  const path=mode==='detail'?PATHS.details[index]:PATHS.routes[selected]
  const hub=mode==='detail'?PROJECT_HUBS[index]:MAIN_HUBS[selected]
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
    <Shell key={mode+'-'+index} path={path}/>
    {mode==='projects' && PATHS.children.map((arm,i)=>(
      <Shell key={'branch-'+i} path={arm} branch/>
    ))}
    <RouteMarkers mode={mode} hovered={hovered}/>
    <Sparkles/>
    <CameraFlight key={mode+'-'+index} path={path} mode={mode} hub={hub} hovered={hovered} projectIndex={index}/>
  </>
}

export default function World({pathname='/',hovered='',onReady}) {
  return <Canvas onCreated={onReady}
    camera={{position:[0,0,11],fov:45,near:.12,far:140}}
    dpr={[1,1.65]}
    gl={{alpha:false,antialias:true,powerPreference:'high-performance'}}
    style={{position:'absolute',inset:0}}>
    <Scene pathname={pathname} hovered={hovered}/>
  </Canvas>
}
