import type { CanvasBlockKind } from './canvas'
import type { CommandPermission } from './command'
import type { ExportFormat } from './export'
import type { McpMode } from './mcp'

export type PluginActivation = 'manual' | 'on-startup' | 'on-vault-open'

export type PluginCapability =
  | 'command'
  | 'renderer-extension'
  | 'export-profile'
  | 'mcp-tool'
  | 'inspector-widget'
  | 'vault-health-check'
  | 'canvas-tool'
  | 'canvas-block'
  | 'template-pack'

export interface PluginManifest {
  id: string
  name: string
  version: string
  apiVersion?: string
  publisher: string
  description: string
  activation: PluginActivation[]
  capabilities: PluginCapability[]
  permissions: PluginPermission[]
  contributes?: PluginContributions
}

export interface PluginPermission {
  permission: CommandPermission | 'network' | 'secrets' | 'external-process'
  reason: string
  optional?: boolean
}

export interface PluginContributions {
  commands?: PluginCommandContribution[]
  rendererExtensions?: RendererExtensionContribution[]
  exportProfiles?: ExportProfileContribution[]
  mcpTools?: McpToolContribution[]
  inspectorWidgets?: InspectorWidgetContribution[]
  vaultHealthChecks?: VaultHealthCheckContribution[]
  canvasTools?: CanvasToolContribution[]
  canvasBlocks?: CanvasBlockContribution[]
  templatePacks?: TemplatePackContribution[]
}

export interface PluginCommandContribution {
  commandId: string
  label: string
  category: string
  permission: CommandPermission
}

export interface RendererExtensionContribution {
  id: string
  label: string
  handles: 'block' | 'inline' | 'document'
  priority: number
}

export interface ExportProfileContribution {
  id: string
  label: string
  format: ExportFormat
}

export interface McpToolContribution {
  name: string
  label: string
  modeRequired: McpMode
  commandId: string
}

export interface InspectorWidgetContribution {
  id: string
  label: string
  placement: 'note' | 'vault' | 'export' | 'graph' | 'canvas'
}

export interface VaultHealthCheckContribution {
  id: string
  label: string
  severity: 'info' | 'warning' | 'error'
}


export interface CanvasToolContribution {
  id: string
  label: string
  commandId: string
  toolKind: 'select' | 'draw' | 'shape' | 'connector' | 'template' | 'present' | 'place'
}

export interface CanvasBlockContribution {
  id: string
  label: string
  blockKind: CanvasBlockKind
  rendererId: string
}

export interface TemplatePackContribution {
  id: string
  label: string
  categories: string[]
  canvasCompatible: boolean
  documentCompatible: boolean
}
export interface PluginRuntimePolicy {
  pluginId: string
  enabled: boolean
  grantedPermissions: Array<PluginPermission['permission']>
  allowedVaultIds: string[]
  networkAccess: 'blocked' | 'allowlist'
  allowlistedHosts: string[]
}

