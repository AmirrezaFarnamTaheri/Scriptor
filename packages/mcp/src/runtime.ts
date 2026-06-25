import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { McpMode, McpToolDescriptor } from '@scriptor/core/contracts/mcp'
import type { CommandResult } from '@scriptor/core/contracts/command'

import { AuditLog } from './audit.ts'
import { approveDraftPatch, createDraftPatch, type DraftPatch, rejectDraftPatch } from './draft.ts'
import { extractOutline } from './outline.ts'
import { modeAllowsTool } from './permissions.ts'
import { applyTagPatch } from './tag-patch.ts'
import {
  createNoteDraft,
  deleteNoteDraft,
  moveNoteDraft,
  type McpCreateNoteInput,
  type McpDeleteNoteInput,
  type McpMoveNoteInput,
} from './note-writes.ts'

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

export class McpRuntime {
  private readonly audit = new AuditLog()
  private readonly drafts: DraftPatch[] = []
  private mode: McpMode
  private readonly context: McpVaultContext | null

  constructor(mode: McpMode, context: McpVaultContext | null) {
    this.mode = mode
    this.context = context
  }

  setMode(mode: McpMode): void {
    this.mode = mode
  }

  getMode(): McpMode {
    return this.mode
  }

  listTools(): McpToolDescriptor[] {
    if (this.mode === 'off') return []
    return allMcpTools().filter((tool) => modeAllowsTool(this.mode, tool.modeRequired))
  }

  listAudit(limit = 50) {
    return this.audit.list(limit)
  }

  listDrafts(): DraftPatch[] {
    return this.drafts.filter((patch) => patch.status === 'pending')
  }

