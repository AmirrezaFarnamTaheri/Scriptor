import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authorizeWorkspaceAction, parsePluginWorkspace, parsePluginWorkspaceRoute, runtimeConsoleWorkspace } from './workspace.ts'
import { validatePluginManifest } from './manifest.ts'
import { collectContributions } from './contributions.ts'

test('manifest workspace registration validates ownership and collects a landing', () => {
  const manifest = { id: runtimeConsoleWorkspace.pluginId, name: 'Console', version: '1.0.0', publisher: 'Test', description: 'Test workspace', activation: ['manual' as const], capabilities: ['workspace' as const], permissions: [{ permission: 'read' as const, reason: 'View' }], contributes: { workspaces: [runtimeConsoleWorkspace] } }
  assert.equal(validatePluginManifest(manifest).ok, true)
  assert.equal(collectContributions([{ manifest, enabled: true, loadedAt: 'now' }]).workspaces[0].id, 'runtime-console')
  assert.equal(validatePluginManifest({ ...manifest, contributes: { workspaces: [{ ...runtimeConsoleWorkspace, pluginId: 'other.plugin' }] } }).ok, false)
})

const policy = { pluginId: 'scriptor.runtime-console', enabled: true, grantedPermissions: ['read' as const], allowedVaultIds: ['vault-a'], networkAccess: 'blocked' as const, allowlistedHosts: [] }

test('workspace declaration retains text, actions, and bounded stat values', () => {
  const view = parsePluginWorkspace(runtimeConsoleWorkspace)
  assert.equal(view.id, 'runtime-console')
  assert.equal(view.pluginId, policy.pluginId)
  assert.equal(view.sections[0].kind, 'text')
})

test('workspace validation rejects unknown markup, duplicate ids and oversized content', () => {
  assert.throws(() => parsePluginWorkspace({ ...runtimeConsoleWorkspace, sections: [{ id: 'a', kind: 'html', html: '<div />' }] }), /section/)
  assert.throws(() => parsePluginWorkspace({ ...runtimeConsoleWorkspace, sections: [{ id: 'a', kind: 'text', text: 'x'.repeat(16001) }] }), /text/)
  assert.throws(() => parsePluginWorkspace({ ...runtimeConsoleWorkspace, sections: Array.from({ length: 65 }, () => ({ id: 'a', kind: 'text', text: 'x' })) }), /sections/)
  assert.throws(() => parsePluginWorkspace({ ...runtimeConsoleWorkspace, sections: [{ id: 'a', kind: 'text', text: 'x' }, { id: 'a', kind: 'text', text: 'y' }] }), /duplicate/)
})

test('typed deep links confine notes and workspaces to known routes', () => {
  assert.deepEqual(parsePluginWorkspaceRoute({ kind: 'note', path: 'research/Essay.md' }), { kind: 'note', path: 'research/Essay.md' })
  assert.throws(() => parsePluginWorkspaceRoute({ kind: 'note', path: '../private.md' }), /path/)
  assert.throws(() => parsePluginWorkspaceRoute({ kind: 'note', path: 'C:/private.md' }), /path/)
  assert.throws(() => parsePluginWorkspaceRoute({ kind: 'workspace', workspace: 'injected' }), /workspace/)
  assert.throws(() => parsePluginWorkspaceRoute({ kind: 'url', url: 'https://example.com' }), /route/)
})

test('workspace actions reject revoked permission, disabled plugins and cross-vault use', () => {
  const view = parsePluginWorkspace(runtimeConsoleWorkspace)
  const action = view.actions[0]
  authorizeWorkspaceAction(view, action.id, policy, 'vault-a')
  assert.throws(() => authorizeWorkspaceAction(view, action.id, { ...policy, enabled: false }, 'vault-a'), /disabled/)
  assert.throws(() => authorizeWorkspaceAction(view, action.id, { ...policy, grantedPermissions: [] }, 'vault-a'), /permission/)
  assert.throws(() => authorizeWorkspaceAction(view, action.id, policy, 'vault-b'), /scope/)
  assert.throws(() => authorizeWorkspaceAction(view, 'invented', policy, 'vault-a'), /action/)
  assert.throws(() => authorizeWorkspaceAction(view, action.id, { ...policy, pluginId: 'other.plugin' }, 'vault-a'), /identity/)
})

test('command action requires explicit declared command and its permission', () => {
  const definition = { ...runtimeConsoleWorkspace, commands: [{ commandId: 'vault.health', permission: 'write-approved' }], actions: [{ id: 'run', label: 'Run', kind: 'command', commandId: 'vault.health' }] }
  const view = parsePluginWorkspace(definition)
  assert.throws(() => authorizeWorkspaceAction(view, 'run', policy, 'vault-a'), /permission/)
  assert.throws(() => parsePluginWorkspace({ ...definition, commands: [] }), /declared/)
})
