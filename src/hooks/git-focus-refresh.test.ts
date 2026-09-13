import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGitFocusRefresh } from './git-focus-refresh.ts'

test('focus storms share pending work and respect a cooldown', async () => {
  let calls = 0
  let clock = 0
  let release!: () => void
  const refresh = createGitFocusRefresh(() => {
    calls++
    return new Promise<void>((resolve) => { release = resolve })
  }, () => clock)
  const first = refresh()
  clock = 3_000
  await refresh()
  assert.equal(calls, 1)
  release()
  await first
  const second = refresh()
  release()
  await second
  await refresh()
  assert.equal(calls, 2)
})
