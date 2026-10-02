import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtimeConsoleWorkspace } from '@scriptor/plugin-api'
import { pluginWorkspaceUnavailableReason } from './pluginWorkspaceAvailability.ts'

const view = runtimeConsoleWorkspace
const policy = { pluginId: view.pluginId, enabled: true, grantedPermissions: ['read' as const], allowedVaultIds: ['vault-a'], networkAccess: 'blocked' as const, allowlistedHosts: [] }

test('workspace launch needs current registration, read consent and vault scope', () => {
  assert.equal(pluginWorkspaceUnavailableReason(view, [view], policy, 'vault-a', false), null)
  assert.match(pluginWorkspaceUnavailableReason(view, [], policy, 'vault-a', false)!, /registered/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], undefined, 'vault-a', false)!, /permissions/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], { ...policy, enabled: false }, 'vault-a', false)!, /disabled/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], { ...policy, grantedPermissions: [] }, 'vault-a', false)!, /permission/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], policy, 'vault-b', false)!, /scope/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], policy, null, false)!, /scope/)
  assert.match(pluginWorkspaceUnavailableReason(view, [view], policy, 'vault-a', true)!, /safe mode/)
})
