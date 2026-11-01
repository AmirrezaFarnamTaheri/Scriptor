import type { OperationReceipt } from './operationReceipt.ts'
import { outcomeFromRestoreReceipt } from './operationOutcomeFromRestore.ts'

/** A read-only view over existing native/renderer owners, never a restore broker. */
export type RecoverySource = 'backups' | 'note-history' | 'last-restore' | 'canvas' | 'external-conflicts'
export type RecoveryStatus = 'available' | 'empty' | 'loading' | 'unverified' | 'unavailable' | 'blocked' | 'needs-reopen'
interface ScopedEvidence { readonly vaultId: string; readonly state: 'ready' | 'loading' | 'error'; readonly count: number }
interface BackupEvidence extends ScopedEvidence {
  readonly backupPath: string
  readonly verifiedCount: number
}
export interface RecoveryInventoryInput {
  readonly vaultId: string | null
  readonly backupPath: string
  readonly recoveryRequired: boolean
  readonly backups?: BackupEvidence
  readonly lastRestoreReceipt?: OperationReceipt | null
  readonly selectedNote: string | null
  readonly settingsDirty: boolean
  readonly canvas?: ScopedEvidence
  readonly externalConflicts?: ScopedEvidence
}
export interface RecoveryEntry {
  readonly source: RecoverySource
  readonly status: RecoveryStatus
  readonly count: number | null
  readonly explanation: string
  readonly route: 'backup-settings' | 'note-history' | null
  readonly readOnly: true
}
function sourceEntry(source: RecoverySource, vaultId: string, evidence: ScopedEvidence | undefined): RecoveryEntry {
  if (!evidence || evidence.vaultId !== vaultId) return {
    source, status: 'unverified', count: null, route: null, readOnly: true,
    explanation: 'No current-vault inspection evidence is available for this recovery source.',
  }
  if (evidence.state === 'loading') return {
    source, status: 'loading', count: null, route: null, readOnly: true,
    explanation: 'Checking this recovery source.',
  }
  if (evidence.state === 'error' || !Number.isSafeInteger(evidence.count) || evidence.count < 0) return {
    source, status: 'unavailable', count: null, route: null, readOnly: true,
    explanation: 'Could not inspect this recovery source.',
  }
  return {
    source, status: evidence.count > 0 ? 'available' : 'empty', count: evidence.count,
    route: null, readOnly: true, explanation: `${evidence.count} items reported by the current-vault source.`,
  }
}
export function buildRecoveryInventory(input: RecoveryInventoryInput): readonly RecoveryEntry[] {
  const id = input.vaultId
  if (!id) return []
  const backup = input.backups?.vaultId === id && input.backups.backupPath === input.backupPath
    ? input.backups : undefined
  const entry = sourceEntry('backups', id, backup)
  const verified = backup && Number.isSafeInteger(backup.verifiedCount) && backup.verifiedCount >= 0 &&
    backup.verifiedCount <= backup.count ? backup.verifiedCount : 0
  const backups: RecoveryEntry = {
    ...entry,
    status: !backup ? 'loading' : entry.status === 'available' && verified === 0 ? 'unverified'
      : input.recoveryRequired && entry.status === 'available' ? 'needs-reopen' : entry.status,
    count: entry.count,
    route: !input.recoveryRequired && entry.status === 'available' && verified > 0 ? 'backup-settings' : null,
    explanation: !backup ? 'Loading backup inventory for this vault and destination.'
      : entry.status === 'available' ? `${verified} of ${backup.count} backups verified for review. ${input.recoveryRequired ? 'Reopen the vault before further writes.' : 'Restore still requires separate approval.'}`
        : entry.explanation,
  }
  const historyAllowed = !!input.selectedNote?.trim() && !input.settingsDirty && !input.recoveryRequired
  const history: RecoveryEntry = {
    source: 'note-history', status: input.recoveryRequired ? 'needs-reopen'
      : input.settingsDirty ? 'blocked' : 'unverified', count: null, readOnly: true,
    route: historyAllowed ? 'note-history' : null,
    explanation: input.recoveryRequired ? 'Restart and reopen the vault before reviewing note history.'
      : input.settingsDirty ? 'Save or discard Settings changes first.'
      : input.selectedNote?.trim() ? 'Open the existing Note History panel to inspect revisions; no count has been verified.'
        : 'Select a note to inspect its saved revisions.',
  }
  const entries: RecoveryEntry[] = [backups, history]
  const receipt = input.lastRestoreReceipt
  if (receipt && receipt.vaultId === id && receipt.backupPath === input.backupPath) {
    const outcome = outcomeFromRestoreReceipt(receipt)
    entries.push({
      source: 'last-restore',
      status: outcome.recovery === 'reopen-vault' ? 'needs-reopen' : 'available',
      count: null, route: null, readOnly: true,
      explanation: `Last observed restore: ${outcome.commit}; ${outcome.retry}. The native journal has not been re-read.`,
    })
  }
  entries.push(sourceEntry('canvas', id, input.canvas))
  entries.push(sourceEntry('external-conflicts', id, input.externalConflicts))
  return entries
}
