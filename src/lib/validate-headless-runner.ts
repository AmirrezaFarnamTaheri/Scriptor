import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isHeadlessMode, setHeadlessMode } from '../bridge/headlessMode.ts'

test('headless mode toggles globally', () => {
  setHeadlessMode(false)
  assert.equal(isHeadlessMode(), false)
  setHeadlessMode(true)
  assert.equal(isHeadlessMode(), true)
  setHeadlessMode(false)
})
