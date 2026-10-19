import assert from 'node:assert/strict'
import test from 'node:test'

import { importsTauriCore, hasExplicitAnyType } from './frontend-quality-patterns.mjs'

test('detects every supported Tauri core import form', () => {
  assert.equal(importsTauriCore("import { invoke } from '@tauri-apps/api/core'"), true)
  assert.equal(importsTauriCore("const core = await import('@tauri-apps/api/core')"), true)
  assert.equal(importsTauriCore("const core = require('@tauri-apps/api/core')"), true)
  assert.equal(importsTauriCore("import { listen } from '@tauri-apps/api/event'"), false)
})

test('explicit any checking ignores comments and literal text without hiding real types', () => {
  for (const source of [
    '/** Hide only the default there: any custom order remains a deliberate choice. */',
    '// Do not use: any here.\nconst name: string = "example"',
    'const message = "as any is discouraged"',
    'const regexp = /: any/;',
  ]) {
    assert.equal(hasExplicitAnyType(source, 'example.ts'), false, source)
  }
  for (const source of [
    'const value: any = 1',
    'const value = unknownValue as any',
    'type Result = any',
    'type Props = { onClick: any }',
  ]) {
    assert.equal(hasExplicitAnyType(source, 'example.ts'), true, source)
  }
})
