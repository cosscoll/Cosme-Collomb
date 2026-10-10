import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { followScrollT } from '../scene/cameraMotion.js'
import { corridorFov, corridorHeading, safeEyeOffset, junctionTurnWeight } from '../scene/cameraSafety.js'
import * as THREE from 'three'
import { routeInfo, scrollT, sampleTransit, transitPoint, junctionFor, arrivalT, bridgeBuild, PROJECT_LOOKOUT_T, PROJECT_INDEX_HUB } from '../scene/transit.js'
import {
  PATHS, PROJECT_BRANCH_COLORS, PROJECT_FORK_OPEN, PROJECT_FORK_CLOSE, PROJECT_FORK_FOCUS,
  createSkin, createSeam, shellSpans, TUNNEL_RADIUS, CHAMBERS,
  createJunctionChamber, chamberExitDirection
} from '../scene/geometry.js'

const UP=new THREE.Vector3(0,1,0)
const FORWARD=new THREE.Vector3(0,0,1)
const clamp=n=>Math.min(1,Math.max(0,n))
const smooth=n=>{const v=clamp(n);return v*v*(3-2*v)}

// Camera heading always remains upright when reversing or turning around a
// tunnel junction. Interpolating unnormalised look-at targets can pass through
// the eye and produce a visible 180-degree twitch.
function blendHeading(a,b,weight,target){
  const t=smooth(weight)
  const start=Math.atan2(a.x,-a.z)
  const end=Math.atan2(b.x,-b.z)
  let yawDelta=Math.atan2(Math.sin(end-start),Math.cos(end-start))
  // A nearly opposite heading can fluctuate between +π and -π as the
  // animated camera moves. Always turn around the SAME side of the fork.
  if(Math.abs(yawDelta)>Math.PI-.14)yawDelta=Math.abs(yawDelta)
  const pitchA=Math.asin(THREE.MathUtils.clamp(a.y,-1,1))
  const pitchB=Math.asin(THREE.MathUtils.clamp(b.y,-1,1))
  const yaw=start+yawDelta*t
  const pitch=pitchA+(pitchB-pitchA)*t
  target.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch))
  return target
}

// Keep the geometry of a physical corridor for the whole browsing session.
// Navigating between pages used to recreate thousands of vertices and GPU
// buffers precisely while the camera was turning, causing dropped frames.
// Paths are module-static and there are only 8 project branches.
const SHELL_CACHE=new WeakMap()
function shellResources(path,branch){
  let variants=SHELL_CACHE.get(path)
  if(!variants){variants={};SHELL_CACHE.set(path,variants)}
  const kind=branch?'branch':'corridor'
  if(variants[kind])return variants[kind]
  const radius=branch?2.85:4.25
  const start=0
  const end=1
  const divisions=branch?84:238
  const radial=branch?32:48
  const seamsCount=branch?3:5
  const spans=shellSpans(path)
  // Close to the project hub, eight branches are only a few metres apart.
  // Their previous full-size walls crossed one another directly in front
  // of the camera. Taper gently before expanding to normal tunnel width.
  const radiusProfile=branch?(t,center)=>
    .71+.29*smooth((center.distanceTo(CHAMBERS[1].centre)-8)/12):null
  const geometries=spans.map(([a,b])=>createSkin(path,{
    radius,radiusProfile,
    lengthSegments:Math.max(16,Math.round(divisions*(b-a))),
    radialSegments:radial,start:a,end:b
  }))
  const seamGeometries=spans.flatMap(([a,b])=>
    Array.from({length:seamsCount},(_,i)=>{
      const seam=createSeam(path,i*Math.PI*2/seamsCount,{
        radius:branch?2.05:radius,segments:Math.max(15,Math.round(120*(b-a))),
        start:a,end:b
      })
      return new THREE.TubeGeometry(seam,
        Math.max(25,Math.round(130/spans.length)),
        i%2===0?.018:.009,6,false)
    })
  )
  const resource={geometries,seamGeometries}
  variants[kind]=resource
  return resource
}

