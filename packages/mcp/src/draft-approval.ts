import type { CommandResult } from '@scriptor/core/contracts/command'

import type { DraftPatch } from './draft.ts'
import type { McpVaultContext } from './tool-contracts.ts'

type CommandFailure = Extract<CommandResult, { ok: false }>

export type DraftApprovalResult =
  | { ok: true; output: unknown }
  | { ok: false; error: CommandFailure['error'] }

/**
 * Command id recorded in the audit log when a draft is approved. Each draft
 * operation maps onto the concrete note command the bridge ends up running.
 */
export function approvedDraftCommandId(patch: DraftPatch): string {
  if (patch.operation === 'delete') return 'note.delete'
  if (patch.operation === 'move') return 'note.rename'
  return 'note.save'
}

/**
 * Run the vault-side effect for an approved draft. Returns the bridge output on
 * success, or the recoverable error to surface when the required bridge is not
 * wired up for that operation.
 */
export async function applyApprovedDraft(
  patch: DraftPatch,
  context: McpVaultContext | null,
): Promise<DraftApprovalResult> {
  switch (patch.operation) {
    case 'delete': {
      if (!context?.deleteNote) {
        return {
          ok: false,
          error: {
            code: 'mcp.delete_unavailable',
            message: 'Delete bridge is not available',
            recoverable: true,
          },
        }
      }
      return { ok: true, output: await context.deleteNote(patch.notePath) }
    }
    case 'move': {
      if (!context?.renameNote || !patch.sourcePath) {
        return {
          ok: false,
          error: {
            code: 'mcp.rename_unavailable',
            message: 'Rename bridge is not available for move drafts',
            recoverable: true,
          },
        }
      }
      return {
        ok: true,
        output: await context.renameNote(patch.sourcePath, patch.notePath, true),
      }
    }
    case 'create':
    case 'patch':
    default: {
      if (!context?.saveNote) {
        return {
          ok: false,
          error: {
            code: 'mcp.save_unavailable',
            message: 'Save bridge is not available',
            recoverable: true,
          },
        }
      }
      return {
        ok: true,
        output: await context.saveNote(patch.notePath, patch.proposedMarkdown, patch.baseContentHash),
      }
    }
  }
}
