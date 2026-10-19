import assert from 'node:assert/strict'
import test from 'node:test'
import { selectGoogleOAuthClientId } from './googleOAuthClient.ts'

test('the packaged Scriptor identity takes precedence over a vault legacy client', () => {
  assert.equal(selectGoogleOAuthClientId(' 123.apps.googleusercontent.com ', 'other.apps.googleusercontent.com'), '123.apps.googleusercontent.com')
})

test('legacy vaults keep their existing client in development builds', () => {
  assert.equal(selectGoogleOAuthClientId(undefined, ' existing.apps.googleusercontent.com '), 'existing.apps.googleusercontent.com')
})

test('new users are never assigned an invented third-party OAuth client', () => {
  assert.equal(selectGoogleOAuthClientId('', null), '')
})
