import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  analyzeFrontmatter,
  extractFrontmatterYaml,
  hasFrontmatter,
  parseSimpleFrontmatter,
} from './contracts/frontmatter.ts'

test('hasFrontmatter detects valid frontmatter header', () => {
  assert.equal(hasFrontmatter('---\ntitle: test\n---'), true)
  assert.equal(hasFrontmatter('---\r\ntitle: test\r\n---'), true)
  assert.equal(hasFrontmatter('# No frontmatter'), false)
  assert.equal(hasFrontmatter('---'), false)
})

test('extractFrontmatterYaml extracts inner yaml block', () => {
  const md = ['---', 'title: Note Title', 'author: Alice', '---', '', '# Body'].join('\n')
  assert.equal(extractFrontmatterYaml(md), 'title: Note Title\nauthor: Alice')
  assert.equal(extractFrontmatterYaml('# No frontmatter'), null)
})

test('parseSimpleFrontmatter extracts scalar key-value mappings', () => {
  const md = ['---', 'title: Note Title', 'tags: alpha, beta', 'date: 2026-08-17', '---'].join('\n')
  const parsed = parseSimpleFrontmatter(md)
  assert.deepEqual(parsed, {
    title: 'Note Title',
    tags: 'alpha, beta',
    date: '2026-08-17',
  })
})

test('analyzeFrontmatter accepts valid frontmatter block', () => {
  const md = ['---', 'title: Valid', 'tags:', '  - one', '  - two', '---', '# Body'].join('\n')
  const res = analyzeFrontmatter(md)
  assert.equal(res.valid, true)
  assert.deepEqual(res.warningLines, [])
})

test('analyzeFrontmatter flags unterminated and malformed frontmatter', () => {
  const unterminated = analyzeFrontmatter('---\ntitle: Missing end\n')
  assert.equal(unterminated.valid, false)
  assert.equal(unterminated.error, 'unterminated frontmatter')

  const malformed = analyzeFrontmatter(['---', 'title Invalid', '---'].join('\n'))
  assert.equal(malformed.valid, false)
  assert.deepEqual(malformed.warningLines, [2])
})
