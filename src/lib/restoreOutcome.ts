/**
 * Native restore results are not interchangeable with transport errors.
 * A committed tree must never be overwritten by a pre-restore editor draft.
 * Keep the handling policy independent of component/UI lifetime.
 */
import type { VaultRestoreStatus } from '../bridge/commands/vault'

export interface VaultRestoreDisposition {
  readonly filesChanged: boolean
  readonly resumeOldDraft: boolean
  readonly refreshWorkspace: boolean
  readonly needsReopen: boolean
}

export function classifyVaultRestoreStatus(status: VaultRestoreStatus): VaultRestoreDisposition {
  switch (status) {
    case 'rolled-back':
      return { filesChanged: false, resumeOldDraft: true, refreshWorkspace: false, needsReopen: false }
    case 'committed-ready':
      return { filesChanged: true, resumeOldDraft: false, refreshWorkspace: true, needsReopen: false }
    case 'committed-needs-reopen':
    case 'recovery-required':
      return { filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true }
  }
}
