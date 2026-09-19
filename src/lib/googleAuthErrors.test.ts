import test from 'node:test'
import assert from 'node:assert/strict'

import { GOOGLE_AUTH_REQUIRED_PREFIX, googleAuthErrorMessage, isGoogleAuthRequiredError } from './googleAuthErrors.ts'

test('Google auth-required errors use a stable machine-readable prefix', () => {
  const error = new Error(`${GOOGLE_AUTH_REQUIRED_PREFIX} Google session expired. Reconnect the account.`)
  assert.equal(isGoogleAuthRequiredError(error), true)
  assert.equal(googleAuthErrorMessage(error), 'Google session expired. Reconnect the account.')
})

test('ordinary provider/network errors are not misclassified as auth failures', () => {
  const error = new Error('Google Calendar request failed (503): unavailable')
  assert.equal(isGoogleAuthRequiredError(error), false)
  assert.equal(googleAuthErrorMessage(error), error.message)
})
