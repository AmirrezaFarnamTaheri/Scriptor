import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { findDiagramBlocks, replaceDiagramBlocksWithPlaceholders } from './diagram-export.ts'

const markdown = readFileSync(new URL('../../test-fixtures/markdown/semantic-fidelity/mixed-note.md', import.meta.url), 'utf8')

test('MAT-007 export replaces only the diagram while preserving citations and authored syntax', () => {
  const blocks = findDiagramBlocks(markdown)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]?.kind, 'mermaid')
  assert.match(blocks[0]?.source ?? '', /graph LR/)
  const exported = replaceDiagramBlocksWithPlaceholders(markdown)
  assert.match(exported, /diagram-mermaid-pending\.png/)
  for (const authored of ['[[Lab Notes|Lab notes]]', '[@smith2024]', '- [/] In progress', '[^method]']) {
    assert.ok(exported.includes(authored), 'Export changed authored syntax ' + authored)
  }
})
