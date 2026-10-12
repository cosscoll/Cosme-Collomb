import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { HUB, ROOM, EDGES, PROJECT_EDGES, COLORS, NETWORK_VERSION,
  pointAt, headingAt, frameAt, initialPose, destination, planJourney,
  sampleJourney, scrollDistance, clamp } from '../scene/spatialNetwork.js'
import { advanceMotion } from '../scene/networkMotion.js'
import { decodeNetwork, partitionNetwork } from '../scene/networkMesh.js'
import meshUrl from '../scene/compiled/network.bin?url'

const UP=new THREE.Vector3(0,1,0)
const FORWARD=new THREE.Vector3(0,0,-1)
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t)}

function PermanentNetwork({onReady}) {
  const buffer=useLoader(THREE.FileLoader,meshUrl,loader=>loader.setResponseType('arraybuffer'))
  const geometry=useMemo(()=>{
    const g=decodeNetwork(buffer),p=g.getAttribute('position')
    const colors=new Float32Array(p.count*3)
    const color=new THREE.Color(),a=new THREE.Color('#596579'),b=new THREE.Color('#aaa1b8')
    for(let i=0;i<p.count;i++){
      const blend=.4+.23*Math.sin(p.getZ(i)*.07)+.18*Math.cos(p.getX(i)*.09+p.getY(i)*.08)
      color.copy(a).lerp(b,blend);colors.set([color.r,color.g,color.b],i*3)
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g
  },[buffer])
  const parts=useMemo(()=>partitionNetwork(geometry),[geometry])
  const material=useMemo(()=>new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,
    emissive:'#293144',emissiveIntensity:.23}),[])
  useEffect(()=>{onReady?.()},[onReady])
  // The collider is the exact same geometry that renders the wall.
  useEffect(()=>{window.__portfolioNetworkGeometry=geometry;return ()=>{delete window.__portfolioNetworkGeometry}},[geometry])
  return <group name="permanent-watertight-network" dispose={null}>
    {parts.map((part,i)=><mesh key={i} geometry={part} material={material} dispose={null}/>)}
  </group>
}

function Architecture({hovered}) {
  const ribs=useMemo(()=>{
    const pieces=[]
    for(const edge of EDGES)for(let s=28;s<edge.length-30;s+=7){
      const f=frameAt(edge,s)
      if(f.centre.distanceTo(ROOM.centre)<ROOM.radius+2)continue
      const ring=new THREE.TorusGeometry(edge.radius-.17,.035,4,32)
      ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),f.forward))
      ring.translate(...f.centre.toArray());pieces.push(ring)
    }
    const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return merged
  },[])
  const ribParts=useMemo(()=>partitionNetwork(ribs),[ribs])
  const guides=useMemo(()=>{
    const pieces=[]
    for(const edge of EDGES)for(const side of [-1,1]){
      const points=[]
      for(let s=26;s<edge.length-26;s+=.65){
        const f=frameAt(edge,s)
        points.push(f.centre.addScaledVector(f.right,side*edge.radius*.78).addScaledVector(f.up,-edge.radius*.49))
      }
      pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.ceil(edge.length*.7),.022,3,false))
    }
    const merged=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());return merged
  },[])
  const guideParts=useMemo(()=>partitionNetwork(guides),[guides])
  const ribMaterial=useMemo(()=>new THREE.MeshLambertMaterial({color:'#dad6df'}),[])
  const guideMaterial=useMemo(()=>new THREE.MeshBasicMaterial({color:'#98c5d6'}),[])
  return <group name="permanent-architecture" dispose={null}>
    {ribParts.map((g,i)=><mesh key={'rib-'+i} geometry={g} material={ribMaterial}/>)}
    {guideParts.map((g,i)=><mesh key={'guide-'+i} geometry={g} material={guideMaterial}/>)}
    {PROJECT_EDGES.map((edge,i)=><Portal key={edge.id} edge={edge} active={hovered==='project-'+i}/>)}
  </group>
}

