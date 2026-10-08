import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PROJECTS_WITH_SLUGS as PROJECTS } from '../data/projects.js'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const clamp = n => Math.max(0, Math.min(1, n))
const smooth = n => { const t=clamp(n); return t*t*(3-2*t) }
const v = (x,y,z) => new THREE.Vector3(x,y,z)
const curve = points => new THREE.CatmullRomCurve3(points.map(a=>v(...a)),false,'catmullrom',0.45)

const TRUNK_POINTS = [
  [0,0,11],[0,0,6],[-0.35,0.25,-2],[-0.55,-0.1,-11],[0.6,0,-21],[0,0,-30]
]
const BRANCH_POINTS = [
  [[0,0,-30],[-1.1,0,-36],[-3.9,0.45,-43],[-7.1,.1,-51],[-9.5,0,-61]],
  [[0,0,-30],[0,.25,-37],[.45,2.2,-44],[.7,3.5,-54],[.85,4,-63]],
  [[0,0,-30],[1.1,-.2,-36],[3.5,-.6,-44],[7,-.4,-53],[9.2,-.2,-63]]
]
const branchColors = ['#a99ff7','#a1d7da','#e3b7a8']
const childPoints = PROJECTS.map((p,index)=>{
  const n=index-(PROJECTS.length-1)/2
  return [[-9.5,0,-61],[-10+n*1.25,.1+n*.08,-66],[-10+n*3.2,n*.8,-75],[-10+n*4.5,n*.9,-88]]
})
const WORLD={
  trunk:curve(TRUNK_POINTS),
  branches:BRANCH_POINTS.map(pts=>curve(pts)),
  children:childPoints.map(pts=>curve(pts)),
  routes:BRANCH_POINTS.map(pts=>curve([...TRUNK_POINTS.slice(0,-1),...pts])),
  details:childPoints.map(pts=>curve([...TRUNK_POINTS.slice(0,-1),...BRANCH_POINTS[0].slice(0,-1),...pts]))
}

// Real junction positions on the arc-length-parameterized flight paths.
function closestProgress(path, position) {
  const sample=new THREE.Vector3()
  let nearest=0, minimum=Infinity
  for(let i=0;i<=360;i++){
    const t=i/360
    path.getPointAt(t,sample)
    const distance=sample.distanceToSquared(position)
    if(distance<minimum){minimum=distance;nearest=t}
  }
  return nearest
}
const HUBS=WORLD.routes.map(path=>closestProgress(path,v(0,0,-30)))
const DETAIL_HUBS=WORLD.details.map(path=>closestProgress(path,v(-9.5,0,-61)))

