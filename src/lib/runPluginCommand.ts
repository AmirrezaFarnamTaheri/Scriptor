import type { PluginCommandContribution } from '@scriptor/core/contracts/plugin'

import {
  dispatchPluginCommandId,
  type PluginCommandContext,
  type PluginCommandRuntime,
} from './pluginCommandDispatch'

export type { PluginCommandRuntime } from './pluginCommandDispatch'

export async function runPluginCommand(
  command: PluginCommandContribution,
  runtime: PluginCommandRuntime,
  context: PluginCommandContext = {},
): Promise<boolean> {
  const result = await dispatchPluginCommandId(command.commandId, runtime, context)
  return result.handled
}