  async invoke(toolName: string, input: unknown): Promise<CommandResult> {
    const requestId = crypto.randomUUID()
    const tool = allMcpTools().find((candidate) => candidate.name === toolName)

    if (!tool) {
      this.audit.append({
        toolName,
        mode: this.mode,
        commandId: toolName,
        outcome: 'failed',
      })
      return {
        ok: false,
        requestId,
        error: { code: 'mcp.tool_missing', message: `Unknown tool: ${toolName}`, recoverable: true },
      }
    }

    if (!modeAllowsTool(this.mode, tool.modeRequired)) {
      this.audit.append({
        toolName,
        mode: this.mode,
        commandId: tool.commandId,
        outcome: 'denied',
      })
      return {
        ok: false,
        requestId,
        error: {
          code: 'mcp.permission_denied',
          message: `Tool ${toolName} requires ${tool.modeRequired} mode`,
          recoverable: true,
        },
      }
    }

    if (!this.context) {
      this.audit.append({
        toolName,
        mode: this.mode,
        commandId: tool.commandId,
        outcome: 'failed',
      })
      return {
        ok: false,
        requestId,
        error: {
          code: 'mcp.vault_unavailable',
          message: 'Open a vault before invoking MCP tools.',
          recoverable: true,
        },
      }
    }

    try {
      const output = await this.dispatch(toolName, input)
      this.audit.append({
        toolName,
        mode: this.mode,
        commandId: tool.commandId,
        outcome: 'allowed',
      })
      return { ok: true, requestId, output }
    } catch (error) {
      this.audit.append({
        toolName,
        mode: this.mode,
        commandId: tool.commandId,
        outcome: 'failed',
      })
      return {
        ok: false,
        requestId,
        error: {
          code: 'mcp.invoke_failed',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      }
    }
  }

  proposePatch(input: McpProposePatchInput): DraftPatch | null {
    if (this.mode !== 'draft' && this.mode !== 'write-approved') {
      return null
    }

    const patch = createDraftPatch({
      notePath: input.path,
      proposedMarkdown: input.proposedMarkdown,
      summary: input.summary,
      baseContentHash: input.baseContentHash,
    })
    this.drafts.unshift(patch)
    this.audit.append({
      toolName: 'mcp.proposePatch',
      mode: this.mode,
      commandId: 'mcp.proposePatch',
      outcome: 'allowed',
    })
    return patch
  }

  async proposeTagPatch(input: McpProposeTagPatchInput): Promise<DraftPatch | null> {
    if (this.mode !== 'draft' && this.mode !== 'write-approved') {
      return null
    }
    if (!this.context) {
      return null
    }

    const add = input.add ?? []
    const remove = input.remove ?? []
    if (add.length === 0 && remove.length === 0) {
      throw new Error('Tag patch requires at least one tag in add or remove')
    }

    const note = await this.context.readNote(input.path)
    const patched = applyTagPatch(note.markdown, add, remove)
    if (patched.markdown === note.markdown) {
      throw new Error('Tag patch made no changes')
    }

    const patch = createDraftPatch({
      notePath: input.path,
      proposedMarkdown: patched.markdown,
      summary: input.summary,
      baseContentHash: input.baseContentHash ?? note.metadata.content_hash,
    })
    this.drafts.unshift(patch)
    this.audit.append({
      toolName: 'mcp.proposeTagPatch',
      mode: this.mode,
      commandId: 'mcp.proposeTagPatch',
      outcome: 'allowed',
    })
    return { ...patch, summary: `${patch.summary} (tags: ${patched.tags.join(', ')})` }
  }

  async approveDraft(patchId: string): Promise<CommandResult> {
    const requestId = crypto.randomUUID()
    const index = this.drafts.findIndex((patch) => patch.id === patchId)
    if (index < 0) {
      return {
        ok: false,
        requestId,
        error: { code: 'mcp.draft_missing', message: 'Draft patch not found', recoverable: true },
      }
    }

    if (!modeAllowsTool(this.mode, 'write-approved')) {
      this.audit.append({
        toolName: 'mcp.proposePatch',
        mode: this.mode,
        commandId: 'note.save',
        outcome: 'denied',
      })
      return {
        ok: false,
        requestId,
        error: {
          code: 'mcp.permission_denied',
          message: 'Approving drafts requires write-approved mode',
          recoverable: true,
        },
      }
    }

    const patch = this.drafts[index]
    let output: unknown

    switch (patch.operation) {
      case 'delete': {
        if (!this.context?.deleteNote) {
          return {
            ok: false,
            requestId,
            error: {
              code: 'mcp.delete_unavailable',
              message: 'Delete bridge is not available',
              recoverable: true,
            },
          }
        }
        output = await this.context.deleteNote(patch.notePath)
        break
      }
      case 'move': {
        if (!this.context?.renameNote || !patch.sourcePath) {
          return {
            ok: false,
            requestId,
            error: {
              code: 'mcp.rename_unavailable',
              message: 'Rename bridge is not available for move drafts',
              recoverable: true,
            },
          }
        }
        output = await this.context.renameNote(patch.sourcePath, patch.notePath, true)
        break
      }
      case 'create':
      case 'patch':
      default: {
        if (!this.context?.saveNote) {
          return {
            ok: false,
            requestId,
            error: {
              code: 'mcp.save_unavailable',
              message: 'Save bridge is not available',
              recoverable: true,
            },
          }
        }
        output = await this.context.saveNote(
          patch.notePath,
          patch.proposedMarkdown,
          patch.baseContentHash,
        )
        break
      }
    }

    this.drafts[index] = approveDraftPatch(patch)
    this.audit.append({
      toolName: 'mcp.proposePatch',
      mode: this.mode,
      commandId: patch.operation === 'delete' ? 'note.delete' : patch.operation === 'move' ? 'note.rename' : 'note.save',
      outcome: 'allowed',
      approvedAt: new Date().toISOString(),
    })
    return { ok: true, requestId, output }
  }

  rejectDraft(patchId: string): boolean {
    const index = this.drafts.findIndex((patch) => patch.id === patchId)
    if (index < 0) return false
    this.drafts[index] = rejectDraftPatch(this.drafts[index])
    this.audit.append({
      toolName: 'mcp.proposePatch',
      mode: this.mode,
      commandId: 'mcp.proposePatch',
      outcome: 'allowed',
    })
    return true
  }

  private async dispatch(toolName: string, input: unknown): Promise<unknown> {
    const ctx = this.context!
    switch (toolName) {
      case 'mcp.search': {
        const payload = input as McpSearchInput
        return ctx.search(payload.query, payload.limit ?? 25)
      }
      case 'mcp.readNote': {
        const payload = input as McpReadNoteInput
        return ctx.readNote(payload.path)
      }
      case 'mcp.inspectBacklinks': {
        const payload = input as McpBacklinksInput
        return ctx.backlinks(payload.path)
      }
      case 'mcp.inspectBrokenLinks':
        return ctx.brokenLinks()
      case 'mcp.inspectExportProfiles':
        return ctx.exportProfiles?.() ?? ([] as ExportProfile[])
      case 'mcp.inspectOutline': {
        const payload = input as McpOutlineInput
        const note = await ctx.readNote(payload.path)
        return {
          path: payload.path,
          title: note.metadata.title,
          outline: extractOutline(note.markdown),
        }
      }
      case 'mcp.listTags': {
        const payload = input as McpListTagsInput
        if (!ctx.listTags) {
          throw new Error('Tag listing is not available')
        }
        let tags = await ctx.listTags()
        if (payload.prefix) {
          const prefix = payload.prefix.replace(/^#/, '').toLowerCase()
          tags = tags.filter((entry) => entry.tag.toLowerCase().startsWith(prefix))
        }
        if (payload.limit && payload.limit > 0) {
          tags = tags.slice(0, payload.limit)
        }
        return tags
      }
      case 'mcp.searchByTag': {
        const payload = input as McpSearchByTagInput
        if (!ctx.notesForTag) {
          throw new Error('Tag search is not available')
        }
        return ctx.notesForTag(payload.tag.replace(/^#/, ''), payload.limit)
      }
      case 'mcp.exportGraph': {
        const payload = input as McpExportGraphInput
        if (!ctx.exportGraph) {
          throw new Error('Graph export is not available')
        }
        return ctx.exportGraph(payload.focusPath, payload.depth ?? 1)
      }
      case 'mcp.inspectGraphSummary': {
        const [orphans, deadEnds, unresolved, tags] = await Promise.all([
          ctx.listOrphans?.() ?? [],
          ctx.listDeadEnds?.() ?? [],
          ctx.listUnresolvedTargets?.() ?? [],
          ctx.listTags?.() ?? [],
        ])
        return {
          orphan_count: orphans.length,
          dead_end_count: deadEnds.length,
          unresolved_target_count: unresolved.length,
          tag_count: tags.length,
          top_tags: tags.slice(0, 10),
          orphans: orphans.slice(0, 25),
          dead_ends: deadEnds.slice(0, 25),
          unresolved_targets: unresolved.slice(0, 25),
        }
      }
      case 'mcp.traverseGraph': {
        const payload = input as McpTraverseGraphInput
        if (!ctx.traverseGraph) {
          throw new Error('Graph traversal is not available')
        }
        return ctx.traverseGraph(payload.focusPath, payload.depth ?? 2)
      }
      case 'mcp.renderMarkdown': {
        const payload = input as McpRenderMarkdownInput
        if (!ctx.renderMarkdown) {
          throw new Error('Markdown rendering is not available')
        }
        return ctx.renderMarkdown(payload.markdown, payload.theme)
      }
      case 'mcp.proposePatch': {
        const payload = input as McpProposePatchInput
        const patch = this.proposePatch(payload)
        if (!patch) {
          throw new Error('Draft patches require draft or write-approved mode')
        }
        return patch
      }
      case 'mcp.proposeTagPatch': {
        const payload = input as McpProposeTagPatchInput
        const patch = await this.proposeTagPatch(payload)
        if (!patch) {
          throw new Error('Tag patches require draft or write-approved mode')
        }
        return patch
      }
      case 'mcp.createNote': {
        const payload = input as McpCreateNoteInput
        const patch = createNoteDraft(payload)
        this.drafts.unshift(patch)
        return patch
      }
      case 'mcp.moveNote': {
        const payload = input as McpMoveNoteInput
        const note = await ctx.readNote(payload.from)
        const patch = moveNoteDraft(payload, note.markdown, note.metadata.content_hash)
        this.drafts.unshift(patch)
        return patch
      }
      case 'mcp.deleteNote': {
        const payload = input as McpDeleteNoteInput
        const patch = deleteNoteDraft(payload)
        this.drafts.unshift(patch)
        return patch
      }
      default:
        throw new Error(`Unhandled tool: ${toolName}`)
    }
  }
}

export async function runRuntimeReadOnlyTests(): Promise<string[]> {
  const failures: string[] = []
  let saveCalled = false

  const runtime = new McpRuntime('read-only', {
    async search() {
      return [{ path: 'note.md' }]
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note\n\n## Section' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
    async listTags() {
      return [{ tag: 'draft', note_count: 1 }]
    },
    async notesForTag() {
      return [{ path: 'note.md', title: 'Note' }]
    },
    async exportGraph() {
      return { nodes: [], edges: [] }
    },
    async listOrphans() {
      return []
    },
    async listDeadEnds() {
      return []
    },
    async listUnresolvedTargets() {
      return []
    },
    async renderMarkdown(markdown: string) {
      return `<article>${markdown}</article>`
    },
    async saveNote() {
      saveCalled = true
      return {}
    },
  })

  const denied = await runtime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Hack',
    summary: 'bad',
  })
  if (denied.ok) failures.push('read-only should deny proposePatch invoke')

  const allowed = await runtime.invoke('mcp.search', { query: 'note' })
  if (!allowed.ok) failures.push('read-only should allow search')
  if (saveCalled) failures.push('read-only must not save')

  const outline = await runtime.invoke('mcp.inspectOutline', { path: 'note.md' })
  if (!outline.ok) failures.push('read-only should allow inspectOutline')

  const tags = await runtime.invoke('mcp.listTags', {})
  if (!tags.ok) failures.push('read-only should allow listTags')

  const graph = await runtime.invoke('mcp.exportGraph', { focusPath: 'note.md', depth: 1 })
  if (!graph.ok) failures.push('read-only should allow exportGraph')

  const rendered = await runtime.invoke('mcp.renderMarkdown', { markdown: '# Hello' })
  if (!rendered.ok) failures.push('read-only should allow renderMarkdown when handler is configured')

  const summary = await runtime.invoke('mcp.inspectGraphSummary', {})
  if (!summary.ok) failures.push('read-only should allow inspectGraphSummary')

  const draftRuntime = new McpRuntime('draft', {
    async search() {
      return []
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note\n\n#draft' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
  })
  const draftPatch = await draftRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Draft',
    summary: 'draft',
  })
  if (!draftPatch.ok) failures.push('draft should allow proposePatch')
  const tagPatch = await draftRuntime.invoke('mcp.proposeTagPatch', {
    path: 'note.md',
    add: ['research'],
    summary: 'Add research tag',
  })
  if (!tagPatch.ok) failures.push('draft should allow proposeTagPatch')
  const approve = await draftRuntime.approveDraft((draftPatch.ok && (draftPatch.output as DraftPatch).id) || '')
  if (approve.ok) failures.push('draft should not approve writes without write-approved')

  let writeApprovedSaved = false
  const writeRuntime = new McpRuntime('write-approved', {
    async search() {
      return []
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
    async saveNote() {
      writeApprovedSaved = true
      return { metadata: { title: 'Note', content_hash: 'def' } }
    },
  })
  const writeDraft = await writeRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Approved',
    summary: 'apply after review',
    baseContentHash: 'abc',
  })
  if (!writeDraft.ok) failures.push('write-approved should allow proposePatch invoke')
  const approvedWrite = await writeRuntime.approveDraft(
    (writeDraft.ok && (writeDraft.output as DraftPatch).id) || '',
  )
  if (!approvedWrite.ok) failures.push('write-approved should approve draft')
  if (!writeApprovedSaved) failures.push('write-approved approval should call save bridge')

  return failures
}
