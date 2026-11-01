import test from 'node:test'
import assert from 'node:assert/strict'

import { GOOGLE_AUTH_REQUIRED_PREFIX, googleAuthErrorMessage, isGoogleAuthRequiredError, isGoogleAccountNotConnectedError } from './googleAuthErrors.ts'

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

test('a missing first-time Google credential is disconnected, not an expired account', () => {
  assert.equal(isGoogleAccountNotConnectedError('GOOGLE_AUTH_REQUIRED: Google account is not connected.'), true)
  assert.equal(isGoogleAccountNotConnectedError('GOOGLE_AUTH_REQUIRED: Gmail is not connected'), true)
  assert.equal(isGoogleAccountNotConnectedError('GOOGLE_AUTH_REQUIRED: disconnected'), true)
})

test('expired or corrupt credentials require reconnection rather than an initial connection', () => {
  assert.equal(isGoogleAccountNotConnectedError('GOOGLE_AUTH_REQUIRED: Google authorization expired. Reconnect the account.'), false)
  assert.equal(isGoogleAccountNotConnectedError('GOOGLE_AUTH_REQUIRED: Stored Google credentials are invalid. Reconnect.'), false)
  assert.equal(isGoogleAccountNotConnectedError('Google service unavailable'), false)
})
