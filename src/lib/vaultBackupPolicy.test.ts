import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  BACKUP_INTERVAL_LIMITS,
  BACKUP_RETENTION_LIMITS,
  DEFAULT_VAULT_BACKUP_SETTINGS,
  validateVaultBackupSettings,
  backupRetentionCandidates,
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

test('retention never deletes another vault backups from a shared DR destination', () => {
  const own = [
    'vault-backup-a1b2c3d4e5f6-20261014-190005-47',
    'vault-backup-a1b2c3d4e5f6-20261014-190004-47',
    'vault-backup-a1b2c3d4e5f6-20261014-190003-47',
  ]
  const foreign = [
    'vault-backup-b1b2c3d4e5f6-20261010-100000-24',
    'vault-backup-b1b2c3d4e5f6-20261011-100000-24',
  ]
  const entries = [...foreign, ...own].map(name => ({ name }))
  const outdated = backupRetentionCandidates(entries, own[0], 2)
  assert.deepEqual(outdated.map(entry => entry.name), [own[2]])
  assert.equal(outdated.some(entry => foreign.includes(entry.name)), false)
  assert.deepEqual(backupRetentionCandidates(entries, own[0], 99), [])
  assert.deepEqual(backupRetentionCandidates(entries, 'unexpected-native-name', 1), [])
  assert.deepEqual(backupRetentionCandidates(entries, own[0], 0), [])
})
