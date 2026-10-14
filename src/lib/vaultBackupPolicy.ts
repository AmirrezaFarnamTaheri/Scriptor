/** Single source of truth for persisted backup scheduling limits. */
export interface VaultBackupSettings {
  enabled: boolean
  intervalMinutes: number
  maxSnapshots: number
  backupPath: string
}

export const DEFAULT_VAULT_BACKUP_SETTINGS: VaultBackupSettings = {
  enabled: false,
  intervalMinutes: 60,
  maxSnapshots: 10,
  backupPath: '',
}

export const BACKUP_INTERVAL_LIMITS = { min: 5, max: 10080 } as const
export const BACKUP_RETENTION_LIMITS = { min: 1, max: 100 } as const

function boundedPositiveInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Reject malformed envelopes and normalize all fields, including values restored from storage. */
export function validateVaultBackupSettings(value: unknown): VaultBackupSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('backup settings: expected an object')
  }
  const record = value as Record<string, unknown>
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_VAULT_BACKUP_SETTINGS.enabled,
    intervalMinutes: boundedPositiveInteger(
      record.intervalMinutes, BACKUP_INTERVAL_LIMITS.min, BACKUP_INTERVAL_LIMITS.max,
      DEFAULT_VAULT_BACKUP_SETTINGS.intervalMinutes,
    ),
    maxSnapshots: boundedPositiveInteger(
      record.maxSnapshots, BACKUP_RETENTION_LIMITS.min, BACKUP_RETENTION_LIMITS.max,
      DEFAULT_VAULT_BACKUP_SETTINGS.maxSnapshots,
    ),
    backupPath: typeof record.backupPath === 'string' && record.backupPath.length <= 4096
      ? record.backupPath.trim() : DEFAULT_VAULT_BACKUP_SETTINGS.backupPath,
  }
}
