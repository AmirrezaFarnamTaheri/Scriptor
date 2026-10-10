import type { CommandPermission } from '@scriptor/core/contracts/command'
import type { PluginManifest, PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'

import type { PluginWorkspaceRoute, PluginWorkspaceSection, PluginWorkspaceAction, PluginWorkspaceDefinition } from '@scriptor/core/contracts/plugin-workspace'
export type { PluginWorkspaceRoute, PluginWorkspaceSection, PluginWorkspaceAction, PluginWorkspaceDefinition } from '@scriptor/core/contracts/plugin-workspace'

const workspaces = new Set(['editor', 'graph', 'canvas', 'knowledge', 'tasks', 'export', 'runtime-console'])
const permissions = new Set(['read', 'write-approved', 'dangerous'])
function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`)
  return value as Record<string, unknown>
}
function text(value: unknown, name: string, limit = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw new Error(`Invalid ${name}`)
  return value
}
function id(value: unknown, name: string): string {
  const result = text(value, name, 64)
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(result) || result.includes('..')) throw new Error(`Invalid ${name}`)
  return result
}
function array(value: unknown, name: string, max = 64): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${name}`)
  return value
}
function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map(value => value.id)).size !== values.length) throw new Error('Workspace contains duplicate ids')
  return values
}
export function parsePluginWorkspaceRoute(input: unknown): PluginWorkspaceRoute {
  const route = record(input, 'route')
  if (route.kind === 'note') {
    const path = text(route.path, 'note path', 1024)
    if (path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..') || /[\r\n]/.test(path) || !path.endsWith('.md')) throw new Error('Invalid note path')
    return { kind: 'note', path }
  }
  if (route.kind === 'workspace') {
    if (typeof route.workspace !== 'string' || !workspaces.has(route.workspace)) throw new Error('Invalid workspace route')
    return { kind: 'workspace', workspace: route.workspace as Extract<PluginWorkspaceRoute, { kind: 'workspace' }>['workspace'] }
  }
  throw new Error('Invalid route kind')
}
export function parsePluginWorkspace(input: unknown): PluginWorkspaceDefinition {
  const source = record(input, 'workspace')
  if (source.version !== 1) throw new Error('Unsupported workspace version')
  const commands = array(source.commands ?? [], 'commands', 32).map(value => {
    const command = record(value, 'command')
    if (typeof command.permission !== 'string' || !permissions.has(command.permission)) throw new Error('Invalid command permission')
    return { commandId: id(command.commandId, 'command id'), permission: command.permission as CommandPermission }
  })
  if (new Set(commands.map(command => command.commandId)).size !== commands.length) throw new Error('Workspace contains duplicate commands')
  const sections = unique(array(source.sections, 'sections').map((value): PluginWorkspaceSection => {
    const section = record(value, 'section')
    const sectionId = id(section.id, 'section id')
    if (section.kind === 'text') return { id: sectionId, kind: 'text', text: text(section.text, 'section text', 16000) }
    if (section.kind === 'metrics') return { id: sectionId, kind: 'metrics', items: array(section.items, 'metrics', 16).map(value => {
      const item = record(value, 'metric')
      return { label: text(item.label, 'metric label'), value: text(item.value, 'metric value') }
    }) }
    if (section.kind === 'list') return { id: sectionId, kind: 'list', items: array(section.items, 'list items', 200).map(value => {
      const item = record(value, 'list item')
      return { label: text(item.label, 'item label'), ...(item.description === undefined ? {} : { description: text(item.description, 'item description', 2000) }), ...(item.route === undefined ? {} : { route: parsePluginWorkspaceRoute(item.route) }) }
    }) }
    throw new Error('Invalid section kind')
  }))
  const actions = unique(array(source.actions ?? [], 'actions', 32).map((value): PluginWorkspaceAction => {
    const action = record(value, 'action')
    const common = { id: id(action.id, 'action id'), label: text(action.label, 'action label') }
    if (action.kind === 'navigate') return { ...common, kind: 'navigate', route: parsePluginWorkspaceRoute(action.route) }
    if (action.kind === 'command') {
      const commandId = id(action.commandId, 'command id')
      if (!commands.some(command => command.commandId === commandId)) throw new Error('Workspace command must be declared')
      return { ...common, kind: 'command', commandId }
    }
    throw new Error('Invalid action kind')
  }))
  return { version: 1, pluginId: id(source.pluginId, 'plugin id'), id: id(source.id, 'workspace id'), title: text(source.title, 'title'), description: text(source.description, 'description', 2000), sections, actions, commands }
}

export function authorizeWorkspaceView(view: PluginWorkspaceDefinition, policy: PluginRuntimePolicy, vaultId: string | null): void {
  if (view.pluginId !== policy.pluginId) throw new Error('Plugin identity does not match the workspace')
  if (!policy.enabled) throw new Error('Plugin is disabled')
  if (!policy.grantedPermissions.includes('read')) throw new Error('Plugin read permission is required')
  if (!vaultId || !policy.allowedVaultIds.includes(vaultId)) throw new Error('Vault is outside plugin consent scope')
}
export function authorizeWorkspaceAction(view: PluginWorkspaceDefinition, actionId: string, policy: PluginRuntimePolicy, vaultId: string | null): PluginWorkspaceAction {
  authorizeWorkspaceView(view, policy, vaultId)
  const action = view.actions.find(candidate => candidate.id === actionId)
  if (!action) throw new Error('Unknown workspace action')
  if (action.kind === 'command') {
    const command = view.commands.find(candidate => candidate.commandId === action.commandId)
    if (!command || !policy.grantedPermissions.includes(command.permission)) throw new Error('Plugin command permission is required')
  }
  return action
}

export const runtimeConsoleWorkspace: PluginWorkspaceDefinition = {
  version: 1, pluginId: 'scriptor.runtime-console', id: 'runtime-console', title: 'Runtime workspace overview',
  description: 'Run bounded code chunks with explicit native authorization. Python supports a reviewed persistent session.',
  sections: [{ id: 'execution-policy', kind: 'text', text: 'Execution uses the desktop process broker with timeout and output limits. Python variables persist within the current vault session; other languages use fresh processes. Every cell requires source-bound authorization.' }],
  actions: [{ id: 'return-to-editor', label: 'Return to writing', kind: 'navigate', route: { kind: 'workspace', workspace: 'editor' } }],
  commands: [],
}

export const runtimeConsoleManifest: PluginManifest = {
  id: runtimeConsoleWorkspace.pluginId,
  capabilityId: 'scriptor.runtime-console',
  name: runtimeConsoleWorkspace.title,
  version: '1.0.0',
  apiVersion: '1.0.0',
  publisher: 'Scriptor Team',
  description: runtimeConsoleWorkspace.description,
  activation: ['manual'],
  capabilities: ['workspace'],
  permissions: [{ permission: 'read', reason: 'View runtime workspace in the reviewed vault' }],
  contributes: { workspaces: [runtimeConsoleWorkspace] },
}
