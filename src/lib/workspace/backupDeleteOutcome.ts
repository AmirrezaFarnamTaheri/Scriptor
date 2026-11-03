import { buildOperationOutcome, type MutationScope, type ObservedMutation } from './operationOutcome.ts'

/** Identifies one native backup deletion; the renderer never authorizes the operation. */
export interface BackupDeleteScope {
  readonly operationId: string
  readonly vaultId: string
  readonly backupPath: string
  readonly backupName: string
}

/** A retry hold is scoped to the exact backup owner, not a name across vaults. */
export function backupDeleteKey(scope: Pick<BackupDeleteScope, 'vaultId' | 'backupPath' | 'backupName'>): string {
  if (typeof scope.vaultId !== 'string' || !scope.vaultId.trim()
    || typeof scope.backupPath !== 'string'
    || typeof scope.backupName !== 'string' || !scope.backupName.trim()) {
    throw new Error('Invalid backup deletion origin')
  }
  return JSON.stringify([scope.vaultId, scope.backupPath, scope.backupName])
}

export function isBackupDeleteHeld(
  keys: Iterable<string>,
  scope: Pick<BackupDeleteScope, 'vaultId' | 'backupPath' | 'backupName'>,
): boolean {
  const expected = backupDeleteKey(scope)
  for (const key of keys) if (key === expected) return true
  return false
}

/** Prevent automatic retention from pruning while an earlier deletion in
 * this exact vault/destination has an indeterminate native result.
 * JSON array framing avoids collision between embedded path/name characters.
 */
export function hasUnconfirmedBackupDeleteInDestination(
  keys: Iterable<string>,
  scope: Pick<BackupDeleteScope, 'vaultId' | 'backupPath'>,
): boolean {
  if (!scope.vaultId.trim() || typeof scope.backupPath !== 'string') {
    throw new Error('Invalid backup deletion origin')
  }
  const prefix = `${JSON.stringify([scope.vaultId, scope.backupPath]).slice(0, -1)},`
  for (const key of keys) {
    if (key.startsWith(prefix)) return true
  }
  return false
}

/**
 * Observe the existing native deletion authority. The callback is invoked by
 * the bridge immediately after authorization, immediately before native invoke.
 * Missing replies AFTER that point are indeterminate, not known rollbacks.
 */
export async function observeBackupDelete(
  scope: BackupDeleteScope,
  submitWithNativeBoundary: (markSubmitted: () => void) => Promise<void>,
): Promise<ObservedMutation<void>> {
  const origin = backupDeleteKey(scope)
  const [vaultId, backupPath, backupName] = JSON.parse(origin) as [string, string, string]
  const mutation: MutationScope = {
    operationId: scope.operationId,
    vaultId,
    operation: 'delete-backup',
    target: JSON.stringify([backupPath, backupName]),
  }
  // Validate before awaiting any caller-controlled work, then preserve origin.
  buildOperationOutcome(mutation, { kind: 'not-submitted' })
  let submitted = false
  try {
    await submitWithNativeBoundary(() => { submitted = true })
  } catch (error) {
    return {
      outcome: buildOperationOutcome(mutation, submitted ? { kind: 'reply-missing' } : { kind: 'not-submitted' }),
      error,
    }
  }
  return { outcome: buildOperationOutcome(mutation, { kind: 'committed' }) }
}
