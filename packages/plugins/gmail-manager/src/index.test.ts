import assert from 'node:assert/strict'
import test from 'node:test'

import { gmailManagerManifest } from './index.ts'

test('Gmail Manager declares a valid, manually activated plugin contract', () => {
  assert.equal(gmailManagerManifest.id, 'scriptor.gmail-manager')
  assert.deepEqual(gmailManagerManifest.activation, ['manual'])
  assert.ok(gmailManagerManifest.permissions.some((entry) => entry.permission === 'dangerous' && entry.optional))
  assert.ok(gmailManagerManifest.contributes?.commands?.some((entry) => entry.commandId === 'gmail.send'))
})
