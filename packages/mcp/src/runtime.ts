import type { CommandResult } from '@scriptor/core/contracts/command'
import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { McpMode, McpToolDescriptor } from '@scriptor/core/contracts/mcp'

import { AuditLog } from './audit.ts'
import { approveDraftPatch, createDraftPatch, type DraftPatch, rejectDraftPatch } from './draft.ts'
import { extractOutline } from './outline.ts'
import { modeAllowsTool } from './permissions.ts'
import { applyApprovedDraft, approvedDraftCommandId } from './draft-approval.ts'
import { applyTagPatch } from './tag-patch.ts'
import { dispatchWriteTool } from './write-dispatch.ts'
import {
  allMcpTools,
  assertBoundedInt,
  assertVaultRelativePath,
  type McpBacklinksInput,
  type McpExportGraphInput,
  type McpGetGraphNeighborsInput,
  type McpListTagsInput,
  type McpListTasksFilter,
  type McpOutlineInput,
  type McpProposePatchInput,
  type McpProposeTagPatchInput,
  type McpReadNoteInput,
  type McpRenderMarkdownInput,
  type McpResolveCitationInput,
  type McpSearchByTagInput,
  type McpSearchInput,
  type McpTraverseGraphInput,
  type McpVaultContext,
} from './tool-contracts.ts'

export * from './tool-contracts.ts'

const MAX_DRAFTS = 100

export class McpRuntime {
  private readonly audit = new AuditLog()
  private readonly drafts: DraftPatch[] = []
  private mode: McpMode
  private context: McpVaultContext | null

  constructor(mode: McpMode, context: McpVaultContext | null) {
    this.mode = mode
    this.context = context
  }

  setMode(mode: McpMode): void {
    this.mode = mode
  }

