import assert from 'node:assert/strict'
import test from 'node:test'

import { importsTauriCore } from './frontend-quality-patterns.mjs'

test('detects every supported Tauri core import form', () => {
  assert.equal(importsTauriCore("import { invoke } from '@tauri-apps/api/core'"), true)
  assert.equal(importsTauriCore("const core = await import('@tauri-apps/api/core')"), true)
  assert.equal(importsTauriCore("const core = require('@tauri-apps/api/core')"), true)
  assert.equal(importsTauriCore("import { listen } from '@tauri-apps/api/event'"), false)
})
