import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { GitStatus } from '../types/vault'
import {
  GIT_STATUS_MAX_VAULT_SLOTS,
  WorkspaceGitStatusController,
  vaultStatusKey,
} from './workspace-git-status.ts'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function statusFor(branch: string): GitStatus {
  return {
    is_repo: true,
    branch,
    changed_files: [],
    clean: true,
    ahead: 0,
    behind: 0,
    has_upstream: false,
    has_conflicts: false,
    conflicted_files: [],
  }
}

describe('workspace git status slots', () => {
  it('keeps a refresh that resolves after the active vault moved on', async () => {
    // Regression guard: the vault-open flow issues the status fetch before the
    // vault state commit lands. The response must be stored under the opened
    // vault instead of being discarded as stale.
    const gate = deferred<GitStatus>()
    const controller = new WorkspaceGitStatusController(() => gate.promise)

    controller.setActiveVault(null)
    const openFlowRefresh = controller.refresh('vault-b')
    controller.setActiveVault('vault-b')
    gate.resolve(statusFor('main'))
    await openFlowRefresh

    assert.equal(controller.getStatus('vault-b')?.branch, 'main')
    assert.equal(controller.getError('vault-b'), null)
  })

  it('never leaks a result across vaults', async () => {
    const gate = deferred<GitStatus>()
    const controller = new WorkspaceGitStatusController(() => gate.promise)

    controller.setActiveVault('vault-a')
    const inFlight = controller.refresh()
    controller.setActiveVault('vault-b')
    gate.resolve(statusFor('feature-a'))
    await inFlight

    assert.equal(controller.getStatus('vault-a')?.branch, 'feature-a')
    assert.equal(controller.getStatus('vault-b'), null)
  })

  it('lets the newest refresh supersede an older one for the same vault', async () => {
    const first = deferred<GitStatus>()
    const second = deferred<GitStatus>()
    let call = 0
    const controller = new WorkspaceGitStatusController(() => (call++ === 0 ? first.promise : second.promise))

    controller.setActiveVault('vault-a')
    const stale = controller.refresh()
    const fresh = controller.refresh()
    first.resolve(statusFor('older'))
    second.resolve(statusFor('newest'))
    await Promise.all([stale, fresh])

    assert.equal(controller.getStatus('vault-a')?.branch, 'newest')
  })

  it('stores failures per vault while keeping the last good status', async () => {
    let attempt = 0
    const controller = new WorkspaceGitStatusController(() => {
      attempt += 1
      if (attempt === 1) return Promise.resolve(statusFor('main'))
      return Promise.reject(new Error('git unavailable'))
    })

    controller.setActiveVault('vault-a')
    await controller.refresh()
    await controller.refresh()

    assert.equal(controller.getStatus('vault-a')?.branch, 'main')
    assert.match(controller.getError('vault-a') ?? '', /git unavailable/)
  })

  it('bounds resident vault slots and keeps the active one', async () => {
    const statuses = ['a', 'b', 'c', 'd'].map((branch) => Promise.resolve(statusFor(branch)))
    let index = 0
    const controller = new WorkspaceGitStatusController(() => statuses[index++]!)

    controller.setActiveVault('vault-d')
    await controller.refresh('vault-a')
    await controller.refresh('vault-b')
    await controller.refresh('vault-c')
    await controller.refresh('vault-d')

    assert.equal(Object.keys(controller.getSnapshot().slots).length <= GIT_STATUS_MAX_VAULT_SLOTS, true)
    assert.equal(controller.getStatus('vault-d')?.branch, 'd')
    assert.equal(controller.getStatus('vault-a'), null)
  })

  it('maps a null active vault to the sentinel slot key', () => {
    assert.notEqual(vaultStatusKey(null), '')
    assert.equal(vaultStatusKey(null), vaultStatusKey(null))
  })
})