  /**
   * Swap the vault bindings in place. Callers must mutate rather than
   * reconstruct the runtime: a fresh instance would drop every pending draft
   * and the whole security audit log.
   */
  setContext(context: McpVaultContext | null): void {
    this.context = context
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

  private pushDraft(patch: DraftPatch): void {
    this.drafts.unshift(patch)
    while (this.drafts.length > MAX_DRAFTS) {
      // Newest drafts sit at the front, so evict from the back: prefer the
      // oldest resolved (non-pending) draft, falling back to the oldest overall.
      let evictIndex = -1
      for (let index = this.drafts.length - 1; index >= 0; index -= 1) {
        if (this.drafts[index].status !== 'pending') {
          evictIndex = index
          break
        }
      }
      this.drafts.splice(evictIndex >= 0 ? evictIndex : this.drafts.length - 1, 1)
    }
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
    this.pushDraft(patch)
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
    this.pushDraft(patch)
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
    const applied = await applyApprovedDraft(patch, this.context)
    if (!applied.ok) {
      return { ok: false, requestId, error: applied.error }
    }

    this.drafts[index] = approveDraftPatch(patch)
    this.audit.append({
      toolName: 'mcp.proposePatch',
      mode: this.mode,
      commandId: approvedDraftCommandId(patch),
      outcome: 'allowed',
      approvedAt: new Date().toISOString(),
    })
    return { ok: true, requestId, output: applied.output }
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
        if (typeof payload.query !== 'string' || !payload.query.trim()) {
          throw new Error('mcp.search requires a non-empty "query" string')
        }
        return ctx.search(payload.query, assertBoundedInt(payload.limit ?? 25, 1, 500, 'limit'))
      }
      case 'mcp.readNote': {
        const payload = input as McpReadNoteInput
        if (typeof payload.path !== 'string' || !payload.path.trim()) {
          throw new Error('mcp.readNote requires a non-empty "path" string')
        }
        assertVaultRelativePath(payload.path)
        return ctx.readNote(payload.path)
      }
      case 'mcp.inspectBacklinks': {
        const payload = input as McpBacklinksInput
        if (typeof payload.path !== 'string' || !payload.path.trim()) {
          throw new Error('mcp.inspectBacklinks requires a non-empty "path" string')
        }
        assertVaultRelativePath(payload.path)
        return ctx.backlinks(payload.path)
      }
      case 'mcp.inspectBrokenLinks':
        return ctx.brokenLinks()
      case 'mcp.inspectExportProfiles':
        return ctx.exportProfiles?.() ?? ([] as ExportProfile[])
      case 'mcp.inspectOutline': {
        const payload = input as McpOutlineInput
        if (typeof payload.path !== 'string' || !payload.path.trim()) {
          throw new Error('mcp.inspectOutline requires a non-empty "path" string')
        }
        assertVaultRelativePath(payload.path)
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
        if (payload.limit !== undefined) {
          tags = tags.slice(0, assertBoundedInt(payload.limit, 1, 500, 'limit'))
        }
        return tags
      }
      case 'mcp.searchByTag': {
        const payload = input as McpSearchByTagInput
        if (typeof payload.tag !== 'string' || !payload.tag.trim()) {
          throw new Error('mcp.searchByTag requires a non-empty "tag" string')
        }
        if (!ctx.notesForTag) {
          throw new Error('Tag search is not available')
        }
        return ctx.notesForTag(
          payload.tag.replace(/^#/, ''),
          payload.limit === undefined ? undefined : assertBoundedInt(payload.limit, 1, 500, 'limit'),
        )
      }
      case 'mcp.exportGraph': {
        const payload = input as McpExportGraphInput
        if (!ctx.exportGraph) {
          throw new Error('Graph export is not available')
        }
        if (typeof payload.focusPath === 'string') {
          assertVaultRelativePath(payload.focusPath, 'focusPath')
        }
        return ctx.exportGraph(payload.focusPath, assertBoundedInt(payload.depth ?? 1, 1, 5, 'depth'))
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
        if (typeof payload.focusPath !== 'string' || !payload.focusPath.trim()) {
          throw new Error('mcp.traverseGraph requires a non-empty "focusPath" string')
        }
        if (!ctx.traverseGraph) {
          throw new Error('Graph traversal is not available')
        }
        assertVaultRelativePath(payload.focusPath, 'focusPath')
        return ctx.traverseGraph(payload.focusPath, assertBoundedInt(payload.depth ?? 2, 1, 5, 'depth'))
      }
      case 'mcp.renderMarkdown': {
        const payload = input as McpRenderMarkdownInput
        if (typeof payload.markdown !== 'string') {
          throw new Error('mcp.renderMarkdown requires a "markdown" string')
        }
        if (!ctx.renderMarkdown) {
          throw new Error('Markdown rendering is not available')
        }
        return ctx.renderMarkdown(payload.markdown, payload.theme)
      }
      case 'mcp.proposePatch':
      case 'mcp.proposeTagPatch':
      case 'mcp.createNote':
      case 'mcp.moveNote':
      case 'mcp.deleteNote': {
        const result = await dispatchWriteTool(toolName, input, ctx, {
          proposePatch: (payload) => this.proposePatch(payload),
          proposeTagPatch: (payload) => this.proposeTagPatch(payload),
          pushDraft: (patch) => this.pushDraft(patch),
        })
        if (!result.handled) {
          throw new Error(`Unhandled tool: ${toolName}`)
        }
        return result.output
      }
      // ------------------------------------------------------------------
      // Feature 8.4 — mcp.getGraphNeighbors
      // ------------------------------------------------------------------
      case 'mcp.getGraphNeighbors': {
        const payload = input as McpGetGraphNeighborsInput
        if (typeof payload.path !== 'string' || !payload.path.trim()) {
          throw new Error('mcp.getGraphNeighbors requires a non-empty "path" string')
        }
        assertVaultRelativePath(payload.path)
        if (!ctx.getGraphNeighbors) {
          // Fallback: use exportGraph focused on the note
          if (!ctx.exportGraph) throw new Error('Graph neighbours not available')
          return ctx.exportGraph(payload.path, assertBoundedInt(payload.depth ?? 1, 1, 3, 'depth'))
        }
        return ctx.getGraphNeighbors(payload.path, assertBoundedInt(payload.depth ?? 1, 1, 3, 'depth'))
      }
      // ------------------------------------------------------------------
      // Feature 8.5 — mcp.resolveCitation
      // ------------------------------------------------------------------
      case 'mcp.resolveCitation': {
        const payload = input as McpResolveCitationInput
        if (typeof payload.key !== 'string' || !payload.key.trim()) {
          throw new Error('mcp.resolveCitation requires a non-empty "key" string')
        }
        if (!ctx.resolveCitation) {
          throw new Error('Citation resolution is not available')
        }
        const entry = await ctx.resolveCitation(payload.key)
        if (!entry) {
          throw new Error(`Citation key not found: ${payload.key}`)
        }
        return entry
      }
      // ------------------------------------------------------------------
      // Feature 8.6 — mcp.listTasks
      // ------------------------------------------------------------------
      case 'mcp.listTasks': {
        const payload = input as McpListTasksFilter
        if (!ctx.listTasks) {
          throw new Error('Task listing is not available')
        }
        if (typeof payload?.path === 'string') {
          assertVaultRelativePath(payload.path)
        }
        const limit = payload?.limit !== undefined
          ? assertBoundedInt(payload.limit, 1, 500, 'limit')
          : undefined
        return ctx.listTasks({ ...payload, limit })
      }
      // ------------------------------------------------------------------
      // Feature 8.7 — mcp.semanticSearch
      // ------------------------------------------------------------------
      case 'mcp.semanticSearch': {
        const payload = input as McpSearchInput
        if (typeof payload.query !== 'string' || !payload.query.trim()) {
          throw new Error('mcp.semanticSearch requires a non-empty "query" string')
        }
        const limit = assertBoundedInt(payload.limit ?? 25, 1, 200, 'limit')
        if (ctx.semanticSearch) {
          return ctx.semanticSearch(payload.query, limit)
        }
        // Graceful fallback to keyword search
        return ctx.search(payload.query, limit)
      }
      // ------------------------------------------------------------------
      // Feature 8.8 — mcp.vaultHealth
      // ------------------------------------------------------------------
      case 'mcp.vaultHealth': {
        if (ctx.vaultHealth) {
          return ctx.vaultHealth()
        }
        // Compose from available primitives
        const [broken, orphans, _deadEnds, unresolved] = await Promise.all([
          ctx.brokenLinks(),
          ctx.listOrphans?.() ?? [],
          ctx.listDeadEnds?.() ?? [],
          ctx.listUnresolvedTargets?.() ?? [],
        ])
        return {
          broken_links: broken.length,
          orphan_assets: orphans.length,
          duplicate_titles: 0,
          invalid_frontmatter: 0,
          unresolved_citations: unresolved.length,
          indexed_notes: 0,
          total_words: 0,
          cache_status: 'unknown',
        }
      }
      default:
        throw new Error(`Unhandled tool: ${toolName}`)
    }
  }
}