function ribbonMesh(path, { radius=4.5, angle=0, sweep=1.65, twist=1.5, detail=170, start=0, end=1 }) {
  const lateral=26
  const positions=[],uv=[],indices=[]
  const frames=path.computeFrenetFrames(detail,false)
  const center=new THREE.Vector3()
  for(let i=0;i<=detail;i++){
    const t=i/detail
    path.getPointAt(t,center)
    const normal=frames.normals[i]
    const binormal=frames.binormals[i]
    const swell=radius*(1+Math.sin(t*Math.PI*3.7+angle)*.065)
    for(let j=0;j<=lateral;j++){
      const across=j/lateral
      const theta=angle+sweep*(across-.5)+twist*t+.18*Math.sin(t*Math.PI*4)
      const ripple=1+.038*Math.sin(t*21+across*12)
      const r=swell*ripple
      const edge=Math.pow(Math.abs(across-.5)*2,2)
      const cr=r+edge*.075
      positions.push(
        center.x+cr*(normal.x*Math.cos(theta)+binormal.x*Math.sin(theta)),
        center.y+cr*(normal.y*Math.cos(theta)+binormal.y*Math.sin(theta)),
        center.z+cr*(normal.z*Math.cos(theta)+binormal.z*Math.sin(theta))
      )
      uv.push(across,t)
      // Leave a real opening at each junction rather than overlapping walls.
      if(i<detail&&j<lateral && i/detail>=start && (i+1)/detail<=end){
        const n=i*(lateral+1)+j
        indices.push(n,n+lateral+1,n+1,n+1,n+lateral+1,n+lateral+2)
      }
    }
  }
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function edgeCurve(path,{radius,angle,sweep,twist,start=0,end=1},edge=1) {
  const pts=[]
  const detail=110
  const frames=path.computeFrenetFrames(detail,false)
  const center=new THREE.Vector3()
  for(let i=0;i<=detail;i++){
    const t=start+(end-start)*i/detail
    const frameIndex=Math.min(detail,Math.round(t*detail))
    path.getPointAt(t,center)
    const theta=angle+sweep*(edge-.5)+twist*t+.18*Math.sin(t*Math.PI*4)
    const r=radius*(1+Math.sin(t*Math.PI*3.7+angle)*.065)+.075
    const normal=frames.normals[frameIndex],binormal=frames.binormals[frameIndex]
    pts.push(center.clone().addScaledVector(normal,r*Math.cos(theta)).addScaledVector(binormal,r*Math.sin(theta)))
  }
  return new THREE.CatmullRomCurve3(pts,false,'catmullrom',.5)
}

const PALETTES = [
  {surface:'#9995bc',edge:'#e8e1d9',emission:'#6860af'},
  {surface:'#aea3ac',edge:'#f3d4c7',emission:'#7e5274'},
  {surface:'#91b0bd',edge:'#b1e1df',emission:'#3d7f8a'}
]

function Surface({path,radius=4.5,angle=0,sweep=1.55,twist=1.1,tint=0,active=false,start=0,end=1}) {
  const materials=useRef([])
  const settings=useMemo(()=>({radius,angle,sweep,twist,start,end}),[radius,angle,sweep,twist,start,end])
  const geometry=useMemo(()=>ribbonMesh(path,settings),[path,settings])
  const edge=useMemo(()=>edgeCurve(path,settings,1),[path,settings])
  const tone=PALETTES[tint%PALETTES.length]
  useFrame(({clock},dt)=>{
    const m=materials.current[0]
    if(m){
      const target=active ? .36 : .21
      m.emissiveIntensity=THREE.MathUtils.damp(m.emissiveIntensity,target,3.5,dt)
    }
  })
  useEffect(()=>()=>{geometry.dispose()},[geometry])
  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial ref={r=>{materials.current[0]=r}} color={tone.surface} side={THREE.DoubleSide}
          metalness={.48} roughness={.24} clearcoat={.95} clearcoatRoughness={.18}
          emissive={tone.emission} emissiveIntensity={.21} flatShading={false}/>
      </mesh>
      <mesh>
        <tubeGeometry args={[edge,135,.018,6,false]}/>
        <meshBasicMaterial color={tone.edge} transparent opacity={active?.85:.56} depthWrite={false} toneMapped={false}/>
      </mesh>
    </group>
  )
}

function Passage({path,radius=4.5,tint=0,active=false,twist=1.05,start=0,end=1}) {
  return <group>
    <Surface path={path} radius={radius} angle={.2} sweep={1.8} twist={twist} tint={tint} active={active} start={start} end={end}/>
    <Surface path={path} radius={radius*.97} angle={2.25} sweep={1.64} twist={twist*.8} tint={(tint+1)%3} active={active} start={start} end={end}/>
    <Surface path={path} radius={radius*1.04} angle={4.27} sweep={1.44} twist={twist*1.08} tint={(tint+2)%3} active={active} start={start} end={end}/>
  </group>
}

function Gateway({path,color,at=.55,radius=3.1,active=false}) {
  const geo=useMemo(()=>{
    const c=path.getPointAt(at)
    const t=path.getTangentAt(at)
    const u=new THREE.Vector3().crossVectors(t,Y).normalize()
    const w=new THREE.Vector3().crossVectors(t,u).normalize()
    const pts=[]
    for(let i=0;i<84;i++){
      const a=i/84*Math.PI*2
      const r=radius*(1+.045*Math.sin(a*5)+.035*Math.cos(a*3))
      pts.push(c.clone().addScaledVector(u,r*Math.cos(a)).addScaledVector(w,r*Math.sin(a)))
    }
    return new THREE.CatmullRomCurve3(pts,true,'centripetal')
  },[path,at,radius])
  const ref=useRef()
  useFrame(({clock})=>{if(ref.current)ref.current.material.opacity=(active?.95:.45)+Math.sin(clock.elapsedTime*1.5)*.04})
  return <mesh ref={ref}>
    <tubeGeometry args={[geo,170,.055,9,true]}/>
    <meshBasicMaterial color={color} transparent opacity={.6} toneMapped={false} depthWrite={false}/>
  </mesh>
}

