import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { validateSigningEnvironment } from './signing-policy.mjs'
import {
  assertSigningEvidence,
  collectSigningEvidence,
  createSigningEvidence,
  writeSigningEvidence,
} from './signing-evidence.mjs'

const complete = {
  WINDOWS_CERTIFICATE: 'certificate',
  WINDOWS_CERTIFICATE_PASSWORD: 'password',
  APPLE_CERTIFICATE: 'certificate',
  APPLE_CERTIFICATE_PASSWORD: 'password',
  APPLE_SIGNING_IDENTITY: 'Developer ID Application: Example',
  APPLE_ID: 'release@example.com',
  APPLE_PASSWORD: 'app-password',
  APPLE_TEAM_ID: 'TEAM123',
  LINUX_SIGNING_KEY: 'key',
}

test('preview releases permit absent signing credentials', () => {
  assert.doesNotThrow(() => validateSigningEnvironment({ platform: 'windows', channel: 'preview', env: {} }))
})

test('production release policy fails closed for every platform', () => {
  for (const platform of ['windows', 'macos', 'linux']) {
    assert.throws(
      () => validateSigningEnvironment({ platform, channel: 'production', env: {} }),
      /production .* signing requires/,
    )
    assert.doesNotThrow(() => validateSigningEnvironment({ platform, channel: 'production', env: complete }))
  }
})

test('production signing evidence requires every platform and macOS notarization', () => {
  const records = [
    createSigningEvidence({ platform: 'windows', channel: 'production', signed: true, verifier: 'signtool verify /pa' }),
    createSigningEvidence({ platform: 'macos', channel: 'production', signed: true, notarized: true, verifier: 'codesign and stapler' }),
    createSigningEvidence({ platform: 'linux', channel: 'production', signed: true, verifier: 'gpg --verify' }),
  ]
  assert.equal(assertSigningEvidence(records, { channel: 'production' }).length, 3)
  assert.throws(
    () => assertSigningEvidence(records.map((record) => record.platform === 'macos' ? { ...record, notarized: false } : record), { channel: 'production' }),
    /not notarized/,
  )
  assert.throws(
    () => assertSigningEvidence(records.map((record) => record.platform === 'windows' ? { ...record, signed: false, signatureType: 'none' } : record), { channel: 'production' }),
    /artifact is unsigned/,
  )
  assert.throws(() => assertSigningEvidence(records.slice(1), { channel: 'production' }), /missing signing evidence for windows/)
})

test('signing evidence collection rejects duplicates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-signing-evidence-'))
  writeSigningEvidence(path.join(root, 'a'), { platform: 'windows', channel: 'preview', signed: false, verifier: 'preview' })
  writeSigningEvidence(path.join(root, 'b'), { platform: 'windows', channel: 'preview', signed: false, verifier: 'preview' })
  const records = collectSigningEvidence(root)
  assert.throws(() => assertSigningEvidence(records, { channel: 'preview' }), /duplicate signing evidence/)
})
