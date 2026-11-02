import type { OperationReceipt } from './operationReceipt.ts'
import { outcomeFromRestoreReceipt } from './operationOutcomeFromRestore.ts'

/** A read-only view over existing native/renderer owners, never a restore broker. */
export type RecoverySource = 'backups' | 'note-history' | 'last-restore' | 'canvas' | 'git-conflicts' | 'external-conflicts'
export type RecoveryStatus = 'available' | 'empty' | 'loading' | 'unverified' | 'unavailable' | 'blocked' | 'needs-reopen'
interface ScopedEvidence { readonly vaultId: string; readonly state: 'ready' | 'loading' | 'error' | 'unverified'; readonly count: number }
interface BackupEvidence extends ScopedEvidence {
  readonly backupPath: string
  readonly verifiedCount: number
}
interface HistoryEvidence extends ScopedEvidence {
  readonly notePath: string
}
export interface RecoveryInventoryInput {
  readonly vaultId: string | null
  readonly backupPath: string
  readonly recoveryRequired: boolean
  readonly backups?: BackupEvidence
  readonly lastRestoreReceipt?: OperationReceipt | null
  readonly selectedNote: string | null
  readonly history?: HistoryEvidence
  readonly settingsDirty: boolean
  readonly canvas?: ScopedEvidence
  readonly gitConflicts?: ScopedEvidence
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
  if (evidence.state === 'unverified') return {
    source, status: 'unverified', count: null, route: null, readOnly: true,
    explanation: 'This source has not confirmed a current-vault inventory. No absence of conflicts can be inferred.',
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
  const historyEvidence = input.history?.vaultId === id && input.history.notePath === input.selectedNote
    ? input.history : undefined
  const inspectedHistory = sourceEntry('note-history', id, historyEvidence)
  const history: RecoveryEntry = {
    ...inspectedHistory,
    status: input.recoveryRequired ? 'needs-reopen' : input.settingsDirty || !input.selectedNote?.trim()
      ? 'blocked' : inspectedHistory.status,
    count: historyAllowed ? inspectedHistory.count : null,
    route: historyAllowed ? 'note-history' : null,
    explanation: input.recoveryRequired ? 'Restart and reopen the vault before reviewing note history.'
      : input.settingsDirty ? 'Save or discard Settings changes first.'
      : !historyAllowed ? 'Select a note to inspect its saved revisions.'
      : historyEvidence ? inspectedHistory.explanation
        : 'Open the existing Note History panel to inspect revisions; no count has been verified.',
  }
  const entries: RecoveryEntry[] = [backups, history]
  const receipt = input.lastRestoreReceipt
  if (receipt && receipt.vaultId === id && receipt.backupPath === input.backupPath) {
    try {
      const outcome = outcomeFromRestoreReceipt(receipt)
      entries.push({
        source: 'last-restore',
        status: outcome.recovery === 'reopen-vault' ? 'needs-reopen' : 'available',
        count: null, route: null, readOnly: true,
        explanation: `Last observed restore: ${outcome.commit}; ${outcome.retry}. The native journal has not been re-read.`,
      })
    } catch {
      // This renderer-observed envelope is not native recovery proof. A
      // corrupted current-vault receipt must not crash the inventory or be
      // mistaken for a confirmed rollback/safe retry.
      entries.push({
        source: 'last-restore', status: 'needs-reopen',
        count: null, route: null, readOnly: true,
        explanation: 'Last restore receipt is invalid or unverified. Native effects may have committed. Restart and reopen the originating vault to reconcile before retrying; no rollback has been established.',
      })
    }
  }
  entries.push(sourceEntry('canvas', id, input.canvas))
  const git = sourceEntry('git-conflicts', id, input.gitConflicts)
  entries.push({
    ...git,
    explanation: git.status === 'available' || git.status === 'empty'
      ? `Native Git inspection reports ${git.count} Git-tracked conflicted paths. Non-Git external changes are not covered. No resolution has been authorized.`
      : git.explanation,
  })
  const external = sourceEntry('external-conflicts', id, input.externalConflicts)
  entries.push({
    ...external,
    explanation: external.status === 'available'
      ? 'The selected note has an external on-disk conflict detected by the editor. This is not a vault-wide scan; review the existing editor warning before writing.'
      : external.explanation,
  })
  return entries
}
