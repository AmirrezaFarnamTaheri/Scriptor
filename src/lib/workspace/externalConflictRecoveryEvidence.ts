import type { ExternalChangeConflict } from '../../types/vault'

/** A read-only signal about the selected editor note, not a vault-wide scan. */
export interface ExternalConflictRecoveryEvidence {
  readonly vaultId: string
  readonly state: 'ready'
  readonly count: 1
}

/**
 * The existing editor owns native on-disk mismatch detection. Show only the
 * mismatch for the current vault-owned note, never an authoritative zero for
 * notes the editor has not inspected. This does not grant overwrite authority.
 */
export function inspectActiveExternalConflict(
  vaultId: string | null,
  activePath: string | null,
  activeNoteVaultId: string | null,
  conflict: ExternalChangeConflict | null,
): ExternalConflictRecoveryEvidence | undefined {
  if (!vaultId?.trim() || vaultId !== activeNoteVaultId ||
      !activePath?.trim() || !conflict || activePath !== conflict.path ||
      typeof conflict.loaded_hash !== 'string' || !conflict.loaded_hash.trim() ||
      typeof conflict.disk_hash !== 'string' || !conflict.disk_hash.trim() ||
      conflict.disk_hash === 'unknown' || conflict.disk_hash === conflict.loaded_hash) return undefined
  return { vaultId, state: 'ready', count: 1 }
}
