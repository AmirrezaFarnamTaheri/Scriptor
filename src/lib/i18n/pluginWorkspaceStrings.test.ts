import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localizedWorkspaceReason, pluginWorkspaceStrings } from './pluginWorkspaceStrings.ts'

test('workspace manager controls and unavailability reasons translate in every locale', () => {
  for (const locale of ['en', 'de', 'fa'] as const) {
    const strings = pluginWorkspaceStrings(locale)
    assert.equal(localizedWorkspaceReason('Plugin is disabled', strings), strings.disabled)
    assert.equal(localizedWorkspaceReason('Vault is outside plugin consent scope', strings), strings.vault)
    assert.equal(localizedWorkspaceReason('Plugin read permission is required', strings), strings.read)
    assert.equal(localizedWorkspaceReason(null, strings), null)
    assert.ok(strings.open && strings.opening && strings.failed && strings.refused)
  }
  assert.notEqual(pluginWorkspaceStrings('fa').safeMode, pluginWorkspaceStrings('en').safeMode)
  assert.notEqual(pluginWorkspaceStrings('de').open, pluginWorkspaceStrings('en').open)
})
