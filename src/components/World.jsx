import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { routeInfo, scrollT, sampleTransit, samplePosition, junctionFor, arrivalT, bridgeBuild, PROJECT_LOOKOUT_T } from '../scene/transit.js'
import {
  PATHS, PROJECT_BRANCH_COLORS, PROJECT_FORK_OPEN, PROJECT_FORK_CLOSE, PROJECT_FORK_FOCUS,
  createSkin, createSeam, detailReturning
} from '../scene/geometry.js'

const UP=new THREE.Vector3(0,1,0)
const FORWARD=new THREE.Vector3(0,0,1)
const clamp=n=>Math.min(1,Math.max(0,n))
const smooth=n=>{const v=clamp(n);return v*v*(3-2*v)}

function Shell({path,branch=false,transit=null,arrival=false}) {
  // Closed 360° surface, with no overlapping opaque walls inside the hub.
  const start=branch?PROJECT_FORK_OPEN:0
  const end=branch?PROJECT_FORK_CLOSE:1
  const radius=branch?2.85:4.25
  // The outgoing and incoming walls have EXACTLY the same tessellation.
  // A lighter preview used to pop into a different full-quality mesh at the
  // final frame, even though the camera itself had not moved.
  const divisions=branch?104:300
  const radial=branch?40:64
  const seamsCount=branch?3:7
  const geometry=useMemo(()=>createSkin(path,{
    radius,lengthSegments:divisions,radialSegments:radial,start,end
  }),[path,branch,arrival])
  const root=useRef(null)
  const surface=useRef(null)
  const seamMaterials=useRef([])
  useFrame((_,dt)=>{
    if(!surface.current)return
    const p=transit?(transit.progress??0):0
    // Never draw two full overlapping opaque route shells at once. They
    // share most of the trunk but have slightly different Frenet frames:
    // transparency overdraw here looked like broken walls / clipping.
    // Switch at the actual common junction while the building branch persists.
    if(root.current)root.current.visible=!transit||
      (arrival?p>=.52:p<.52)
    surface.current.opacity=1
    seamMaterials.current.forEach((material,i)=>{
      if(material)material.opacity=i%2===0?.46:.24
    })
  })
  useEffect(()=>()=>geometry.dispose(),[geometry])
  const seams=useMemo(()=>
    Array.from({length:seamsCount},(_,i)=>
      createSeam(path,i*Math.PI*2/seamsCount,{radius,segments:branch?100:140,start,end})),
    [path,branch,arrival]
  )
  return (
    <group ref={root}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial ref={surface} vertexColors side={THREE.BackSide}
          opacity={1} depthWrite
          metalness={.58} roughness={.29}
          clearcoat={.88} clearcoatRoughness={.17}
          emissive="#514962" emissiveIntensity={.2}/>
      </mesh>
      {seams.map((seam,index)=>(
        <mesh key={index}>
          <tubeGeometry args={[seam,160,index%2===0?.018:.009,6,false]}/>
          <meshBasicMaterial ref={el=>{seamMaterials.current[index]=el}}
            color={index%3===0?'#f2d9d0':'#d4d8ff'}
            transparent opacity={index%2===0?.46:.24}
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
        at={.45} radius={2.1}/>
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

function CameraFlight({route,hovered,transit,flightPosition}) {
  const {camera}=useThree()
  const current=useRef(null)
  const transitId=useRef(null)
  const flightState=useRef({id:null,p:0,mid:false,done:false})
  const departure=useRef(null)
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
    // Clamp elapsed FRAME time, not just clock time: a costly WebGL frame
    // must slow the journey rather than skipping 15 metres when rendering resumes.
    const dt=Math.min(delta,.12)
    const flight=flightState.current
    if(transit){
      if(flight.id!==transit.id){
        flight.id=transit.id
        flight.p=0
        flight.mid=false
        flight.done=false
      }
      // The spatial step is calculated after the departure spline is known.
    }else{
      flight.id=null
      flight.p=0
    }
    let visualProgress=transit?flight.p:0
    const total=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)
    const y=window.scrollY
    const homeJunction=document.getElementById('junction')
    const work=document.getElementById('works')
    const projectFork=document.getElementById('project-crossroads')
    if(homeJunction)scrollPositions.current.junction=homeJunction.offsetTop+homeJunction.offsetHeight*.38
    if(work)scrollPositions.current.works=work.offsetTop
    if(projectFork)scrollPositions.current.fork=projectFork.offsetTop

    let sample
    if(transit){
      if(transitId.current!==transit.id){
        transitId.current=transit.id
        // Capture the exact position in the existing 3D corridor, BEFORE
        // React Router exchanges the content, even midway through a scroll.
        departure.current=current.current===null?
          scrollT(route,{scrollY:y,total,
            junction:scrollPositions.current.junction,
            works:scrollPositions.current.works,
            projectFork:scrollPositions.current.fork}):
          current.current
      }
      const from=routeInfo(transit.from),to=routeInfo(transit.to)
      // Cap each actual *world-space* frame movement, even when the user
      // changes pages from the far end of a long corridor via the header.
      // This also prevents crossing an opaque wall after a GPU stall.
      const last=sampleTransit(from,to,departure.current,flight.p)
      const lastPoint=samplePosition(last)
      let nextP=Math.min(1,flight.p+dt/(transit.duration/1000))
      for(let attempt=0;attempt<10;attempt++){
        const next=sampleTransit(from,to,departure.current,nextP)
        const point=samplePosition(next)
        if(lastPoint.distanceTo(point)<=1.4)break
        nextP=(flight.p+nextP)*.5
      }
      flight.p=nextP
      transit.progress=nextP
      visualProgress=nextP
      sample=sampleTransit(from,to,departure.current,visualProgress)
      current.current=sample.t
    }else{
      transitId.current=null
      const nextT=scrollT(route,{
        scrollY:y,total,junction:scrollPositions.current.junction,
        works:scrollPositions.current.works,projectFork:scrollPositions.current.fork
      })
      current.current=current.current===null?nextT:
        THREE.MathUtils.damp(current.current,nextT,3.4,dt)
      sample={path:route.path,t:current.current,
        reverse:route.mode==='detail'&&detailReturning(y/total),
        mode:route.mode,index:route.index}
      if(flightPosition)flightPosition.current={t:current.current,pathName:route.pathName}
    }

    const t=Math.max(.001,Math.min(.998,sample.t))
    samplePosition(sample,position)
    // Follow the same geometric offset as the camera during the junction
    // handoff: the eye and look target must stay in the same physical tube.
    sample.path.getPointAt(
      sample.reverse?Math.max(.001,t-.024):Math.min(.999,t+.024),ahead
    )
    if(sample.offset)ahead.add(sample.offset)
    if(transit){
      const p=visualProgress
      const from=routeInfo(transit.from),to=routeInfo(transit.to)
      if(p>.29 && p<.75){
        const junction=junctionFor(from,to,departure.current)
        const destT=arrivalT(to,from)
        const lookT=Math.max(.003,Math.min(.997,junction.toT+(destT>=junction.toT?.075:-.075)))
        const destinationLook=to.path.getPointAt(lookT)
        const weight=smooth((p-.29)/.17)*(1-smooth((p-.64)/.11))
        ahead.lerp(destinationLook,weight)
      }
      // Look OUT through the open crossroads, not backwards into the trunk.
      // This turn begins while still approaching the junction, and finishes
      // before the destination shell replaces the temporary bridge.
      if(to.mode==='projects'&&from.mode==='detail'){
        ahead.lerp(PROJECT_FORK_FOCUS,smooth((p-.62)/.25))
      }
    }
    sample.path.getTangentAt(t,direction)
    right.crossVectors(direction,UP).normalize()
    softPointer.current.x=THREE.MathUtils.damp(softPointer.current.x,pointer.current.x,3.2,dt)
    softPointer.current.y=THREE.MathUtils.damp(softPointer.current.y,pointer.current.y,3.2,dt)
    // Keep the eye inside the shared radius on both sides of every fork.
    goal.copy(position)
      .addScaledVector(right,softPointer.current.x*.095)
      .addScaledVector(UP,-softPointer.current.y*.06+Math.sin(clock.elapsedTime*.28)*.015)
    // Filtering the final camera position removes small one-frame pops
    // caused by asynchronous DOM/3D mesh handoffs and frame jitter.
    // The target remains exactly on the spline, within the tube radius.
    if(first.current)camera.position.copy(goal)
    else {
      const remaining=camera.position.distanceTo(goal)
      const easing=1-Math.exp(-dt*(transit?16:13))
      // Also cap the displayed eye movement: scroll restoration and delayed
      // React mounts cannot pull the camera through a wall in one frame.
      camera.position.lerp(goal,remaining>0?
        Math.min(easing,1.10/remaining):1)
    }

    // The projects page is an open atrium, not the closed mouth of the trunk.
    // Keep looking through the physical junction toward its five corridors,
    // including immediately after a completed-project return.
    if(!transit && route.mode==='projects' && y>=scrollPositions.current.fork*.68){
      ahead.copy(PROJECT_FORK_FOCUS)
    }
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
      // A path switch can rotate the desired tangent sharply at a junction.
      // Do not show that as a sudden 90/180-degree snap to the visitor.
      const angle=camera.quaternion.angleTo(rotation)
      const easing=1-Math.exp(-Math.min(dt,.05)*(transit?6:5))
      camera.quaternion.slerp(rotation,angle>0?
        Math.min(easing,.22/angle):1)
    }
    const boost=transit?2.3*Math.sin(Math.PI*visualProgress):0
    camera.fov=THREE.MathUtils.damp(camera.fov,45+boost,4,dt)
    camera.updateProjectionMatrix()
    // Expose physical flight telemetry for real camera-continuity regression
    // tests (DOM-only route tests cannot detect a 3D position teleport).
    window.__portfolioFlight={
      position:[camera.position.x,camera.position.y,camera.position.z],
      quaternion:[camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w],
      direction:[ahead.x-camera.position.x,ahead.y-camera.position.y,ahead.z-camera.position.z],
      mode:sample.mode,t,forkTarget:PROJECT_LOOKOUT_T,transiting:Boolean(transit),
      phase:sample.phase||'scroll',
      currentRoute:route.pathName,from:transit?.from,to:transit?.to,
      progress:transit?visualProgress:null,
      samplePath:transit?(sample.path===routeInfo(transit.to).path?'destination':'source'):route.pathName
    }
    if(transit){
      // Notify React Router only once the camera has PHYSICALLY arrived.
      // Prevents DOM and 3D shell swaps while WebGL rendering is stalled.
      if(!flight.mid&&visualProgress>=.56){
        flight.mid=true
        window.dispatchEvent(new CustomEvent('portfolio:flight-milestone',{
          detail:{id:transit.id,stage:'midpoint'}
        }))
      }
      if(!flight.done&&visualProgress>=1){
        flight.done=true
        window.dispatchEvent(new CustomEvent('portfolio:flight-milestone',{
          detail:{id:transit.id,stage:'complete'}
        }))
      }
    }
  })
  return null
}


// A REAL assembled destination tunnel. Every vertex lies on the same spline
// used by the moving camera. Rendering only the growing index range makes the
// structure visibly assemble from the shared intersection towards its exit.
function BuildingBranch({transit,flightPosition}) {
  const {camera}=useThree()
  const journey=useMemo(()=>{
    const from=routeInfo(transit.from)
    const to=routeInfo(transit.to)
    // The graph junction is shared by both camera paths (no fabricated bridge
    // crossing the existing tunnel wall).
    const hub=junctionFor(from,to,flightPosition.current?.pathName===transit.from?
      flightPosition.current.t:.35)
    const arrival=arrivalT(to,from)
    const reverse=arrival<hub.toT
    const margin=.022
    let start,end
    if(reverse){
      start=Math.max(.005,arrival-.09)
      end=Math.max(start+.03,hub.toT-margin)
    }else{
      start=Math.min(.985,hub.toT+margin)
      end=Math.min(.998,Math.max(start+.115,arrival+.075))
    }
    const lengthSegments=206,radialSegments=48,radius=4.18
    const skin=createSkin(to.path,{
      start,end,radius,lengthSegments,radialSegments
    })
    skin.setDrawRange(0,0)
    const guides=Array.from({length:3},(_,i)=>{
      const curve=createSeam(to.path,i*Math.PI*2/3,{
        start,end,radius,segments:156
      })
      const geom=new THREE.TubeGeometry(curve,206,.018,6,false)
      geom.setDrawRange(0,0)
      return geom
    })
    const rings=Array.from({length:16},(_,i)=>{
      const fraction=(i+.65)/16
      const t=reverse?end-(end-start)*fraction:start+(end-start)*fraction
      const position=to.path.getPointAt(t)
      const tangent=to.path.getTangentAt(t).normalize()
      const rotation=new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,0,1),tangent
      )
      return {fraction,position,rotation}
    })
    return {skin,guides,rings,reverse,lengthSegments,radialSegments}
  },[transit.id])
  const ringGeometry=useMemo(()=>new THREE.TorusGeometry(4.10,.028,7,82),[])
  const ringMeshes=useRef([])
  const bridgeMaterial=useRef(null)
  const guideMaterials=useRef([])
  const light=useRef(null)
  useEffect(()=>()=>{
    journey.skin.dispose()
    journey.guides.forEach(geom=>geom.dispose())
    ringGeometry.dispose()
  },[journey,ringGeometry])
  useFrame((_,dt)=>{
    const p=transit.progress??0
    const built=bridgeBuild(p)
    const visibility=1-smooth((p-.76)/.22)
    if(bridgeMaterial.current){
      bridgeMaterial.current.opacity=visibility
      // Depth-test the fully constructed wall normally. Otherwise several
      // transparent corridor skins fill the same pixels and overload WebGL.
      bridgeMaterial.current.depthWrite=visibility>.975
    }
    guideMaterials.current.forEach((mat,i)=>{
      if(mat)mat.opacity=visibility*.5
    })
    const rowWidth=journey.radialSegments*6
    const rows=Math.min(journey.lengthSegments,
      Math.floor(journey.lengthSegments*built))
    const triangles=rows*rowWidth
    if(journey.reverse)journey.skin.setDrawRange(
      journey.skin.index.count-triangles,triangles)
    else journey.skin.setDrawRange(0,triangles)
    journey.guides.forEach(geometry=>{
      const size=geometry.index?.count||0
      const visible=Math.floor(size*built/36)*36
      geometry.setDrawRange(journey.reverse?size-visible:0,visible)
    })
    journey.rings.forEach((r,i)=>{
      const mesh=ringMeshes.current[i]
      if(!mesh)return
      const glow=Math.max(0,Math.min(1,(built-r.fraction)*8))
      mesh.visible=glow>.015&&visibility>.005
      mesh.material.opacity=(.15+.38*glow)*visibility
    })
    if(light.current)light.current.position.copy(camera.position)
  })
  return <group name="assembling-3d-tunnel">
    <mesh geometry={journey.skin}>
      <meshStandardMaterial ref={bridgeMaterial} side={THREE.BackSide} vertexColors
        transparent opacity={1} roughness={.72} metalness={.19} emissive="#262038"
        emissiveIntensity={.15} depthWrite/>
    </mesh>
    {journey.guides.map((geom,i)=><mesh key={i} geometry={geom}>
      <meshBasicMaterial ref={el=>{guideMaterials.current[i]=el}}
        color={i===1?'#c8b5cf':'#9cafcb'}
        transparent opacity={.50} toneMapped depthWrite={false}/>
    </mesh>)}
    {journey.rings.map((ring,i)=><mesh key={i} ref={el=>{ringMeshes.current[i]=el}}
      geometry={ringGeometry} position={ring.position} quaternion={ring.rotation}
      visible={false}>
      <meshBasicMaterial color={i%3===0?'#d9bfc8':'#b5afda'} transparent
        opacity={0} toneMapped depthWrite={false}/>
    </mesh>)}
    <pointLight ref={light} color="#c9bad8" intensity={5.5} distance={24} decay={2}/>
  </group>
}

function Scene({pathname,hovered,transit}) {
  const route=routeInfo(transit?.from||pathname)
  const incoming=transit?routeInfo(transit.to):null
  const flightPosition=useRef(null)
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
    {transit&&<Shell key={'incoming-'+transit.id} path={incoming.path}
      transit={transit} arrival/>}
    {transit&&incoming.mode==='projects'&&PATHS.children.map((arm,i)=>(
      <Shell key={'incoming-project-'+i+'-'+transit.id}
        path={arm} branch transit={transit} arrival/>
    ))}
    {(mode==='projects'||mode==='detail'||incoming?.mode==='projects') && PATHS.children.map((arm,i)=>(
      <ForkGuide key={'guide-'+i} path={arm}
        color={PROJECT_BRANCH_COLORS[i]} active={hovered==='project-'+i}/>
    ))}
    {!transit&&<RouteMarkers mode={mode} hovered={hovered}/>}
    {!transit&&<Sparkles/>}
    <CameraFlight route={route} hovered={hovered} transit={transit} flightPosition={flightPosition}/>
    {transit&&<BuildingBranch key={transit.id} transit={transit} flightPosition={flightPosition}/>}
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
