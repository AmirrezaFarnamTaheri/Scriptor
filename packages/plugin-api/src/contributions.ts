import type {
  CanvasBlockContribution,
  CanvasToolContribution,
  ExportProfileContribution,
  InspectorWidgetContribution,
  McpToolContribution,
  PluginCommandContribution,
  PluginContributions,
  RendererExtensionContribution,
  TemplatePackContribution,
  VaultHealthCheckContribution,
} from '@scriptor/core/contracts/plugin'

import type { LoadedPlugin } from './registry.ts'

export function collectContributions(plugins: LoadedPlugin[]): Required<{
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
    acc.commands.push(...(contributes.commands ?? []))
    acc.rendererExtensions.push(...(contributes.rendererExtensions ?? []))
    acc.inspectorWidgets.push(...(contributes.inspectorWidgets ?? []))
    acc.exportProfiles.push(...(contributes.exportProfiles ?? []))
    acc.mcpTools.push(...(contributes.mcpTools ?? []))
    acc.vaultHealthChecks.push(...(contributes.vaultHealthChecks ?? []))
    acc.templatePacks.push(...(contributes.templatePacks ?? []))
    acc.canvasTools.push(...(contributes.canvasTools ?? []))
    acc.canvasBlocks.push(...(contributes.canvasBlocks ?? []))
    return acc
  }, {
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