function Dust() {
  const positions=useMemo(()=>{
    const out=new Float32Array(380*3)
    for(let i=0;i<380;i++){
      out[i*3]=(Math.random()-.5)*30
      out[i*3+1]=(Math.random()-.5)*18
      out[i*3+2]=13-Math.random()*105
    }
    return out
  },[])
  return <points>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry>
    <pointsMaterial color="#d3cfec" size={.024} sizeAttenuation transparent opacity={.55} depthWrite={false}/>
  </points>
}

function CameraFlight({mode,projectIndex,hovered}) {
  const {camera}=useThree()
  const scroll=useRef(0)
  const progress=useRef(null)
  const first=useRef(true)
  const gaze=useMemo(()=>new THREE.Vector3(),[])
  const target=useMemo(()=>new THREE.Vector3(),[])
  const desired=useMemo(()=>new THREE.Vector3(),[])
  const matrix=useMemo(()=>new THREE.Matrix4(),[])
  const quat=useMemo(()=>new THREE.Quaternion(),[])
  const side=useMemo(()=>new THREE.Vector3(),[])
  const tangent=useMemo(()=>new THREE.Vector3(),[])
  const mouse=useRef({x:0,y:0})
  const easedMouse=useRef({x:0,y:0})

  useEffect(()=>{
    const move=e=>{mouse.current.x=e.clientX/window.innerWidth*2-1;mouse.current.y=e.clientY/window.innerHeight*2-1}
    window.addEventListener('pointermove',move,{passive:true})
    return ()=>window.removeEventListener('pointermove',move)
  },[])

  useFrame(({clock},delta)=>{
    const dt=Math.min(delta,.05)
    const lerp=1-Math.exp(-dt*2.7)
    const total=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)
    const fraction=clamp(window.scrollY/total)
    scroll.current=THREE.MathUtils.damp(scroll.current,fraction,3.3,dt)

    let p=WORLD.routes[0]
    let t=HUBS[0]
    const location=window.scrollY

    if(mode==='home'){
      const junctionNode=document.getElementById('junction')
      const workNode=document.getElementById('works')
      const junctionCenter=(junctionNode?.offsetTop || window.innerHeight)
        +(junctionNode?.offsetHeight || window.innerHeight)*.38
      const workStart=workNode?.offsetTop || window.innerHeight*2.2
      const hub=HUBS[0]
      if(location<junctionCenter){
        // Follow the shared tunnel from its entrance to the central atrium.
        t=.025 + smooth(location/Math.max(1,junctionCenter))*(hub+.006-.025)
      }else if(location<workStart){
        // Stay within the open atrium while the visitor chooses a branch.
        const phase=smooth((location-junctionCenter)/Math.max(1,workStart-junctionCenter))
        t=hub+.006+phase*.018
      }else{
        // Then flow down the project passage without jumping across its walls.
        const phase=smooth((location-workStart)/Math.max(1,total-workStart))
        t=hub+.024+phase*(.965-hub-.024)
      }
    }else if(mode==='projects'){
      t=HUBS[0]+.012+smooth(scroll.current)*(.96-HUBS[0]-.012)
    }else if(mode==='experience'){
      p=WORLD.routes[1]
      t=HUBS[1]+.012+smooth(scroll.current)*(.96-HUBS[1]-.012)
    }else if(mode==='contact'){
      p=WORLD.routes[2]
      t=HUBS[2]+.012+smooth(scroll.current)*(.96-HUBS[2]-.012)
    }else if(mode==='detail'){
      const index=Math.max(0,projectIndex)
      p=WORLD.details[index] || WORLD.routes[0]
      const hub=DETAIL_HUBS[index] || .72
      t=hub+.012+smooth(scroll.current)*(.96-hub-.012)
    }

    // Dampen the distance ALONG the path. World-space lerp cuts through bends.
    // A new page mounts its own rig and starts in its intended passage.
    progress.current=first.current || progress.current===null
      ? t : THREE.MathUtils.damp(progress.current,t,3.7,dt)
    const flightT=clamp(progress.current)
    p.getPointAt(flightT,target)
    p.getPointAt(Math.min(.999,flightT+.034),gaze)
    p.getTangentAt(flightT,tangent)
    side.crossVectors(tangent,Y).normalize()
    easedMouse.current.x=THREE.MathUtils.damp(easedMouse.current.x,mouse.current.x,3.2,dt)
    easedMouse.current.y=THREE.MathUtils.damp(easedMouse.current.y,mouse.current.y,3.2,dt)
    desired.copy(target)
      .addScaledVector(side,easedMouse.current.x*.13)
      .addScaledVector(Y,-easedMouse.current.y*.075+Math.sin(clock.elapsedTime*.3)*.026)

    camera.position.copy(desired)
    if(mode==='home'&&hovered){
      const idx=['projects','experience','contact'].indexOf(hovered)
      if(idx>=0 && location>window.innerHeight*.85 && location<workStart){
        // Suggest the selected branch without moving the camera through walls.
        const focus=WORLD.branches[idx].getPointAt(.2)
        gaze.lerp(focus,.11)
      }
    }
    matrix.lookAt(camera.position,gaze,Y)
    quat.setFromRotationMatrix(matrix)
    if(first.current){
      camera.quaternion.copy(quat)
      first.current=false
    }else{
      camera.quaternion.slerp(quat,1-Math.exp(-dt*3.7))
    }
    const speed=Math.abs(fraction-scroll.current)
    const targetFov=45+Math.min(speed*80,5)
    camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,3,dt)
    camera.updateProjectionMatrix()
  })
  return null
}

