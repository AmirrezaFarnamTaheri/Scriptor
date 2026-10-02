import type {
  CanvasBlockContribution,
  CanvasToolContribution,
  ExportProfileContribution,
  InspectorWidgetContribution,
  McpToolContribution,
  PluginCommandContribution,
  PluginContributions,
  PluginRuntimePolicy,
  RendererExtensionContribution,
  TemplatePackContribution,
  VaultHealthCheckContribution,
} from '@scriptor/core/contracts/plugin'

import type { LoadedPlugin } from './registry.ts'
import { authorizeWorkspaceView, parsePluginWorkspace, type PluginWorkspaceDefinition } from './workspace.ts'

export interface WorkspaceContributionScope {
  vaultId: string | null
  policies: Readonly<Record<string, PluginRuntimePolicy | null>>
  safeMode?: boolean
}

export function collectContributions(plugins: LoadedPlugin[], scope?: WorkspaceContributionScope): Required<{
  workspaces: PluginWorkspaceDefinition[]
  commands: PluginCommandContribution[]
  rendererExtensions: RendererExtensionContribution[]
  inspectorWidgets: InspectorWidgetContribution[]
  exportProfiles: ExportProfileContribution[]
  mcpTools: McpToolContribution[]
  vaultHealthChecks: VaultHealthCheckContribution[]
  templatePacks: TemplatePackContribution[]
  canvasTools: CanvasToolContribution[]
  canvasBlocks: CanvasBlockContribution[]
}> {
  const empty: PluginContributions = {}
  const merged = plugins.reduce((acc, plugin) => {
    const contributes = plugin.manifest.contributes ?? empty
    if (plugin.enabled && !scope?.safeMode) {
      for (const input of contributes.workspaces ?? []) {
        const view = parsePluginWorkspace(input)
        if (scope) {
          const policy = scope.policies[view.pluginId]
          if (!policy) continue
          try { authorizeWorkspaceView(view, policy, scope.vaultId) } catch { continue }
        }
        acc.workspaces.push(view)
      }
    }
    acc.commands.push(
      ...(contributes.commands ?? []).map((command) => ({
        ...command,
        pluginId: plugin.manifest.id,
      })),
    )
    acc.rendererExtensions.push(...(contributes.rendererExtensions ?? []))
    acc.inspectorWidgets.push(...(contributes.inspectorWidgets ?? []))
    acc.exportProfiles.push(...(contributes.exportProfiles ?? []))
    acc.mcpTools.push(
      ...(contributes.mcpTools ?? []).map((tool) => ({
        ...tool,
        pluginId: plugin.manifest.id,
        permission:
          contributes.commands?.find((command) => command.commandId === tool.commandId)?.permission ??
          (tool.modeRequired === 'write-approved' ? 'write-approved' : 'read'),
      })),
    )
    acc.vaultHealthChecks.push(...(contributes.vaultHealthChecks ?? []))
    acc.templatePacks.push(...(contributes.templatePacks ?? []))
    acc.canvasTools.push(...(contributes.canvasTools ?? []))
    acc.canvasBlocks.push(...(contributes.canvasBlocks ?? []))
    return acc
  }, {
    workspaces: [] as PluginWorkspaceDefinition[],
    commands: [] as PluginCommandContribution[],
    rendererExtensions: [] as RendererExtensionContribution[],
    inspectorWidgets: [] as InspectorWidgetContribution[],
    exportProfiles: [] as ExportProfileContribution[],
    mcpTools: [] as McpToolContribution[],
    vaultHealthChecks: [] as VaultHealthCheckContribution[],
    templatePacks: [] as TemplatePackContribution[],
    canvasTools: [] as CanvasToolContribution[],
    canvasBlocks: [] as CanvasBlockContribution[],
  })

  return merged
}
