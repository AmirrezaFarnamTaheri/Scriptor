import assert from 'node:assert/strict'
import test from 'node:test'
import { pollingDelay, MAX_POLL_REQUESTS } from './collaborationPolling.ts'
test('poll retries back off within bounds and stop after the explicit session budget', () => {
  assert.equal(pollingDelay(0), 30_000)
  assert.equal(pollingDelay(1), 60_000)
  assert.equal(pollingDelay(100), 300_000)
  assert.equal(MAX_POLL_REQUESTS, 30)
})
