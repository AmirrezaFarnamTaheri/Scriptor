import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CanvasBlock, CanvasRelation } from '@scriptor/core/contracts/canvas'
import { visibleCanvasRelationEdges } from './canvasRelationGeometry.ts'

const notes: CanvasBlock[] = [
  { id: 'left', kind: 'markdown', layerId: 'main', bounds: { x: -220, y: 10, width: 140, height: 100 }, zIndex: 1, sourceNoteId: 'Research/question.md' },
  { id: 'right', kind: 'markdown', layerId: 'main', bounds: { x: 80, y: 10, width: 140, height: 100 }, zIndex: 2, sourceNoteId: 'Research/evidence.md' },
]
const relation: CanvasRelation = {
  id: 'r1', connectorBlockId: 'connector', sourceNotePath: 'Research/question.md',
  targetNotePath: 'Research/evidence.md', label: 'supports',
}

test('authored relation draws a directed stroke between card borders, not through card labels', () => {
  const edges = visibleCanvasRelationEdges(notes, [relation])
  assert.equal(edges.length, 1)
  assert.equal(edges[0]?.label, 'supports')
  assert.ok(edges[0]!.x1 > -80 && edges[0]!.x1 < 80)
  assert.ok(edges[0]!.x2 > edges[0]!.x1 && edges[0]!.x2 < 80)
  assert.equal(edges[0]!.y1, 60)
  assert.equal(edges[0]!.y2, 60)
  assert.equal(edges[0]!.sourceNotePath, 'Research/question.md')
  assert.equal(edges[0]!.targetNotePath, 'Research/evidence.md')
})

test('reversed authored relation reverses arrow direction', () => {
  const reverse = { ...relation, id: 'r2', sourceNotePath: relation.targetNotePath, targetNotePath: relation.sourceNotePath }
  const stroke = visibleCanvasRelationEdges(notes, [reverse])[0]!
  assert.ok(stroke.x1 > stroke.x2)
})

test('unplaced, same-node, and overlapping notes never invent a link', () => {
  const unavailable = { ...relation, targetNotePath: 'Missing.md' }
  assert.deepEqual(visibleCanvasRelationEdges(notes, [unavailable]), [])
  const same = { ...relation, targetNotePath: relation.sourceNotePath }
  assert.deepEqual(visibleCanvasRelationEdges(notes, [same]), [])
  const overlap = [{ ...notes[0]! }, { ...notes[1]!, bounds: { x: -190, y: 10, width: 140, height: 100 } }]
  assert.deepEqual(visibleCanvasRelationEdges(overlap, [relation]), [])
})

test('no sourceNoteId means no inferred relation regardless of visible content', () => {
  const unlinked = notes.map(({ sourceNoteId: _ignored, ...node }) => node)
  assert.deepEqual(visibleCanvasRelationEdges(unlinked, [relation]), [])
})
