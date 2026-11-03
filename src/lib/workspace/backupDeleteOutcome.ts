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


/** Conservative Windows path identity for same-session retry holds only.
 * This is not filesystem canonicalization and does not grant native authority.
 * It covers common drive/UNC case, separator, dot and Unicode aliases while
 * leaving POSIX case-sensitive paths distinct.
 */
function windowsBackupIdentity(path: string): string | null {
  const slashes = path.normalize('NFC').replace(/\\/g, '/')
  let root: string
  let tail: string
  if (/^[A-Za-z]:\//.test(slashes)) {
    root = slashes.slice(0, 2).toLowerCase()
    tail = slashes.slice(3)
  } else {
    const unc = /^\/\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(slashes)
    if (!unc) return null
    root = `//${unc[1].toLowerCase()}/${unc[2].toLowerCase()}`
    tail = unc[3] ?? ''
  }
  const segments: string[] = []
  for (const part of tail.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') segments.pop()
    else segments.push(part.toLowerCase())
  }
  return `${root}/${segments.join('/')}`
}

function sameBackupDestination(left: string, right: string): boolean {
  if (left === right) return true
  const portable = windowsBackupIdentity(left)
  return portable !== null && portable === windowsBackupIdentity(right)
}

function decodeBackupDeleteKey(key: string): [string, string, string] | null {
  try {
    const value: unknown = JSON.parse(key)
    return Array.isArray(value) && value.length === 3
      && value.every(part => typeof part === 'string')
      ? value as [string, string, string] : null
  } catch {
    return null
  }
}

export function isBackupDeleteHeld(
  keys: Iterable<string>,
  scope: Pick<BackupDeleteScope, 'vaultId' | 'backupPath' | 'backupName'>,
): boolean {
  const expected = backupDeleteKey(scope)
  for (const key of keys) {
    if (key === expected) return true
    const prior = decodeBackupDeleteKey(key)
    if (!prior || prior[0] !== scope.vaultId || !sameBackupDestination(prior[1], scope.backupPath)) continue
    // Windows backup names are case-insensitive as well. Never merge names
    // across two distinct POSIX directories or different vault identities.
    if (prior[2] === scope.backupName || (
      windowsBackupIdentity(prior[1]) !== null
      && prior[2].normalize('NFC').toLowerCase() === scope.backupName.normalize('NFC').toLowerCase()
    )) return true
  }
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
    const prior = decodeBackupDeleteKey(key)
    if (prior && prior[0] === scope.vaultId && sameBackupDestination(prior[1], scope.backupPath)) {
      return true
    }
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
