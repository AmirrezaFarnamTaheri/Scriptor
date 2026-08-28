import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { validateSigningEnvironment } from './signing-policy.mjs'
import { assertSigningEvidence, createSigningEvidence, DEFAULT_RELEASE_TARGETS } from './signing-evidence.mjs'

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8')

test('native-signed trust profile requires credentials only on platforms with native signing', () => {
  const windowsEnv = { WINDOWS_CERTIFICATE: 'base64', WINDOWS_CERTIFICATE_PASSWORD: 'secret', WINDOWS_TIMESTAMP_URL: 'https://timestamp.example.test' }
  const macEnv = {
    APPLE_CERTIFICATE: 'base64', APPLE_CERTIFICATE_PASSWORD: 'secret',
    APPLE_ID: 'person@example.com', APPLE_PASSWORD: 'app-password', APPLE_TEAM_ID: 'TEAM123',
  }
  assert.equal(validateSigningEnvironment({ platform: 'windows', architecture: 'x86_64', channel: 'production', trustProfile: 'native-signed', env: windowsEnv }).signingMode, 'authenticode')
  assert.equal(validateSigningEnvironment({ platform: 'macos', architecture: 'aarch64', channel: 'production', trustProfile: 'native-signed', env: macEnv }).signingMode, 'developer-id')
  assert.equal(validateSigningEnvironment({ platform: 'linux', architecture: 'x86_64', channel: 'production', trustProfile: 'native-signed', env: {} }).signingMode, 'unsigned-attested')
  assert.throws(() => validateSigningEnvironment({ platform: 'windows', architecture: 'x86_64', channel: 'production', trustProfile: 'native-signed', env: {} }), /WINDOWS_CERTIFICATE/)
  assert.throws(() => validateSigningEnvironment({ platform: 'windows', architecture: 'x86_64', channel: 'production', trustProfile: 'native-signed', env: { WINDOWS_CERTIFICATE: 'base64', WINDOWS_CERTIFICATE_PASSWORD: 'secret' } }), /WINDOWS_TIMESTAMP_URL/)
})

test('native-signed production evidence accepts Windows and notarized macOS while Linux remains attested', () => {
  const records = DEFAULT_RELEASE_TARGETS.map((target) => createSigningEvidence({
    ...target,
    channel: 'production',
    signed: target.platform === 'windows' || target.platform === 'macos',
    notarized: target.platform === 'macos',
    verifier: target.platform === 'linux' ? 'SHA-256 and GitHub attestation' : 'native signature verification',
  }))
  assert.equal(assertSigningEvidence(records, { channel: 'production', expectedTrustProfile: 'native-signed' }).length, 4)
})

test('release evidence uses CycloneDX 1.7 consistently', async () => {
  for (const file of ['generate-sbom.mjs', 'verify-release-evidence.mjs']) {
    const source = await read(file)
    assert.match(source, /1\.7/)
    assert.doesNotMatch(source, /specVersion[^\n]*1\.6/)
  }
})

test('release workflow exposes an opt-in native-signed profile without weakening unsigned default', async () => {
  const workflow = await read('../../.github/workflows/release.yml')
  assert.match(workflow, /trust_profile:/)
  assert.match(workflow, /default:\s*unsigned/)
  assert.match(workflow, /native-signed/)
  assert.match(workflow, /APPLE_CERTIFICATE/)
  assert.match(workflow, /WINDOWS_CERTIFICATE/)
})
