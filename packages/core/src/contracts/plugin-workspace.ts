import type { CommandPermission } from './command'
export type PluginWorkspaceRoute =
  | { kind: 'note'; path: string }
  | { kind: 'workspace'; workspace: 'editor' | 'graph' | 'canvas' | 'knowledge' | 'tasks' | 'export' | 'runtime-console' }
export type PluginWorkspaceSection =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'metrics'; items: Array<{ label: string; value: string }> }
  | { id: string; kind: 'list'; items: Array<{ label: string; description?: string; route?: PluginWorkspaceRoute }> }
export type PluginWorkspaceAction =
  | { id: string; label: string; kind: 'navigate'; route: PluginWorkspaceRoute }
  | { id: string; label: string; kind: 'command'; commandId: string }
export interface PluginWorkspaceDefinition {
  version: 1
  pluginId: string
  id: string
  title: string
  description: string
  sections: PluginWorkspaceSection[]
  actions: PluginWorkspaceAction[]
  commands: Array<{ commandId: string; permission: CommandPermission }>
}
