import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { defaultNotePath } from './helpers.ts'

describe('defaultNotePath', () => {
  it('sanitizes cross-platform filename characters and trailing dots', () => {
    assert.equal(defaultNotePath('Quarter / Plan: Q4?'), 'Quarter - Plan- Q4-.md')
    assert.equal(defaultNotePath('Report...   '), 'Report.md')
  })

  it('avoids reserved Windows device names even when an extension is present', () => {
    assert.equal(defaultNotePath('CON'), '_CON.md')
    assert.equal(defaultNotePath('nul.txt'), '_nul.txt.md')
    assert.equal(defaultNotePath('LPT9'), '_LPT9.md')
  })

  it('falls back for empty/dot-only titles and removes control characters', () => {
    assert.equal(defaultNotePath(' . '), 'Untitled.md')
    assert.equal(defaultNotePath('..'), 'Untitled.md')
    assert.equal(defaultNotePath('hello\u0000world'), 'hello-world.md')
  })

  it('bounds the UTF-8 filename component without splitting code points', () => {
    const path = defaultNotePath('\u{1F4DD}'.repeat(200))
    assert.ok(Buffer.byteLength(path, 'utf8') <= 183)
    assert.ok(path.endsWith('.md'))
    assert.doesNotMatch(path, /�/)
  })
})
