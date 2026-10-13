import * as THREE from 'three'

// A small local studio map gives actual metallic reflections without an HDR
// download, extra scene meshes, real-time probes, or per-frame computation.
export function createChromeEnvironment(renderer){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,512,0)
  for(const [at,color] of [[0,'#141414'],[.12,'#6c747f'],[.2,'#ffffff'],[.28,'#141414'],
    [.43,'#6c747f'],[.52,'#ffffff'],[.59,'#2358ff'],[.64,'#6c747f'],[.78,'#ffffff'],[.86,'#141414'],[1,'#394451']])gradient.addColorStop(at,color)
  ctx.fillStyle=gradient;ctx.fillRect(0,0,512,256)
  ctx.fillStyle='#394451';ctx.fillRect(0,0,512,44)
  ctx.fillStyle='#ffffff';ctx.fillRect(86,36,62,146);ctx.fillRect(330,48,96,118)
  ctx.fillStyle='#2358ff';ctx.fillRect(276,65,14,130)
  const shade=ctx.createLinearGradient(0,160,0,256);shade.addColorStop(0,'rgba(20,20,20,0)');shade.addColorStop(1,'rgba(20,20,20,.65)')
  ctx.fillStyle=shade;ctx.fillRect(0,160,512,96)
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
  texture.mapping=THREE.EquirectangularReflectionMapping
  // Phong reflections use a small cubemap directly, rather than the many
  // texture lookups of a PBR roughness convolution on low-powered devices.
  const target=new THREE.WebGLCubeRenderTarget(64)
  target.fromEquirectangularTexture(renderer,texture)
  texture.dispose()
  return target
}
