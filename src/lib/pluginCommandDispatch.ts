import type { CommandResult } from '@scriptor/core'

export interface PluginCommandRuntime {
  refreshHealth: () => Promise<void>
  fixVaultLint: () => Promise<unknown>
  exportWithProfile?: (profileId: string) => Promise<void>
  setStatusDockTab: (tab: 'problems' | 'jobs' | 'output' | 'search') => void
  setHealthDashboardOpen: (open: boolean) => void
  openCanvas?: () => void
}

export interface PluginCommandContext {
  notePath?: string | null
  input?: unknown
}

export async function dispatchPluginCommandId(
  commandId: string,
  runtime: PluginCommandRuntime,
  context: PluginCommandContext = {},
): Promise<{ handled: boolean; output?: unknown }> {
  switch (commandId) {
    case 'vault.health.diagnostics':
      runtime.setHealthDashboardOpen(true)
      runtime.setStatusDockTab('problems')
      await runtime.refreshHealth()
      return { handled: true }
    case 'vault.lint':
      runtime.setStatusDockTab('problems')
      await runtime.refreshHealth()
      return { handled: true }
    case 'vault.lint.fix':
      runtime.setStatusDockTab('problems')
      await runtime.fixVaultLint()
      await runtime.refreshHealth()
      return { handled: true }
    default:
      break
  }

  if (commandId.startsWith('export.')) {
    const profileId = commandId.replace(/^export\./, '')
    if (runtime.exportWithProfile) {
      runtime.setStatusDockTab('jobs')
      await runtime.exportWithProfile(profileId)
      return { handled: true, output: { profileId, notePath: context.notePath ?? null } }
    }
    return { handled: false }
  }

  if (commandId.startsWith('canvas.')) {
    runtime.openCanvas?.()
    return { handled: true, output: { tool: commandId.replace(/^canvas\./, '') } }
  }

  return { handled: false }
}

export async function dispatchPluginCommandIdAsMcpResult(
  commandId: string,
  runtime: PluginCommandRuntime,
  context: PluginCommandContext = {},
): Promise<CommandResult> {
  const requestId = crypto.randomUUID()
  const result = await dispatchPluginCommandId(commandId, runtime, context)
  if (!result.handled) {
    return {
      ok: false,
      requestId,
      error: {
        code: 'mcp.plugin_command_unhandled',
        message: `No runtime handler for plugin command: ${commandId}`,
        recoverable: true,
      },
    }
  }
  return {
    ok: true,
    requestId,
    output: result.output ?? { commandId },
  }
}
