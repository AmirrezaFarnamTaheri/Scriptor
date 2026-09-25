import assert from 'node:assert/strict'
import test from 'node:test'
import { Text } from '@codemirror/state'

import { findFencedBlocks } from './visual-block-decorations.ts'

test('findFencedBlocks returns complete backtick and tilde fences with metadata', () => {
  const doc = Text.of([
    '# Demo',
    '',
    '```mermaid title="animals"',
    'classDiagram',
    'class Animal',
    '```',
    '',
    '~~~python',
    'print("ok")',
    '~~~~',
  ])

  const blocks = findFencedBlocks(doc)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0]?.language, 'mermaid')
  assert.equal(blocks[0]?.meta, 'title="animals"')
  assert.equal(blocks[0]?.source, 'classDiagram\nclass Animal')
  assert.equal(blocks[1]?.language, 'python')
  assert.equal(blocks[1]?.source, 'print("ok")')
  assert.equal(doc.sliceString(blocks[0]!.from, blocks[0]!.to), '```mermaid title="animals"\nclassDiagram\nclass Animal\n```')
})

test('findFencedBlocks leaves incomplete and invalid fences visible', () => {
  const doc = Text.of([
    '```mermaid',
    'classDiagram',
    '',
    'still source',
  ])
  assert.deepEqual(findFencedBlocks(doc), [])
})