function Portal({edge,active}) {
  const f=useMemo(()=>frameAt(edge,26),[edge])
  const rotation=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),f.forward),[f])
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=160
    const ctx=canvas.getContext('2d')
    ctx.fillStyle=COLORS[edge.index];ctx.font='600 82px sans-serif';ctx.textAlign='center';ctx.fillText(String(edge.index+1).padStart(2,'0'),128,106)
    return new THREE.CanvasTexture(canvas)
  },[edge.index])
  return <group>
    <mesh position={f.centre} quaternion={rotation}>
      <torusGeometry args={[2.64,active?.10:.065,8,64]}/><meshBasicMaterial color={active?'#ffffff':COLORS[edge.index]}/>
    </mesh>
    <sprite position={f.centre.clone().addScaledVector(f.up,1.7)} scale={[1.2,.75,1]}>
      <spriteMaterial map={texture} transparent depthWrite={false}/>
    </sprite>
  </group>
}

// Solid floor plates assemble inside an already sealed tube. The permanent
// wall is never hidden, faded or swapped when their animation ends.
function Assembly({transit}) {
  const mesh=useRef(),ages=useRef(PROJECT_EDGES.map(()=>-1)),seen=useRef(null)
  const pieces=useMemo(()=>PROJECT_EDGES.flatMap(edge=>Array.from({length:16},(_,i)=>({edge,i,...frameAt(edge,32+i*2.6)}))),[])
  const matrix=useMemo(()=>new THREE.Matrix4(),[]),object=useMemo(()=>new THREE.Object3D(),[])
  useFrame((_,delta)=>{
    const d=transit?destination(transit.to):null
    if(transit&&seen.current!==transit.id){seen.current=transit.id;if(d.mode==='detail')ages.current[d.index]=0}
    for(let i=0;i<ages.current.length;i++)if(ages.current[i]>=0)ages.current[i]=Math.min(2,ages.current[i]+Math.min(delta,.055))
    let rows=0
    pieces.forEach((piece,k)=>{
      const age=ages.current[piece.edge.index],built=age<0?0:smooth((age-piece.i*.045)/.48)
      object.position.copy(piece.centre).addScaledVector(piece.up,-3.5+built*1.4)
      matrix.lookAt(piece.centre,piece.centre.clone().add(piece.forward),UP)
      object.quaternion.setFromRotationMatrix(matrix);object.updateMatrix();mesh.current.setMatrixAt(k,object.matrix)
      if(d?.index===piece.edge.index&&built>.99)rows++
    })
    mesh.current.instanceMatrix.needsUpdate=true
    if(transit)window.__portfolioBridgeMesh={id:transit.id,progress:transit.progress??0,rows,totalRows:16,triangles:rows*12,opacity:1,mouthGap:0,permanentShell:true}
  })
  return <instancedMesh name="assembling-floor-plates" ref={mesh} args={[null,null,pieces.length]} frustumCulled={false}>
    <boxGeometry args={[3.25,.13,2.45]}/><meshLambertMaterial color="#8391a6"/>
  </instancedMesh>
}

