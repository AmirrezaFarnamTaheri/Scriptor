import type { PluginCommandContribution } from '@scriptor/core/contracts/plugin'
import type { PluginWorkspaceRoute } from '@scriptor/plugin-api'
import { runPluginCommand, type PluginCommandRuntime } from './runPluginCommand'

interface Options {
  commands: Array<{ pluginId: string; command: PluginCommandContribution }>
  canExecute(pluginId: string, permission: PluginCommandContribution['permission']): boolean
  runtime: PluginCommandRuntime
  activePath: string | null
  close(): void
  openNote(path: string): void | Promise<unknown>
  openGraph(): void
  openCanvas(): void
  openKnowledge(): void
  openTasks(): void
  openExport(): void
  openRuntime(): void
}
export function createPluginWorkspaceHandlers(options: Options) {
  return {
    onPluginCommand: async (pluginId: string, commandId: string) => {
      const entry = options.commands.find(value => value.pluginId === pluginId && value.command.commandId === commandId)
      if (!entry || !options.canExecute(pluginId, entry.command.permission)) throw new Error('Plugin command permission is unavailable')
      if (!await runPluginCommand(entry.command, options.runtime, { notePath: options.activePath })) throw new Error('Plugin command has no registered handler')
    },
    onNavigate: async (route: PluginWorkspaceRoute) => {
      options.close()
      if (route.kind === 'note') { await options.openNote(route.path); return }
      const handlers = { editor: () => {}, graph: options.openGraph, canvas: options.openCanvas, knowledge: options.openKnowledge,
        tasks: options.openTasks, export: options.openExport, 'runtime-console': options.openRuntime }
      handlers[route.workspace]()
    },
  }
}
