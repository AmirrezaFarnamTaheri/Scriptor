import assert from 'node:assert/strict'
import test from 'node:test'
import { googleConnectionAction } from './googleIntegrationSetup.ts'

test('verified connected accounts use an explicit switch action', () => {
  assert.equal(googleConnectionAction('connected', 'writer@example.org'), 'switch')
  assert.equal(googleConnectionAction('synced', 'writer@example.org'), 'switch')
})
test('expired or uncertain authorization uses reconnect rather than a false connected state', () => {
  assert.equal(googleConnectionAction('reconnect-required', 'writer@example.org'), 'reconnect')
  assert.equal(googleConnectionAction('reconnect-required', null), 'reconnect')
  assert.equal(googleConnectionAction('error', 'writer@example.org'), 'reconnect')
})
test('disconnected or unverified identities offer connection', () => {
  assert.equal(googleConnectionAction('disconnected', null), 'connect')
  assert.equal(googleConnectionAction('checking', null), 'connect')
  assert.equal(googleConnectionAction('error', null), 'connect')
  assert.equal(googleConnectionAction('connected', null), 'connect')
})
