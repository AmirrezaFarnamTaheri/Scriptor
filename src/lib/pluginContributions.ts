import type { LoadedPlugin } from '@scriptor/plugin-api'

export interface PluginContributionSummary {
  rendererExtensions: number
  exportProfiles: number
  mcpTools: number
  inspectorWidgets: number
  healthChecks: number
  canvasTools: number
  canvasBlocks: number
  templatePacks: number
  commands: number
  total: number
}

export function summarizePluginContributions(plugin: LoadedPlugin): PluginContributionSummary {
  const contributes = plugin.manifest.contributes ?? {}
  const rendererExtensions = contributes.rendererExtensions?.length ?? 0
  const exportProfiles = contributes.exportProfiles?.length ?? 0
  const mcpTools = contributes.mcpTools?.length ?? 0
  const inspectorWidgets = contributes.inspectorWidgets?.length ?? 0
  const healthChecks = contributes.vaultHealthChecks?.length ?? 0
  const canvasTools = contributes.canvasTools?.length ?? 0
  const canvasBlocks = contributes.canvasBlocks?.length ?? 0
  const templatePacks = contributes.templatePacks?.length ?? 0
  const commands = contributes.commands?.length ?? 0
  return {
    rendererExtensions,
    exportProfiles,
    mcpTools,
    inspectorWidgets,
    healthChecks,
    canvasTools,
    canvasBlocks,
    templatePacks,
    commands,
    total:
      rendererExtensions +
      exportProfiles +
      mcpTools +
      inspectorWidgets +
      healthChecks +
      canvasTools +
      canvasBlocks +
      templatePacks +
      commands,
  }
}

export function contributionLabels(summary: PluginContributionSummary): string[] {
  const labels: string[] = []
  if (summary.exportProfiles > 0) labels.push(`${summary.exportProfiles} export`)
  if (summary.mcpTools > 0) labels.push(`${summary.mcpTools} MCP`)
  if (summary.inspectorWidgets > 0) labels.push(`${summary.inspectorWidgets} inspector`)
  if (summary.rendererExtensions > 0) labels.push(`${summary.rendererExtensions} render`)
  if (summary.canvasTools > 0) labels.push(`${summary.canvasTools} canvas tools`)
  if (summary.templatePacks > 0) labels.push(`${summary.templatePacks} templates`)
  if (summary.healthChecks > 0) labels.push(`${summary.healthChecks} health`)
  if (summary.commands > 0) labels.push(`${summary.commands} commands`)
  return labels
}