function Flight({pathname,transit}) {
  const {camera,gl}=useThree()
  const state=useRef(null)
  if(!state.current){const start=transit?.from||pathname;state.current={pose:initialPose(start),page:start,target:0,speed:0,trip:null,id:null,travelled:0}}
  const total=useRef(1)
  const position=useMemo(()=>new THREE.Vector3(),[]),direction=useMemo(()=>new THREE.Vector3(),[])
  const ahead=useMemo(()=>new THREE.Vector3(),[]),matrix=useMemo(()=>new THREE.Matrix4(),[])
  const rayDirection=useMemo(()=>new THREE.Vector3(),[]),light=useRef()
  useEffect(()=>{
    const measure=()=>{total.current=Math.max(1,document.documentElement.scrollHeight-window.innerHeight)}
    const observer=new ResizeObserver(measure);observer.observe(document.getElementById('content'))
    window.addEventListener('resize',measure);measure()
    return ()=>{observer.disconnect();window.removeEventListener('resize',measure)}
  },[])
  useFrame((_,delta)=>{
    const s=state.current
    const newTrip=transit&&s.id!==transit.id
    const externalNavigation=!transit&&!s.trip&&s.page!==pathname
    if(newTrip||externalNavigation){
      s.id=transit?.id??null;s.trip=planJourney(s.pose,transit?.to||pathname)
      s.travelled=0;s.completed=false
    }
    let progress=null
    if(s.trip){
      const motion=advanceMotion(s.travelled,s.trip.length,s.speed,delta,s.pose.edge,s.pose.distance)
      s.travelled=motion.distance;s.speed=motion.speed;s.pose=sampleJourney(s.trip,s.travelled)
      progress=s.trip.length?s.travelled/s.trip.length:1
      if(transit)transit.progress=progress
      if(progress>=1&&!s.completed){
        s.completed=true;s.page=s.trip.destination.pathname;s.target=s.trip.destination.start
        if(transit)window.dispatchEvent(new CustomEvent('portfolio:flight-milestone',{detail:{id:transit.id,stage:'complete'}}))
        s.trip=null
      }
    }else if(!transit){
      const d=destination(s.page)
      if(d.edge){
        s.target=scrollDistance(d,window.scrollY/total.current,Math.max(s.target,s.pose.distance))
        const move=advanceMotion(s.pose.distance,s.target,s.speed,delta,d.edge)
        s.speed=move.speed;s.pose={edge:d.edge,distance:move.distance}
      }else {s.pose={edge:null,distance:0};s.speed=0}
    }
    const pose=s.pose
    if(pose.edge){pointAt(pose.edge,pose.distance,position);headingAt(pose.edge,pose.distance,direction)}
    else {position.copy(HUB);direction.copy(FORWARD)}
    camera.position.copy(position);ahead.copy(position).add(direction)
    matrix.lookAt(position,ahead,UP);camera.quaternion.setFromRotationMatrix(matrix)
    const fov=camera.aspect<.8?88:68
    if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix()}
    light.current.position.copy(position).addScaledVector(direction,1)
    camera.getWorldDirection(rayDirection)
    const d=destination(s.page),t=pose.edge?pose.distance/pose.edge.length:1
    window.__portfolioFlight={version:NETWORK_VERSION,position:position.toArray(),direction:rayDirection.toArray(),quaternion:camera.quaternion.toArray(),
      currentRoute:transit?.from||s.page,mode:d.mode,index:d.index,t,sampleT:t,
      edge:pose.edge?.id??'hub',distance:pose.distance,speed:s.speed,
      forkTarget:1,transiting:Boolean(transit||s.trip),progress,flightId:transit?.id??null,
      from:transit?.from,to:transit?.to,updatedAt:performance.now(),frameMs:delta*1000,
      aspect:camera.aspect,fov:camera.fov,centreDeviation:0,drawCalls:gl.info.render.calls,triangles:gl.info.render.triangles,
      networkObjects:EDGES.length,wallGeometry:window.__portfolioNetworkGeometry?.uuid}
    // Record actual rendered frames and actual quaternions, not target poses.
    if(window.__portfolioCapture){const frames=window.__portfolioFrames||(window.__portfolioFrames=[]);if(frames.length<40000)frames.push({...window.__portfolioFlight})}
  })
  return <pointLight ref={light} color="#ecedff" intensity={48} distance={32} decay={2}/>
}

function AdaptiveQuality(){
  const {setDpr}=useThree();const sample=useRef({time:0,frames:0,dpr:1})
  useFrame((_,delta)=>{
    const s=sample.current;s.time+=Math.min(delta,1);s.frames++
    if(s.time<2.5)return
    const target=s.time/s.frames>.14?.5:s.time/s.frames>.075?.6:s.time/s.frames>.045?.75:s.time/s.frames>.033?.9:1.15
    if(target!==s.dpr){setDpr(target);s.dpr=target}s.time=0;s.frames=0
  })
  return null
}

export default function World({pathname='/',hovered='',transit=null,onReady}) {
  return <Canvas camera={{position:HUB.toArray(),fov:68,near:.06,far:160}} dpr={1}
    gl={{alpha:false,antialias:true,powerPreference:'high-performance'}} style={{position:'absolute',inset:0}}>
    <color attach="background" args={['#101522']}/><fog attach="fog" args={['#283142',38,115]}/>
    <ambientLight intensity={.7}/><hemisphereLight color="#dde7ff" groundColor="#74627c" intensity={1.4}/>
    <PermanentNetwork onReady={onReady}/><Architecture hovered={hovered}/>
    <Flight pathname={pathname} transit={transit}/><Assembly transit={transit}/><AdaptiveQuality/>
  </Canvas>
}
