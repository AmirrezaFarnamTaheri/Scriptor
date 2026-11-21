import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sanitizeStyleAttribute } from './rehype-safe-style.ts'

test('position fixed and sticky are dropped even when marked important', () => {
  for (const style of [
    'position:fixed',
    'position: fixed !important',
    'position:fixed!important',
    'position: STICKY ! important',
  ]) {
    assert.equal(sanitizeStyleAttribute(`${style};color:red`), 'color:red', style)
  }
})

test('ordinary declarations keep their important flag', () => {
  assert.equal(sanitizeStyleAttribute('color: red !important'), 'color:red !important')
  assert.equal(sanitizeStyleAttribute('position: relative !important'), 'position:relative !important')
})
