import type { CommandResult } from '@scriptor/core'

export interface PluginCommandRuntime {
  refreshHealth: () => Promise<void>
  fixVaultLint: () => Promise<unknown>
  exportWithProfile?: (profileId: string) => Promise<void>
  setStatusDockTab: (tab: 'problems' | 'jobs' | 'output' | 'search') => void
  setHealthDashboardOpen: (open: boolean) => void
  openCanvas?: () => void
  openBibliography?: () => void
  openGmailManager?: () => void
  gmailConnect?: (input: unknown) => Promise<unknown>
  gmailImport?: (input: unknown) => Promise<unknown>
  gmailModify?: (input: unknown) => Promise<unknown>
  gmailSend?: (input: unknown) => Promise<unknown>
  showToast?: (message: string) => void
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
    case 'citations.insert':
      if (!runtime.openBibliography) return { handled: false }
      runtime.openBibliography()
      return { handled: true }
    case 'hello.greet':
      runtime.showToast?.('Hello from Scriptor Plugin System!')
      return { handled: true, output: { greeting: 'Hello from Scriptor Plugin System!' } }
    case 'gmail.open':
      if (!runtime.openGmailManager) return { handled: false }
      runtime.openGmailManager()
      return { handled: true, output: { commandId, status: 'opened' } }
    case 'gmail.connect':
      if (!runtime.gmailConnect) return { handled: false }
      return { handled: true, output: await runtime.gmailConnect(context.input) }
    case 'gmail.import':
      if (!runtime.gmailImport) return { handled: false }
      return { handled: true, output: await runtime.gmailImport(context.input) }
    case 'gmail.modify':
      if (!runtime.gmailModify) return { handled: false }
      return { handled: true, output: await runtime.gmailModify(context.input) }
    case 'gmail.send':
      if (!runtime.gmailSend) return { handled: false }
      return { handled: true, output: await runtime.gmailSend(context.input) }
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
  try {
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
  } catch (error) {
    return {
      ok: false,
      requestId,
      error: {
        code: 'mcp.plugin_command_failed',
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
      },
    }
  }
}
