import assert from 'node:assert/strict'
import test from 'node:test'
import { WorkspaceOperationGate } from './workspaceOperation.ts'

test('a delayed operation cannot publish results into another vault or unlock a newer operation', async () => {
  const gate = new WorkspaceOperationGate('vault-a')
  const original = gate.begin()!
  let resolve!: () => void
  const submitted = new Promise<void>(done => { resolve = done })
  const visible: string[] = []
  const completion = submitted.then(() => {
    if (gate.isCurrent(original)) visible.push('vault-a artifact')
    gate.finish(original)
  })
  gate.setOwner('vault-b')
  assert.equal(gate.begin(), null, 'submitted native work still owns the global slot')
  resolve()
  await completion
  assert.deepEqual(visible, [])
  assert.equal(gate.isPending(), false)
  const next = gate.begin()!
  assert.equal(next.owner, 'vault-b')
  gate.finish(original)
  assert.equal(gate.isPending(), true, 'a duplicate old completion cannot unlock the new job')
  assert.equal(gate.isCurrent(next), true)
})

test('leaving and reopening the same vault cannot revive stale success or failure', () => {
  const gate = new WorkspaceOperationGate('vault-a')
  const original = gate.begin()!
  gate.setOwner('vault-b')
  gate.setOwner('vault-a')
  assert.equal(gate.isCurrent(original), false)
  gate.finish(original)
  const current = gate.begin()!
  assert.equal(gate.isCurrent(current), true)
  gate.invalidate()
  assert.equal(gate.isCurrent(current), false, 'unmount invalidates the display lease')
  gate.finish(current)
  assert.equal(gate.begin(), null, 'an unmounted owner cannot begin work')
})

test('the operation lock is synchronous across profiles and requires an open vault', () => {
  const gate = new WorkspaceOperationGate(null)
  assert.equal(gate.begin(), null)
  gate.setOwner('vault-a')
  assert.equal(gate.begin('vault-b'), null, 'a stale event handler cannot borrow the selected vault identity')
  const offline = gate.begin()!
  assert.equal(gate.begin(), null)
  gate.finish(offline)
  const pandoc = gate.begin()!
  assert.equal(gate.isCurrent(pandoc), true)
  assert.notEqual(pandoc, offline)
})
