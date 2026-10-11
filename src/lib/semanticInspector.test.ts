import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSemanticInspection, projectSemanticPoints } from './semanticInspector.ts'

const payload = { available:true,provider:'ollama',model:'test',dimension:2,total_notes:2,indexed:1,current:1,stale:0,missing:1,orphaned:0,invalid:0,sampled:1,truncated:false,projection:'PCA',explained_variance:[1,0,0],points:[{note_path:'a.md',coordinates:[3,0,0],stale:false}] }
test('inspector rejects inconsistent measurements and nonfinite coordinates', () => {
  assert.equal(parseSemanticInspection(payload).missing,1)
  assert.throws(() => parseSemanticInspection({...payload,current:2}),/inconsistent/)
  assert.throws(() => parseSemanticInspection({...payload,points:[{...payload.points[0],coordinates:[NaN,0,0]}]}),/coordinates/)
})
test('3D rotation uses the third measured axis and 2D stays fixed', () => {
  const points = [{note_path:'a.md',coordinates:[0,0,2] as [number,number,number],stale:false}]
  assert.equal(projectSemanticPoints(points,'2d',Math.PI/2,0)[0].x,300)
  assert.equal(projectSemanticPoints(points,'3d',Math.PI/2,0)[0].x,565)
})
