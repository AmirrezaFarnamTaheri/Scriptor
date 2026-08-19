import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const MCP_PLUGIN_ID = 'scriptor.mcp'
export const MCP_PLUGIN_CAPABILITY_ID = 'scriptor.mcp'

/**
 * Static plugin manifest for the MCP package.
 *
 * The `contributes.mcpTools` array MUST stay in sync with:
 *   - packages/mcp/src/tool-contracts.ts  (READ_ONLY_TOOLS + WRITE_TOOLS)
 *   - packages/mcp/src/runtime.ts         (dispatch switch)
 *
 * Drift is tested by auditToolScopeDrift() in tool-scopes.ts.
 * Mode ladder: off → read-only → draft → write-approved
 */
export const mcpPluginManifest: PluginManifest = {
  id: MCP_PLUGIN_ID,
  name: 'Model Context Protocol (MCP)',
  version: '1.0.0',
  description: 'Local stdio & HTTP MCP server exposing safe Markdown knowledge tools to AI agents',
  publisher: 'Scriptor Team',
  capabilityId: MCP_PLUGIN_CAPABILITY_ID,
  rustFeatureGate: 'scriptor-daemon',
  activation: ['on-startup'],
  capabilities: ['mcp-tool'],
  permissions: [
    { permission: 'read', reason: 'Access local knowledge index' },
    { permission: 'write-approved', reason: 'Apply user-approved draft patches to vault notes' },
  ],
  contributes: {
    mcpTools: [
      // ── Read-only tools (17) ─────────────────────────────────────────────
      {
        name: 'mcp.search',
        label: 'Search Notes',
        modeRequired: 'read-only',
        commandId: 'mcp.search',
      },
      {
        name: 'mcp.readNote',
        label: 'Read Note Content',
        modeRequired: 'read-only',
        commandId: 'note.read',
      },
      {
        name: 'mcp.inspectBacklinks',
        label: 'Inspect Backlinks',
        modeRequired: 'read-only',
        commandId: 'graph.backlinks',
      },
      {
        name: 'mcp.inspectBrokenLinks',
        label: 'Inspect Broken Links',
        modeRequired: 'read-only',
        commandId: 'vault.health',
      },
      {
        name: 'mcp.inspectExportProfiles',
        label: 'Inspect Export Profiles',
        modeRequired: 'read-only',
        commandId: 'export.run',
      },
      {
        name: 'mcp.inspectOutline',
        label: 'Inspect Note Outline',
        modeRequired: 'read-only',
        commandId: 'note.read',
      },
      {
        name: 'mcp.listTags',
        label: 'List Vault Tags',
        modeRequired: 'read-only',
        commandId: 'indexer.listTags',
      },
      {
        name: 'mcp.searchByTag',
        label: 'Search Notes by Tag',
        modeRequired: 'read-only',
        commandId: 'indexer.notesForTag',
      },
      {
        name: 'mcp.exportGraph',
        label: 'Export Link Graph',
        modeRequired: 'read-only',
        commandId: 'graph.query',
      },
      {
        name: 'mcp.inspectGraphSummary',
        label: 'Inspect Graph Summary',
        modeRequired: 'read-only',
        commandId: 'graph.summary',
      },
      {
        name: 'mcp.traverseGraph',
        label: 'Traverse Link Graph (BFS)',
        modeRequired: 'read-only',
        commandId: 'graph.traverse',
      },
      {
        name: 'mcp.renderMarkdown',
        label: 'Render Markdown to HTML',
        modeRequired: 'read-only',
        commandId: 'export.render',
      },
      {
        name: 'mcp.getGraphNeighbors',
        label: 'Get Graph Neighbours',
        modeRequired: 'read-only',
        commandId: 'graph.neighbors',
      },
      {
        name: 'mcp.resolveCitation',
        label: 'Resolve Citation Key',
        modeRequired: 'read-only',
        commandId: 'indexer.resolveCitation',
      },
      {
        name: 'mcp.listTasks',
        label: 'List Vault Tasks',
        modeRequired: 'read-only',
        commandId: 'indexer.listTasks',
      },
      {
        name: 'mcp.semanticSearch',
        label: 'Semantic Search',
        modeRequired: 'read-only',
        commandId: 'indexer.semanticSearch',
      },
      {
        name: 'mcp.vaultHealth',
        label: 'Vault Health Summary',
        modeRequired: 'read-only',
        commandId: 'vault.health',
      },
      // ── Draft / write tools (5) ──────────────────────────────────────────
      // Applied to disk only after explicit user approval (write-approved mode).
      {
        name: 'mcp.proposePatch',
        label: 'Propose Markdown Patch',
        modeRequired: 'draft',
        commandId: 'mcp.proposePatch',
      },
      {
        name: 'mcp.proposeTagPatch',
        label: 'Propose Tag Patch',
        modeRequired: 'draft',
        commandId: 'mcp.proposeTagPatch',
      },
      {
        name: 'mcp.createNote',
        label: 'Create Note (Draft)',
        modeRequired: 'draft',
        commandId: 'note.create',
      },
      {
        name: 'mcp.moveNote',
        label: 'Move / Rename Note (Draft)',
        modeRequired: 'draft',
        commandId: 'note.rename',
      },
      {
        name: 'mcp.deleteNote',
        label: 'Delete Note (Draft)',
        modeRequired: 'draft',
        commandId: 'note.delete',
      },
    ],
  },
}
