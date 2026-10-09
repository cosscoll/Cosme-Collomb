import test from 'node:test'
import assert from 'node:assert/strict'
import {LOOPS,ZONES,HUB,GATES,point,geometryDiagnostics,framePoint,WIDTH,FLOOR} from '../src/prototype-3d/loopGeometry.js'

test('Five distinct fully closed spatial routes connect to one unchanged carrefour',()=>{
  assert.equal(LOOPS.length,5)
  assert.equal(GATES.length,5)
  assert.deepEqual(geometryDiagnostics(),[])
  for(let i=0;i<5;i++){
    const p=LOOPS[i],z=ZONES[i]
    assert.ok(point(p,0).distanceTo(HUB)<1e-9,'route '+i+' departs hub')
    assert.ok(point(p,1).distanceTo(HUB)<1e-9,'route '+i+' returns to hub')
    assert.ok(z.entrance<z.bridgeStart && z.bridgeStart<z.bridgeEnd&&z.bridgeEnd<z.exit)
    let previous=null
    for(let j=0;j<=56;j++){
      const u=z.bridgeStart+(z.bridgeEnd-z.bridgeStart)*j/56
      const c=point(p,u)
      assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z))
      const left=framePoint(p,u,-WIDTH/2,FLOOR),right=framePoint(p,u,WIDTH/2,FLOOR)
      assert.ok(left.distanceTo(right)>WIDTH*.98)
      if(previous)assert.ok(c.distanceTo(previous)<6,'bridge section is unphysically long')
      previous=c
    }
    console.log('Loop '+(i+1)+': '+p.getLength().toFixed(2)+'m, bridge '+z.bridgeStart.toFixed(3)+'..'+z.bridgeEnd.toFixed(3)+', closed error=0m')
  }
})
test('Five projects occupy distinct petals outside the shared central atrium',()=>{
  const samples=180
  const routes=LOOPS.map(p=>
    Array.from({length:samples+1},(_,j)=>point(p,j/samples))
      .filter(v=>Math.hypot(v.x-HUB.x,v.z-HUB.z)>20))
  const nearest=[]
  for(let i=0;i<5;i++)for(let k=i+1;k<5;k++){
    let closest=Infinity
    for(const a of routes[i])for(const b of routes[k]){
      closest=Math.min(closest,a.distanceTo(b))
    }
    nearest.push({i,k,closest})
    assert.ok(closest>WIDTH*.92,'Loops '+(i+1)+' and '+(k+1)+' overlap: '+closest.toFixed(2)+'m')
  }
  console.log('Minimum inter-project separation outside hub:',Math.min(...nearest.map(n=>n.closest)).toFixed(3),'m')
})
test('Each petal separates its outbound and return tracks',()=>{
  for(let i=0;i<5;i++){
    const p=LOOPS[i],samples=135,points=Array.from({length:samples+1},(_,k)=>point(p,k/samples))
    let closest=Infinity
    for(let a=0;a<points.length;a++)for(let b=a+18;b<points.length;b++){
      const ap=points[a],bp=points[b]
      if(Math.hypot(ap.x-HUB.x,ap.z-HUB.z)<20||
         Math.hypot(bp.x-HUB.x,bp.z-HUB.z)<20)continue
      closest=Math.min(closest,ap.distanceTo(bp))
    }
    assert.ok(closest>1.8,'Loop '+(i+1)+' self-intersects outside hub: '+closest)
    console.log('Loop '+(i+1)+' self-separation '+closest.toFixed(3)+'m')
  }
})