function Stage({mode,hovered,projectIndex}) {
  const active=['projects','experience','contact'].indexOf(hovered)
  const selected=mode==='projects'||mode==='detail'?0:mode==='experience'?1:mode==='contact'?2:active

  return <>
    <color attach="background" args={['#08080f']}/>
    <fog attach="fog" args={['#08080f',18,115]}/>
    <ambientLight intensity={.9} color="#b3b0d7"/>
    <hemisphereLight intensity={.65} color="#faf1de" groundColor="#282447"/>
    <directionalLight position={[3,9,13]} color="#f6e2d8" intensity={4.8}/>
    <pointLight position={[-5,-2,-9]} color="#9991ff" intensity={42} distance={21} decay={2}/>
    <pointLight position={[5,4,-25]} color="#e6c5b6" intensity={37} distance={28} decay={2}/>
    <pointLight position={[-7,2,-49]} color="#b2e4e6" intensity={52} distance={30} decay={2}/>
    <pointLight position={[3,-1,-72]} color="#a597ee" intensity={55} distance={29} decay={2}/>
    <Passage path={WORLD.trunk} radius={4.65} tint={0} twist={.9} end={.958}/>
    {WORLD.branches.map((path,i)=>(
      <group key={i} visible={mode==='home'||selected===i}>
        <Passage path={path} radius={3.5} tint={i} active={selected===i}
          twist={i===1?.65:1.2} start={.105} end={i===0?.922:1}/>
        <Gateway path={path} radius={3.48} color={branchColors[i]} at={.55} active={selected===i}/>
      </group>
    ))}
    {(mode==='projects'||mode==='detail')&&WORLD.children.map((path,i)=>(
      <group key={i} visible={mode==='projects'||i===projectIndex}>
        <Passage path={path} radius={1.96} tint={i%3}
          active={(mode==='detail'&&i===projectIndex)||hovered==='project-'+i}
          twist={1.2} start={.13}/>
        <Gateway path={path} radius={1.93} color={i%2?'#abddd7':'#bdb3ff'} at={.66} active={mode==='detail'&&i===projectIndex}/>
      </group>
    ))}
    <Dust/>
    <CameraFlight key={mode+'-'+projectIndex} mode={mode} hovered={hovered} projectIndex={projectIndex}/>
  </>
}

export default function World({pathname='/',hovered='',onReady}) {
  const mode=pathname.startsWith('/projets/')?'detail':
    pathname==='/projets'?'projects':
      pathname==='/parcours'||pathname==='/experience'?'experience':
        pathname==='/contact'?'contact':'home'
  const projectIndex=PROJECTS.findIndex(p=>pathname==='/projets/'+p.slug)
  return (
    <Canvas onCreated={onReady}
      camera={{position:[0,0,11],fov:45,near:.12,far:135}}
      dpr={[1,1.65]} gl={{alpha:false,antialias:true,powerPreference:'high-performance'}}
      style={{position:'absolute',inset:0}}>
      <Stage mode={mode} hovered={hovered} projectIndex={projectIndex}/>
    </Canvas>
  )
}
