export interface McpRecipe {
  id: string
  label: string
  description: string
  toolName: string
  buildInput: (context: { activePath: string | null }) => unknown
  modeHint?: string
  requiresActiveNote?: boolean
}

export const MCP_RECIPES: McpRecipe[] = [
  {
    id: 'inspect-outline',
    label: 'Outline active note',
    description: 'List headings and structure for the open note.',
    toolName: 'mcp.inspectOutline',
    requiresActiveNote: true,
    buildInput: ({ activePath }) => ({ path: activePath ?? 'Research Plan.md' }),
  },
  {
    id: 'inspect-backlinks',
    label: 'Backlinks for active note',
    description: 'Show notes linking to the current document.',
    toolName: 'mcp.inspectBacklinks',
    requiresActiveNote: true,
    buildInput: ({ activePath }) => ({ path: activePath ?? 'Research Plan.md' }),
  },
  {
    id: 'broken-links',
    label: 'Scan broken links',
    description: 'List vault-wide broken link issues from the index.',
    toolName: 'mcp.inspectBrokenLinks',
    buildInput: () => ({}),
  },
  {
    id: 'export-graph',
    label: 'Neighborhood graph',
    description: 'Export a depth-2 graph around the active note.',
    toolName: 'mcp.exportGraph',
    requiresActiveNote: true,
    buildInput: ({ activePath }) => ({
      focusPath: activePath ?? 'Research Plan.md',
      depth: 2,
    }),
  },
  {
    id: 'search-research',
    label: 'Search vault',
    description: 'Full-text search for research-related notes.',
    toolName: 'mcp.search',
    buildInput: () => ({ query: 'research', limit: 15 }),
  },
  {
    id: 'list-tags',
    label: 'List tags',
    description: 'Browse indexed tags with optional prefix filter.',
    toolName: 'mcp.listTags',
    buildInput: () => ({ prefix: '', limit: 30 }),
  },
  {
    id: 'export-profiles',
    label: 'Inspect export profiles',
    description: 'Review export readiness and configured profiles before publishing.',
    toolName: 'mcp.inspectExportProfiles',
    buildInput: () => ({}),
    modeHint: 'read-only',
  },
  {
    id: 'health-graph',
    label: 'Graph health summary',
    description: 'Cross-check graph connectivity before export or automation.',
    toolName: 'mcp.inspectGraphSummary',
    buildInput: () => ({}),
    modeHint: 'read-only',
  },
  {
    id: 'publish-outline',
    label: 'Export outline check',
    description: 'Validate heading structure on the active note before export.',
    toolName: 'mcp.inspectOutline',
    requiresActiveNote: true,
    buildInput: ({ activePath }) => ({ path: activePath ?? 'Research Plan.md' }),
    modeHint: 'publish',
  },
  {
    id: 'repair-backlinks',
    label: 'Backlink repair triage',
    description: 'List inbound links to prioritize repair work on the active note.',
    toolName: 'mcp.inspectBacklinks',
    requiresActiveNote: true,
    buildInput: ({ activePath }) => ({ path: activePath ?? 'Research Plan.md' }),
    modeHint: 'repair',
  },
]

/** Present only recipes whose owning native MCP tools are registered.
 * An active-note recipe cannot claim to operate on a missing document.
 * Native MCP permission and vault admission remain authoritative at invoke.
 */
export function getAvailableMcpRecipes(toolNames: readonly string[], activePath: string | null): McpRecipe[] {
  const registered = new Set(toolNames)
  const hasActiveNote = Boolean(activePath?.trim())
  return MCP_RECIPES.filter((recipe) => registered.has(recipe.toolName)
    && (!recipe.requiresActiveNote || hasActiveNote))
}
