import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { OperationGuard } from './operation-guard.ts'

describe('OperationGuard', () => {
  it('makes earlier operations stale when newer work supersedes them', () => {
    const guard = new OperationGuard()
    const first = guard.issue()
    const second = guard.issue()

    assert.equal(guard.isCurrent(first), false)
    assert.equal(guard.isCurrent(second), true)
  })

  it('makes all pending operations stale when the resource lifecycle changes', () => {
    const guard = new OperationGuard()
    const pending = guard.issue()
    guard.invalidate()

    assert.equal(guard.isCurrent(pending), false)
    assert.equal(guard.isCurrent(guard.issue()), true)
  })

  it('keeps a lifecycle snapshot current until it is invalidated', () => {
    const guard = new OperationGuard()
    const lifecycle = guard.snapshot()

    assert.equal(guard.isCurrent(lifecycle), true)
    guard.invalidate()
    assert.equal(guard.isCurrent(lifecycle), false)
  })
})
