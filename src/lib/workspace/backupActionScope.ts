/** A pending destructive action must never transfer across vaults or backup locations. */
export interface BackupActionScope {
  readonly vaultId: string | null
  readonly backupPath: string
}

export interface PendingBackupAction {
  readonly name: string
  readonly action: 'restore' | 'delete'
  readonly vaultId: string
  readonly backupPath: string
}

/** Capture the scope shown when the user first requests confirmation. */
export function createPendingBackupAction(
  scope: BackupActionScope,
  name: string,
  action: PendingBackupAction['action'],
): PendingBackupAction | null {
  if (!scope.vaultId || !name.trim()) return null
  return { name, action, vaultId: scope.vaultId, backupPath: scope.backupPath }
}

/** A matching name alone is insufficient to authorize Restore or Delete. */
export function matchesBackupActionScope(
  pending: PendingBackupAction | null,
  current: BackupActionScope,
  name: string,
): boolean {
  return Boolean(
    pending && current.vaultId && pending.vaultId === current.vaultId &&
    pending.backupPath === current.backupPath && pending.name === name,
  )
}