function Shell({path,branch=false,transit=null,arrival=false}) {
  const {geometries,seamGeometries}=useMemo(
    ()=>shellResources(path,branch),[path,branch])
  const root=useRef(null)
  useFrame(()=>{
    if(!root.current)return
    const p=transit?(transit.progress??0):0
    // The assembled tunnel owns the destination passage during the flight.
    // Do not render the identical permanent surface over it: the overlapping
    // opaque triangles caused depth fighting and apparent wall flicker.
    // The 8 other project portals never overlap that assembled route.
    root.current.visible=!transit||(arrival?(branch?p>=.52:p>=.96):p<.52)
  })
  return (
    <group ref={root} dispose={null}>
      {geometries.map((geometry,i)=><mesh key={i} geometry={geometry} dispose={null}>
        <meshLambertMaterial vertexColors side={THREE.DoubleSide}
          emissive="#383145" emissiveIntensity={.15}/>
      </mesh>)}
      {seamGeometries.map((geometry,i)=><mesh key={i} geometry={geometry} dispose={null}>
        <meshBasicMaterial color={i%3===0?'#f2d9d0':'#d4d8ff'}
          transparent opacity={i%2===0?.46:.24}
          depthWrite={false} toneMapped={false}/>
      </mesh>)}
    </group>
  )
}

// The two shared 3D chambers remain present through every transition.
// Previously removing shell wall strips left the starfield fully exposed;
// these fixed vaulted walls close that gap without obstructing tunnel mouths.
// A carefully oriented smooth room, not a faceted sphere/tube union.
// Every project entrance is backed by a real corridor. Return entrances
// open only for the visited project, so the crossroads never becomes a
// perforated black object with seventeen simultaneous open holes.
const MAIN_ROOM_GEOMETRY=createJunctionChamber(CHAMBERS[0])
const PROJECT_ROOM_GEOMETRY=createJunctionChamber(CHAMBERS[1])
const RETURN_ROOM_GEOMETRIES=PATHS.returnArms.map(path=>
  createJunctionChamber({
    centre:CHAMBERS[1].centre,
    exits:[...CHAMBERS[1].exits,
      chamberExitDirection(path,CHAMBERS[1].centre,true)],
    radii:[...CHAMBERS[1].radii,2.02]
  }))
function JunctionChambers({mode,index}){
  const room=mode==='detail'&&index>=0?
    RETURN_ROOM_GEOMETRIES[index]:PROJECT_ROOM_GEOMETRY
  return <group name="sealed-smooth-junctions" dispose={null}>
    <mesh geometry={MAIN_ROOM_GEOMETRY} dispose={null}>
      <meshLambertMaterial color="#857d96" side={THREE.BackSide}
        emissive="#554f6a" emissiveIntensity={.28}/>
    </mesh>
    <mesh geometry={room} dispose={null}>
      <meshLambertMaterial color="#82869d" side={THREE.BackSide}
        emissive="#525775" emissiveIntensity={.25}/>
    </mesh>
  </group>
}

