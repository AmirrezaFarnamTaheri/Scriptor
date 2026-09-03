import type { DraftPatch } from './draft.ts'
import {
  createNoteDraft,
  deleteNoteDraft,
  moveNoteDraft,
  type McpCreateNoteInput,
  type McpDeleteNoteInput,
  type McpMoveNoteInput,
} from './note-writes.ts'
import {
  assertVaultRelativePath,
  type McpProposePatchInput,
  type McpProposeTagPatchInput,
  type McpVaultContext,
} from './tool-contracts.ts'

/** Draft-producing tools handled by {@link dispatchWriteTool}. */
export const writeToolNames = [
  'mcp.proposePatch',
  'mcp.proposeTagPatch',
  'mcp.createNote',
  'mcp.moveNote',
  'mcp.deleteNote',
] as const

export interface WriteDispatchDeps {
  proposePatch: (input: McpProposePatchInput) => DraftPatch | null
  proposeTagPatch: (input: McpProposeTagPatchInput) => Promise<DraftPatch | null>
  pushDraft: (patch: DraftPatch) => void
}

export type WriteDispatchResult = { handled: true; output: unknown } | { handled: false }

function assertNonEmpty(value: unknown, toolName: string, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${toolName} requires a non-empty "${field}" string`)
  }
}


function requireVaultId(ctx: McpVaultContext): string {
  if (!ctx.vaultId) throw new Error('Draft/write MCP tools require a stable vault identity')
  return ctx.vaultId
}

/**
 * Validate and execute the draft-producing MCP tools. Returns
 * `{ handled: false }` for tool names this module does not own so the caller can
 * fall through to its own unhandled-tool error.
 */
export async function dispatchWriteTool(
  toolName: string,
  input: unknown,
  ctx: McpVaultContext,
  deps: WriteDispatchDeps,
): Promise<WriteDispatchResult> {
  switch (toolName) {
    case 'mcp.proposePatch': {
      const payload = input as McpProposePatchInput
      assertNonEmpty(payload.path, toolName, 'path')
      assertVaultRelativePath(payload.path)
      if (typeof payload.proposedMarkdown !== 'string') {
        throw new Error('mcp.proposePatch requires a "proposedMarkdown" string')
      }
      assertNonEmpty(payload.summary, toolName, 'summary')
      const patch = deps.proposePatch(payload)
      if (!patch) {
        throw new Error('Draft patches require draft or write-approved mode')
      }
      return { handled: true, output: patch }
    }
    case 'mcp.proposeTagPatch': {
      const payload = input as McpProposeTagPatchInput
      assertNonEmpty(payload.path, toolName, 'path')
      assertVaultRelativePath(payload.path)
      assertNonEmpty(payload.summary, toolName, 'summary')
      const patch = await deps.proposeTagPatch(payload)
      if (!patch) {
        throw new Error('Tag patches require draft or write-approved mode')
      }
      return { handled: true, output: patch }
    }
    case 'mcp.createNote': {
      const payload = input as McpCreateNoteInput
      assertNonEmpty(payload.path, toolName, 'path')
      assertVaultRelativePath(payload.path)
      if (typeof payload.markdown !== 'string') {
        throw new Error('mcp.createNote requires a "markdown" string')
      }
      assertNonEmpty(payload.summary, toolName, 'summary')
      const patch = createNoteDraft(payload, requireVaultId(ctx))
      deps.pushDraft(patch)
      return { handled: true, output: patch }
    }
    case 'mcp.moveNote': {
      const payload = input as McpMoveNoteInput
      assertNonEmpty(payload.from, toolName, 'from')
      assertVaultRelativePath(payload.from, 'from')
      assertNonEmpty(payload.to, toolName, 'to')
      assertVaultRelativePath(payload.to, 'to')
      assertNonEmpty(payload.summary, toolName, 'summary')
      const note = await ctx.readNote(payload.from)
      const patch = moveNoteDraft(payload, note.markdown, note.metadata.content_hash, requireVaultId(ctx))
      deps.pushDraft(patch)
      return { handled: true, output: patch }
    }
    case 'mcp.deleteNote': {
      const payload = input as McpDeleteNoteInput
      assertNonEmpty(payload.path, toolName, 'path')
      assertVaultRelativePath(payload.path)
      assertNonEmpty(payload.summary, toolName, 'summary')
      const note = await ctx.readNote(payload.path)
      const patch = deleteNoteDraft(payload, note.metadata.content_hash, requireVaultId(ctx))
      deps.pushDraft(patch)
      return { handled: true, output: patch }
    }
    default:
      return { handled: false }
  }
}
