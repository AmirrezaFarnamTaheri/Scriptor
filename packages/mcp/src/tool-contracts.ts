import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { McpToolDescriptor } from '@scriptor/core/contracts/mcp'

/**
 * Ensure a tool path argument stays inside the vault: relative, no drive
 * letters or UNC prefixes, and no `..` segments. Returns the value unchanged.
 */
export function assertVaultRelativePath(value: string, name = 'path'): string {
  const normalized = value.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`${name} must be a vault-relative path`)
  }
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(`${name} must not contain ".." segments`)
  }
  return value
}

/** Validate an integer payload value against an inclusive range. */
export function assertBoundedInt(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

export interface McpSearchInput {
  query: string
  limit?: number
}

export interface McpReadNoteInput {
  path: string
}

export interface McpBacklinksInput {
  path: string
}

export interface McpOutlineInput {
  path: string
}

export interface McpListTagsInput {
  prefix?: string
  limit?: number
}

export interface McpSearchByTagInput {
  tag: string
  limit?: number
}

export interface McpExportGraphInput {
  focusPath?: string
  depth?: number
}

export interface McpProposePatchInput {
  path: string
  proposedMarkdown: string
  summary: string
  baseContentHash?: string
}

export interface McpProposeTagPatchInput {
  path: string
  add?: string[]
  remove?: string[]
  summary: string
  baseContentHash?: string
}

export interface TagSummaryLike {
  tag: string
  note_count: number
}

export interface TaggedNoteLike {
  path: string
  title: string
}

export interface KnowledgeNoteSummaryLike {
  path: string
  title: string
  inbound_links: number
  outbound_links: number
}

export interface UnresolvedLinkTargetLike {
  target: string
  reference_count: number
  referencing_paths: string[]
}

export interface GraphQueryOutputLike {
  nodes: Array<{ id: string; path: string; label: string; unresolved: boolean }>
  edges: Array<{ id: string; source: string; target: string; kind: string }>
}

export interface HealthIssueLike {
  kind: string
  path: string
  detail: string
  line: number | null
}

export interface McpTraverseGraphInput {
  focusPath: string
  depth?: number
}

export interface McpRenderMarkdownInput {
  markdown: string
  theme?: 'default' | 'grace'
}

export interface McpVaultContext {
  search(query: string, limit?: number): Promise<unknown[]>
  readNote(path: string): Promise<{ metadata: { title: string; content_hash: string }; markdown: string }>
  backlinks(path: string): Promise<unknown[]>
  brokenLinks(): Promise<HealthIssueLike[]>
  listTags?(): Promise<TagSummaryLike[]>
  notesForTag?(tag: string, limit?: number): Promise<TaggedNoteLike[]>
  exportGraph?(focusPath?: string, depth?: number): Promise<GraphQueryOutputLike>
  traverseGraph?(focusPath: string, depth?: number): Promise<unknown[]>
  listOrphans?(): Promise<KnowledgeNoteSummaryLike[]>
  listDeadEnds?(): Promise<KnowledgeNoteSummaryLike[]>
  listUnresolvedTargets?(): Promise<UnresolvedLinkTargetLike[]>
  exportProfiles?(): Promise<ExportProfile[]>
  saveNote?(path: string, markdown: string, expectedContentHash?: string): Promise<unknown>
  renameNote?(from: string, to: string, updateLinks?: boolean): Promise<unknown>
  deleteNote?(path: string): Promise<unknown>
  renderMarkdown?(markdown: string, theme?: string): Promise<string>
}

export const READ_ONLY_TOOLS: McpToolDescriptor[] = [
  {
    name: 'mcp.search',
    description: 'Search indexed notes in the open vault.',
    modeRequired: 'read-only',
    commandId: 'mcp.search',
  },
  {
    name: 'mcp.readNote',
    description: 'Read a note path from the open vault.',
    modeRequired: 'read-only',
    commandId: 'note.read',
  },
  {
    name: 'mcp.inspectBacklinks',
    description: 'List backlinks for a note path.',
    modeRequired: 'read-only',
    commandId: 'graph.backlinks',
  },
  {
    name: 'mcp.inspectBrokenLinks',
    description: 'List broken link diagnostics for the vault.',
    modeRequired: 'read-only',
    commandId: 'vault.health',
  },
  {
    name: 'mcp.inspectExportProfiles',
    description: 'List configured export profiles.',
    modeRequired: 'read-only',
    commandId: 'export.run',
  },
  {
    name: 'mcp.inspectOutline',
    description: 'Return the heading outline for a note path.',
    modeRequired: 'read-only',
    commandId: 'note.read',
  },
  {
    name: 'mcp.listTags',
    description: 'List vault tags with note counts.',
    modeRequired: 'read-only',
    commandId: 'indexer.listTags',
  },
  {
    name: 'mcp.searchByTag',
    description: 'Find notes tagged with a hashtag.',
    modeRequired: 'read-only',
    commandId: 'indexer.notesForTag',
  },
  {
    name: 'mcp.exportGraph',
    description: 'Export a focused link graph (nodes and edges).',
    modeRequired: 'read-only',
    commandId: 'graph.query',
  },
  {
    name: 'mcp.inspectGraphSummary',
    description: 'Workspace graph metrics: orphans, dead ends, unresolved targets, top tags.',
    modeRequired: 'read-only',
    commandId: 'graph.summary',
  },
  {
    name: 'mcp.traverseGraph',
    description: 'Breadth-first traversal steps from a focus note.',
    modeRequired: 'read-only',
    commandId: 'graph.traverse',
  },
  {
    name: 'mcp.renderMarkdown',
    description: 'Render markdown to publication HTML using configured publish themes.',
    modeRequired: 'read-only',
    commandId: 'export.render',
  },
]

export const WRITE_TOOLS: McpToolDescriptor[] = [
  {
    name: 'mcp.proposePatch',
    description: 'Propose a Markdown patch for user approval.',
    modeRequired: 'draft',
    commandId: 'mcp.proposePatch',
  },
  {
    name: 'mcp.proposeTagPatch',
    description: 'Propose hashtag additions/removals for user approval.',
    modeRequired: 'draft',
    commandId: 'mcp.proposeTagPatch',
  },
  {
    name: 'mcp.createNote',
    description: 'Propose creating a new note at a vault path.',
    modeRequired: 'draft',
    commandId: 'note.create',
  },
  {
    name: 'mcp.moveNote',
    description: 'Propose moving/renaming a note with optional link updates.',
    modeRequired: 'draft',
    commandId: 'note.rename',
  },
  {
    name: 'mcp.deleteNote',
    description: 'Propose deleting a note path.',
    modeRequired: 'draft',
    commandId: 'note.delete',
  },
]

export function allMcpTools(): McpToolDescriptor[] {
  return [...READ_ONLY_TOOLS, ...WRITE_TOOLS]
}