// There is exactly ONE permanently rendered tube surface for each physical
// section of the navigation graph. In particular, every opening carved into
// a junction has a real corridor behind it, including unused project arms.
// The previous implementation showed only the SELECTED route, leaving holes
// to black sky for all other exits. Re-rendering full destination paths also
// created overlapping walls and depth flicker when changing pages.
function PhysicalTunnelNetwork({mode,index}){
  return <group name="closed-physical-tunnel-network">
    <Shell path={PATHS.trunk}/>
    {PATHS.arms.map((path,i)=><Shell key={'main-'+i} path={path}/>)}
    {(mode==='projects'||mode==='detail') &&
      PATHS.children.map((path,i)=><Shell key={'out-'+i} path={path} branch/>)}
    {mode==='detail'&&index>=0 &&
      <Shell key={'active-return-'+index} path={PATHS.returnArms[index]} branch/>}
  </group>
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

// Light traces make the project split legible while keeping the atrium open:
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
  const capturedHeading=useRef(new THREE.Vector3(0,0,-1))
  const sourceHeading=useMemo(()=>new THREE.Vector3(),[])
  const destinationHeading=useMemo(()=>new THREE.Vector3(),[])
  const forkHeading=useMemo(()=>new THREE.Vector3(),[])
  const right=useMemo(()=>new THREE.Vector3(),[])
  const matrix=useMemo(()=>new THREE.Matrix4(),[])
  const rotation=useMemo(()=>new THREE.Quaternion(),[])
  const goal=useMemo(()=>new THREE.Vector3(),[])
  const scrollPositions=useRef({junction:1,works:2,fork:2,total:1})
  const pathLength=useMemo(()=>route.path.getLength(),[route.path])
  const transitRoutes=useMemo(()=>transit?{
    from:routeInfo(transit.from),to:routeInfo(transit.to)
  }:null,[transit?.from,transit?.to])

  useEffect(()=>{
    const onMove=e=>{
      pointer.current.x=e.clientX/window.innerWidth*2-1
      pointer.current.y=e.clientY/window.innerHeight*2-1
    }
    window.addEventListener('pointermove',onMove,{passive:true})
    return ()=>window.removeEventListener('pointermove',onMove)
  },[])

  // Read DOM geometry only when the layout changes. offsetTop and
  // scrollHeight inside useFrame previously forced layout on EVERY GPU frame.
  useEffect(()=>{
    let frame=0
    const measure=()=>{
      frame=0
      const home=document.getElementById('junction')
      const work=document.getElementById('works')
      const fork=document.getElementById('project-crossroads')
      const next=scrollPositions.current
      if(home)next.junction=home.offsetTop+home.offsetHeight*.38
      if(work)next.works=work.offsetTop
      if(fork)next.fork=fork.offsetTop
      next.total=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)
    }
    const schedule=()=>{
      if(!frame)frame=requestAnimationFrame(measure)
    }
    measure()
    const content=document.getElementById('content')
    const resized=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null
    if(content)resized?.observe(content)
    const mutated=typeof MutationObserver!=='undefined'?new MutationObserver(schedule):null
    if(content)mutated?.observe(content,{childList:true,subtree:true})
    window.addEventListener('resize',schedule)
    window.addEventListener('portfolio:flight-milestone',schedule)
    return ()=>{
      cancelAnimationFrame(frame)
      resized?.disconnect()
      mutated?.disconnect()
      window.removeEventListener('resize',schedule)
      window.removeEventListener('portfolio:flight-milestone',schedule)
    }
  },[route.pathName,transit?.id])

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
        // Take the actual visible eye direction, so the first animation
        // frame cannot suddenly reverse the camera on header navigation.
        camera.getWorldDirection(capturedHeading.current)
      }
      // The spatial step is calculated after the departure spline is known.
    }else{
      flight.id=null
      flight.p=0
    }
    let visualProgress=transit?flight.p:0
    const total=scrollPositions.current.total
    const y=window.scrollY

    let sample
    if(transit){
      if(transitId.current!==transit.id){
        transitId.current=transit.id
        // Capture the exact position in the existing 3D corridor, BEFORE
        // React Router exchanges the content, even midway through a scroll.
        // React may remount this scene after scroll reset; current.current
        // then points to the PROJECT ENTRANCE, not to the eye at the fork.
        // Navigation captures sourceCameraT before React starts the switch.
        const captured=transit.sourceCameraT
        const observed=window.__portfolioFlight
        const observedT=observed?.currentRoute===transit.from &&
          Number.isFinite(observed.sampleT??observed.t)?
          (observed.sampleT??observed.t):null
        departure.current=Number.isFinite(captured)?captured:
          Number.isFinite(observedT)?observedT:
          current.current===null?
            scrollT(route,{scrollY:y,total,
              junction:scrollPositions.current.junction,
              works:scrollPositions.current.works,
              projectFork:scrollPositions.current.fork}):
            current.current
      }
      const {from,to}=transitRoutes
      // Cap each actual *world-space* frame movement, even when the user
      // changes pages from the far end of a long corridor via the header.
      // This also prevents crossing an opaque wall after a GPU stall.
      const last=sampleTransit(from,to,departure.current,flight.p)
      const lastPoint=transitPoint(last)
      let nextP=Math.min(1,flight.p+dt/(transit.duration/1000))
      for(let attempt=0;attempt<10;attempt++){
        const next=sampleTransit(from,to,departure.current,nextP)
        const point=transitPoint(next)
        if(lastPoint.distanceTo(point)<=.42)break
        nextP=(flight.p+nextP)*.5
      }
      flight.p=nextP
      transit.progress=nextP
      visualProgress=nextP
      sample=sampleTransit(from,to,departure.current,visualProgress)
      current.current=sample.t
      // Keep the bridge and camera on the SAME navigation graph even if a
      // header click is queued before the preceding flight has fully ended.
      if(flightPosition)flightPosition.current={
        t:sample.t,
        pathName:sample.path===to.path?transit.to:transit.from
      }
    }else{
      transitId.current=null
      const nextT=scrollT(route,{
        scrollY:y,total,junction:scrollPositions.current.junction,
        works:scrollPositions.current.works,projectFork:scrollPositions.current.fork
      })
      current.current=current.current===null?nextT:
        followScrollT(current.current,nextT,pathLength,dt)
      sample={path:route.path,t:current.current,
        mode:route.mode,index:route.index}
      if(flightPosition)flightPosition.current={t:current.current,pathName:route.pathName}
    }

    const t=Math.max(.001,Math.min(.998,sample.t))
    transitPoint(sample,position)
    if(transit){
      const p=visualProgress
      const {from,to}=transitRoutes
      const junction=junctionFor(from,to,departure.current)
      const endT=arrivalT(to,from)
      const sourceReverse=junction.fromT<departure.current
      const destinationReverse=endT<junction.toT
      if(p<.52){
        // The visitor first follows the TRUE local tangent, then starts
        // turning only inside the physical aperture of the intersection.
        corridorHeading(from.path,t,sourceReverse,sourceHeading)
        corridorHeading(to.path,junction.toT,destinationReverse,destinationHeading)
        const metresToHub=Math.abs(junction.fromT-t)*from.path.getLength()
        blendHeading(sourceHeading,destinationHeading,
          junctionTurnWeight(metresToHub,false),direction)
      }else{
        corridorHeading(from.path,junction.fromT,sourceReverse,sourceHeading)
        corridorHeading(to.path,t,destinationReverse,destinationHeading)
        const metresFromHub=Math.abs(t-junction.toT)*to.path.getLength()
        blendHeading(sourceHeading,destinationHeading,
          junctionTurnWeight(metresFromHub,true),direction)
      }
      // Never override the physical corridor heading with a fixed
      // target in world space. The old target could point BEHIND the
      // moving camera and create a disorienting automatic turn.
      
      ahead.copy(position).addScaledVector(direction,5)
    }else{
      corridorHeading(sample.path,t,false,direction)
      if(route.mode==='projects'){
        const distanceToJunction=position.distanceTo(CHAMBERS[1].centre)
        const approach=smooth((12-distanceToJunction)/8)
        if(approach>0){
          // Look through the REAL nearest open project doorway, rather than
          // staring at an unpierced section of the curved chamber wall.
          // The nearest forward doorway limits the turn to a small angle;
          // the visitor NEVER rotates to inspect a door behind their head.
          let nearest=null,alignment=-Infinity
          for(const exit of CHAMBERS[1].exits.slice(1)){
            const dot=direction.dot(exit)
            if(dot>alignment){alignment=dot;nearest=exit}
          }
          if(nearest && alignment>.35)direction.lerp(nearest,approach*.94).normalize()
        }
      }
      ahead.copy(position).addScaledVector(direction,5)
    }
    right.crossVectors(direction,UP).normalize()
    softPointer.current.x=THREE.MathUtils.damp(softPointer.current.x,pointer.current.x,3.2,dt)
    softPointer.current.y=THREE.MathUtils.damp(softPointer.current.y,pointer.current.y,3.2,dt)
    // Never let mouse parallax move the eye into a narrow wall or project mouth.
    const offset=safeEyeOffset(camera.aspect,softPointer.current.x,
      softPointer.current.y,clock.elapsedTime)
    goal.copy(position)
      .addScaledVector(right,offset.horizontal)
      .addScaledVector(UP,offset.vertical)
    camera.position.copy(goal)

    // The projects page is an open atrium, not the closed mouth of the trunk.
    // Keep looking through the physical junction toward its project corridors,
    // including immediately after a completed-project return.
    // The camera must always face its ACTUAL corridor. Hover targets and
    // fixed global "fork focus" targets used to pull the POV through walls
    // and sometimes rotate it backward while the visitor was still moving.
    matrix.lookAt(camera.position,ahead,UP)
    rotation.setFromRotationMatrix(matrix)
    if(first.current){
      camera.quaternion.copy(rotation)
      first.current=false
    }else{
      const angle=camera.quaternion.angleTo(rotation)
      const smoothing=1-Math.exp(-Math.min(dt,.07)*(transit?7:5))
      // Only limit angular movement, never damp world position. The older
      // camera-position filter caused another visible catch-up teleport.
      camera.quaternion.slerp(rotation,angle>0?
        Math.min(smoothing,.20/angle):1)
    }
    const boost=transit?2.3*Math.sin(Math.PI*visualProgress):0
    // A room contains eight doors spread across the forward hemisphere;
    // widen the field of view ONLY when the camera is inside that room,
    // never inside a narrow tube where wide FOV clips across the walls.
    const atProjectAtrium=(!transit&&route.mode==='projects')?
      smooth((12-position.distanceTo(CHAMBERS[1].centre))/7):0
    const desiredFov=corridorFov(camera.aspect,boost)+
      atProjectAtrium*(camera.aspect<.8?29:23)
    const fov=THREE.MathUtils.damp(camera.fov,desiredFov,4,dt)
    if(Math.abs(fov-camera.fov)>.001){
      camera.fov=fov
      camera.updateProjectionMatrix()
    }
    // Expose physical flight telemetry for real camera-continuity regression
    // tests (DOM-only route tests cannot detect a 3D position teleport).
    window.__portfolioFlight={
      position:[camera.position.x,camera.position.y,camera.position.z],
      aspect:camera.aspect,fov:camera.fov,
      centreDeviation:camera.position.distanceTo(position),
      minimumWallClearance:Math.min(TUNNEL_RADIUS,2.85)-camera.position.distanceTo(position),
      bridgeProgress:transit?bridgeBuild(visualProgress):null,
      quaternion:[camera.quaternion.x,camera.quaternion.y,camera.quaternion.z,camera.quaternion.w],
      direction:[ahead.x-camera.position.x,ahead.y-camera.position.y,ahead.z-camera.position.z],
      mode:sample.mode,t,sampleT:sample.t,departureT:transit?departure.current:null,
      forkTarget:PROJECT_LOOKOUT_T,transiting:Boolean(transit),
      phase:sample.phase||'scroll',
      currentRoute:route.pathName,from:transit?.from,to:transit?.to,
      flightId:transit?.id??null,
      updatedAt:performance.now(),frameMs:delta*1000,
      progress:transit?visualProgress:null,
      samplePath:transit?(sample.path===transitRoutes.to.path?'destination':'source'):route.pathName
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
    // The bridge must use the SAME captured departure graph node as the
    // camera. Otherwise it can build from the outbound project entrance
    // while the eye is already entering the return junction.
    const startT=Number.isFinite(transit.sourceCameraT)?transit.sourceCameraT:
      flightPosition.current?.pathName===transit.from?
        flightPosition.current.t:.35
    const hub=junctionFor(from,to,startT)
    const arrival=arrivalT(to,from)
    // A finished project enters the crossroads from its separate forward
    // return loop at t=1. The decorative assembly must meet that exact hub,
    // not start 1.5m short at the old outward project entrance.
    const returning=from.mode==='detail' && to.mode==='projects' && hub.fromT>.999
    const reverse=returning || arrival<hub.toT
    const margin=0
    let start,end
    if(reverse){
      start=Math.max(.005,arrival-.09)
      // The return tunnel must physically meet the destination at t=1.
      // Shortening this end to .998 left a visible crack at the junction.
      end=Math.min(1,Math.max(start+.03,hub.toT-margin))
    }else{
      start=Math.min(.985,hub.toT+margin)
      end=Math.min(.998,Math.max(start+.115,arrival+.075))
    }
    const lengthSegments=158,radialSegments=40,radius=4.18
    // The two route splines differ very slightly at the shared control point.
    // Bend the FIRST metres of the *actual tunnel mesh* to meet the outgoing
    // shell, using precisely the same distance-based correction as transitPoint.
    // Merely moving the eye while leaving this mesh behind creates a visibly
    // disconnected mouth — the reported "fake bridge" / wall teleport.
    const hubFrom=from.path.getPointAt(clamp(hub.fromT))
    const hubTo=to.path.getPointAt(clamp(hub.toT))
    const joinShift=hubFrom.clone().sub(hubTo)
    const joinWeight=(t)=>{
      const travel=Math.abs(arrival-hub.toT)<1e-8?0:
        Math.max(0,(t-hub.toT)/(arrival-hub.toT))
      return 1-smooth(travel/.35)
    }
    const skin=createSkin(to.path,{
      start,end,radius,lengthSegments,radialSegments
    })
    const positions=skin.getAttribute('position')
    for(let row=0;row<=lengthSegments;row++){
      const t=start+(end-start)*row/lengthSegments
      const weight=joinWeight(t)
      for(let j=0;j<=radialSegments;j++){
        const index=row*(radialSegments+1)+j
        positions.setXYZ(index,
          positions.getX(index)+joinShift.x*weight,
          positions.getY(index)+joinShift.y*weight,
          positions.getZ(index)+joinShift.z*weight)
      }
    }
    positions.needsUpdate=true
    skin.computeVertexNormals()
    const normals=skin.getAttribute('normal')
    for(let row=0;row<=lengthSegments;row++){
      const a=row*(radialSegments+1),b=a+radialSegments
      const n=new THREE.Vector3().fromBufferAttribute(normals,a)
        .add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize()
      normals.setXYZ(a,n.x,n.y,n.z)
      normals.setXYZ(b,n.x,n.y,n.z)
    }
    normals.needsUpdate=true
    skin.computeBoundingSphere()
    // Measure the real, deformed opening in 3D for the browser regression.
    const hubRow=reverse?lengthSegments:0
    const mouthCentre=new THREE.Vector3()
    for(let j=0;j<radialSegments;j++){
      const index=hubRow*(radialSegments+1)+j
      mouthCentre.x+=positions.getX(index)/radialSegments
      mouthCentre.y+=positions.getY(index)/radialSegments
      mouthCentre.z+=positions.getZ(index)/radialSegments
    }
    const mouthGap=mouthCentre.distanceTo(hubFrom)
    skin.setDrawRange(0,0)
    const guides=Array.from({length:3},(_,i)=>{
      const curve=createSeam(to.path,i*Math.PI*2/3,{
        start,end,radius,segments:156
      })
      curve.points.forEach((point,j)=>{
        const t=start+(end-start)*j/(curve.points.length-1)
        point.addScaledVector(joinShift,joinWeight(t))
      })
      const geom=new THREE.TubeGeometry(curve,128,.018,6,false)
      geom.setDrawRange(0,0)
      return geom
    })
    const rings=Array.from({length:16},(_,i)=>{
      const fraction=(i+.65)/16
      const t=reverse?end-(end-start)*fraction:start+(end-start)*fraction
      const position=to.path.getPointAt(t)
        .addScaledVector(joinShift,joinWeight(t))
      const tangent=to.path.getTangentAt(t).normalize()
      const rotation=new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,0,1),tangent
      )
      return {fraction,position,rotation}
    })
    return {skin,guides,rings,reverse,lengthSegments,radialSegments,mouthGap,hubFromT:hub.fromT}
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
    // Complete the physical tunnel before its destination shell reappears.
    // The new shell takes over after the temporary mesh has nearly faded.
    const visibility=1-smooth((p-.925)/.04)
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
    // Browser regression checks inspect the actual animated index buffer,
    // not merely the appearance of a “bridge” HTML label.
    window.__portfolioBridgeMesh={
      id:transit.id,progress:p,rows,totalRows:journey.lengthSegments,
      opacity:visibility,triangles,mouthGap:journey.mouthGap,
      hubFromT:journey.hubFromT
    }
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
    <mesh geometry={journey.skin} visible={false}>
      <meshStandardMaterial ref={bridgeMaterial} side={THREE.DoubleSide} vertexColors
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

