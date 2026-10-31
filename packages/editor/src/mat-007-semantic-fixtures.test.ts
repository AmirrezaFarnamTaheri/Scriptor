import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GFM, parser as commonmark, type MarkdownConfig } from '@lezer/markdown'
import { SCRIPTOR_DEFINED_NODES, scriptorBlockParsers, scriptorInlineParsers } from './markdown/scriptor-parse-config.ts'

const markdown = readFileSync(new URL('../../test-fixtures/markdown/semantic-fidelity/mixed-note.md', import.meta.url), 'utf8')

test('MAT-007 editor parses shared wikilink, citation, GFM table and extended tasks', () => {
  const config: MarkdownConfig = {
    defineNodes: SCRIPTOR_DEFINED_NODES.map(node => ({ name: node.name })),
    parseInline: scriptorInlineParsers(),
    parseBlock: scriptorBlockParsers(),
  }
  const tree = commonmark.configure([GFM, config]).parse(markdown)
  const names: string[] = []
  const cursor = tree.cursor()
  do { if (cursor.name) names.push(cursor.name) } while (cursor.next())
  for (const expected of ['Wikilink', 'WikilinkTarget', 'WikilinkAlias', 'Citation', 'Table', 'Task', 'TaskMarker', 'Footnote']) {
    assert.ok(names.includes(expected), 'Editor missed ' + expected + ': ' + names.join(', '))
  }
})
