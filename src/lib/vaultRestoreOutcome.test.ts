import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyVaultRestoreFailure, runVaultRestoreWithOutcomeBoundary, VaultRestoreOutcomeUnknownError } from './vaultRestoreOutcome.ts'

test('returns the native terminal result without guessing its commit status', async () => {
  for (const status of ['rolled-back', 'committed-ready', 'committed-needs-reopen', 'recovery-required']) {
    const result = { status, message: `${status}: native details` }
    const returned = await runVaultRestoreWithOutcomeBoundary(async () => 'approved', async (authorization) => {
      assert.equal(authorization, 'approved')
      return result
    })
    assert.equal(returned, result)
  }
})

test('an authorization failure is known to precede native submission', async () => {
  const denied = new Error('Permission denied')
  let invocations = 0
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => { throw denied }, async () => { invocations += 1 }),
    (error) => error === denied,
  )
  assert.equal(invocations, 0)
})

test('a rejected native invocation is indeterminate, not proof of rollback', async () => {
  const transportError = new Error('Connection lost after submit')
  let submissions = 0
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => 'approved', async () => {
      submissions += 1
      throw transportError
    }),
    (error: unknown) => {
      assert.ok(error instanceof VaultRestoreOutcomeUnknownError)
      assert.equal(error.cause, transportError)
      assert.match(error.message, /not confirmed/i)
      return true
    },
  )
  assert.equal(submissions, 1, 'no automatic retries of a potentially committed restore')
})

test('a synchronous invocation rejection is also indeterminate', async () => {
  await assert.rejects(
    runVaultRestoreWithOutcomeBoundary(async () => 'approved', () => { throw new Error('Invoke unavailable') }),
    VaultRestoreOutcomeUnknownError,
  )
})

test('a failed native restore reply never resumes persistence over uncertain files', () => {
  const unknown = new VaultRestoreOutcomeUnknownError(new Error('lost reply'))
  assert.equal(classifyVaultRestoreFailure(unknown, false), 'freeze-and-reopen')
  assert.equal(classifyVaultRestoreFailure(new Error('after committed restore'), true), 'committed-needs-reconciliation')
  assert.equal(classifyVaultRestoreFailure(new Error('authorization denied'), false), 'safe-to-resume')
})