// Use measured render time to lower pixel density on slower phones/GPUs.
// Never skip a route frame or move the eye faster: a 3D resolution change
// preserves motion continuity, unlike cancelling slow camera animation.
function AdaptiveRenderQuality(){
  const {viewport,setDpr}=useThree()
  const sample=useRef({seconds:0,frames:0})
  useFrame((_,delta)=>{
    const q=sample.current
    if(!Number.isFinite(delta)||delta<=0)return
    q.seconds+=Math.min(delta,1)
    q.frames++
    if(q.seconds<2.4)return
    const mean=q.seconds/Math.max(1,q.frames)
    const target=mean>.13?.60:mean>.075?.74:mean>.043?.88:
      mean>.027?1.0:1.2
    if(Math.abs(viewport.dpr-target)>.09)setDpr(target)
    q.frames=0
    q.seconds=0
  },-1)
  return null
}

function Scene({pathname,hovered,transit}) {
  const route=routeInfo(transit?.from||pathname)
  const incoming=transit?routeInfo(transit.to):null
  const flightPosition=useRef(null)
  const {mode,index,path}=route
  // The connected shell network persists through page transitions. Show
  // incoming portals early without drawing them AGAIN on top of a detail
  // page's already visible corridor wall (the overlapping meshes caused
  // black strips and broken-looking junction apertures).
  const networkMode=mode==='detail'||incoming?.mode==='detail'?'detail':
    mode==='projects'||incoming?.mode==='projects'?'projects':mode
  const networkIndex=mode==='detail'?index:
    incoming?.mode==='detail'?incoming.index:index
  return <>
    <color attach="background" args={['#08080f']}/>
    <fog attach="fog" args={['#08080f',22,115]}/>
    {/* Baked vertex colours retain the material detail with only three
        light contributions, not seven per pixel on every tube surface. */}
    <ambientLight intensity={.94} color="#e5dbee"/>
    <hemisphereLight intensity={.83} color="#faf1ef" groundColor="#282438"/>
    <directionalLight position={[4,8,12]} color="#f5dfed" intensity={1.65}/>
    {/* Camera updates the shared progress BEFORE wall and bridge draw ranges.
        Rendering the walls first caused a one-frame mismatch at the handoff. */}
    <AdaptiveRenderQuality/>
    <CameraFlight route={route} hovered={hovered} transit={transit} flightPosition={flightPosition}/>
    <JunctionChambers mode={mode} index={index}/>
    <PhysicalTunnelNetwork mode={networkMode} index={networkIndex}/>
    {/* Real world-space walls are rendered ONCE per spline, never faded,
        doubled, or reset while changing routes. */}
    {(mode==='projects'||mode==='detail'||incoming?.mode==='projects') && PATHS.children.map((arm,i)=>(
      <ForkGuide key={'guide-'+i} path={arm}
        color={PROJECT_BRANCH_COLORS[i]} active={hovered==='project-'+i}/>
    ))}
    {!transit&&<RouteMarkers mode={mode} hovered={hovered}/>}
    {!transit&&<Sparkles/>}
    {transit&&<BuildingBranch key={transit.id} transit={transit} flightPosition={flightPosition}/>}
  </>
}

export default function World({pathname='/',hovered='',transit=null,onReady}) {
  return <Canvas onCreated={onReady}
    camera={{position:[0,0,11],fov:45,near:.065,far:140}}
    dpr={[.8,1.3]}
    gl={{alpha:false,antialias:true,powerPreference:'high-performance'}}
    style={{position:'absolute',inset:0}}>
    <Scene pathname={pathname} hovered={hovered} transit={transit}/>
  </Canvas>
}
