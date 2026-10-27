import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyVaultRestoreStatus, classifyVaultRestoreFailure, runVaultRestoreWithOutcomeBoundary, VaultRestoreOutcomeUnknownError, validateVaultRestoreResult, isVaultRestoreQuarantined } from './restoreOutcome.ts'

test('rolled-back restore is the only outcome that can resume the old draft', () => {
  assert.deepEqual(classifyVaultRestoreStatus('rolled-back'), {
    filesChanged: false, resumeOldDraft: true, refreshWorkspace: false, needsReopen: false,
  })
})

test('a committed restore never resumes the old draft, even when reopen fails', () => {
  assert.deepEqual(classifyVaultRestoreStatus('committed-ready'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: true, needsReopen: false,
  })
  assert.deepEqual(classifyVaultRestoreStatus('committed-needs-reopen'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true,
  })
})

test('an unfinished recovery retains frozen persistence and requires reopen', () => {
  assert.deepEqual(classifyVaultRestoreStatus('recovery-required'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true,
  })
})

test('a failed authorization occurs before submission and may safely resume the draft', async () => {
  const denied = new Error('permission denied')
  let submissions = 0
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => { throw denied }, async () => { submissions += 1 }),
    (error: unknown) => error === denied,
  )
  assert.equal(submissions, 0)
  assert.equal(classifyVaultRestoreFailure(denied, false), 'safe-to-resume')
})

test('a lost reply after native submission is indeterminate and is not retried', async () => {
  const lost = new Error('native bridge disconnected')
  let submissions = 0
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => 'token', async () => {
      submissions += 1
      throw lost
    }),
    (error: unknown) => {
      assert.ok(error instanceof VaultRestoreOutcomeUnknownError)
      assert.equal(error.cause, lost)
      assert.equal(classifyVaultRestoreFailure(error, false), 'freeze-and-reopen')
      return true
    },
  )
  assert.equal(submissions, 1)
})

test('a synchronous invoke failure is also indeterminate', async () => {
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => 'token', () => { throw new Error('invoke unavailable') }),
    VaultRestoreOutcomeUnknownError,
  )
})

test('an authoritative native reply passes through; a later UI failure is not rollback', async () => {
  const result = { status: 'committed-ready', message: 'restored' }
  assert.equal(await runVaultRestoreWithOutcomeBoundary(async () => 'token', async () => result), result)
  assert.equal(classifyVaultRestoreFailure(new Error('refresh failed'), true), 'committed-needs-reconciliation')
})


test('an unknown native restore status never unfreezes editor persistence', () => {
  assert.throws(
    () => classifyVaultRestoreStatus('future-unknown-status' as never),
    VaultRestoreOutcomeUnknownError,
  )
})

test('an invalid or incomplete native reply stays indeterminate after submission', async () => {
  for (const reply of [null, {}, { status: 'rolled-back' }, { status: 'unexpected', message: 'bad' }, { status: 'committed-ready', message: 42 }]) {
    await assert.rejects(
      runVaultRestoreWithOutcomeBoundary(async () => 'approved', async () => validateVaultRestoreResult(reply)),
      VaultRestoreOutcomeUnknownError,
    )
  }
})

test('valid native reply is unchanged after runtime validation', () => {
  const result = { status: 'committed-ready', message: 'done' }
  assert.equal(validateVaultRestoreResult(result), result)
})

test('unconfirmed restore quarantine blocks only the originating vault until restart', () => {
  assert.equal(isVaultRestoreQuarantined('vault-A', 'vault-A'), true)
  assert.equal(isVaultRestoreQuarantined('vault-A', 'vault-B'), false)
  assert.equal(isVaultRestoreQuarantined('vault-A', null), false)
  assert.equal(isVaultRestoreQuarantined(null, 'vault-A'), false)
})
