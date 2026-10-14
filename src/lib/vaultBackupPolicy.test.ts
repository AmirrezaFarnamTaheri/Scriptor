import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  BACKUP_INTERVAL_LIMITS,
  BACKUP_RETENTION_LIMITS,
  DEFAULT_VAULT_BACKUP_SETTINGS,
  validateVaultBackupSettings,
} from './vaultBackupPolicy.ts'

test('persisted backup intervals and retention are finite, integral and bounded', () => {
  const baseline = { ...DEFAULT_VAULT_BACKUP_SETTINGS, enabled: true }
  assert.deepEqual(validateVaultBackupSettings({ ...baseline, intervalMinutes: Infinity, maxSnapshots: NaN }), {
    ...baseline, intervalMinutes: 60, maxSnapshots: 10,
  })
  assert.equal(validateVaultBackupSettings({ ...baseline, intervalMinutes: 0.01 }).intervalMinutes, 5)
  assert.equal(validateVaultBackupSettings({ ...baseline, intervalMinutes: 1e100 }).intervalMinutes, BACKUP_INTERVAL_LIMITS.max)
  assert.equal(validateVaultBackupSettings({ ...baseline, maxSnapshots: 1e100 }).maxSnapshots, BACKUP_RETENTION_LIMITS.max)
  assert.equal(validateVaultBackupSettings({ ...baseline, intervalMinutes: 10.9, maxSnapshots: 2.8 }).intervalMinutes, 10)
  assert.equal(validateVaultBackupSettings({ ...baseline, maxSnapshots: 2.8 }).maxSnapshots, 2)
})

test('malformed backup settings use safe defaults without retaining attacker-supplied paths', () => {
  assert.throws(() => validateVaultBackupSettings(null))
  assert.throws(() => validateVaultBackupSettings([]))
  assert.equal(validateVaultBackupSettings({ backupPath: 'a'.repeat(5000) }).backupPath, '')
  assert.equal(validateVaultBackupSettings({ backupPath: '  /backup/location  ' }).backupPath, '/backup/location')
  assert.equal(validateVaultBackupSettings({ intervalMinutes: -1, maxSnapshots: -3 }).intervalMinutes, 60)
  assert.equal(validateVaultBackupSettings({ intervalMinutes: -1, maxSnapshots: -3 }).maxSnapshots, 10)
})
