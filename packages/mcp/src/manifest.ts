import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const MCP_PLUGIN_ID = 'scriptor.mcp'
export const MCP_PLUGIN_CAPABILITY_ID = 'scriptor.mcp'

export const mcpPluginManifest: PluginManifest = {
  id: MCP_PLUGIN_ID,
  name: 'Model Context Protocol (MCP)',
  version: '0.1.0',
  description: 'Local stdio & HTTP MCP server exposing safe Markdown knowledge tools to AI agents',
  publisher: 'Scriptor Team',
  capabilityId: MCP_PLUGIN_CAPABILITY_ID,
  rustFeatureGate: 'scriptor-mcp-server',
  activation: ['on-startup'],
  capabilities: ['mcp-tool'],
  permissions: [{ permission: 'read', reason: 'Access local knowledge index' }],
  contributes: {
    mcpTools: [
      {
        name: 'read_note',
        label: 'Read Note Content',
        modeRequired: 'read-only',
        commandId: 'mcp.read_note',
      },
      {
        name: 'search_notes',
        label: 'Search Vault Notes',
        modeRequired: 'read-only',
        commandId: 'mcp.search_notes',
      },
    ],
  },
}
