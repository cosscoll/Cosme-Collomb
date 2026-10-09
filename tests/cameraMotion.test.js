import test from 'node:test'
import assert from 'node:assert/strict'
import {followScrollT, MAX_SCROLL_STEP_METRES, MAX_SCROLL_SPEED_MPS} from '../src/scene/cameraMotion.js'

test('Scroll-driven camera never jumps more than the safe physical per-frame distance',()=>{
  const length=145
  for(const dt of [.008,.016,.033,.12,1.5]){
    for(const [start,end] of [[.01,.98],[.98,.01]]){
      const next=followScrollT(start,end,length,dt)
      const travelled=Math.abs(next-start)*length
      assert.ok(travelled<=MAX_SCROLL_STEP_METRES+1e-9)
      assert.ok(travelled<=MAX_SCROLL_SPEED_MPS*Math.min(dt,.12)+1e-9)
      assert.ok(next>=Math.min(start,end)&&next<=Math.max(start,end))
    }
  }
})
test('Scroll smoothing converges steadily after sudden wheel and page-down jumps',()=>{
  let t=.03
  for(let i=0;i<1500;i++)t=followScrollT(t,.94,145,1/60)
  assert.ok(Math.abs(t-.94)<.00001,'Failed to reach far end')
  for(let i=0;i<1500;i++)t=followScrollT(t,.03,145,1/60)
  assert.ok(Math.abs(t-.03)<.00001,'Failed to return to fork')
  assert.equal(followScrollT(null,.4,145,1/60),.4)
  assert.equal(followScrollT(.4,.8,145,0),.4)
})
