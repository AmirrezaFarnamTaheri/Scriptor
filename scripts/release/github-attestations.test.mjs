import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAttestationVerifyCommands, verifyGithubAttestations } from './github-attestations.mjs'

test('attestation verification binds both provenance and CycloneDX claims to source and signer', () => {
  const commands = buildAttestationVerifyCommands({
    subjects: ['/tmp/a.msi'],
    repository: 'owner/repo',
    sourceDigest: 'abc123',
    sourceRef: 'refs/tags/v1.0.1',
    signerWorkflow: 'owner/repo/.github/workflows/release.yml',
  })
  assert.equal(commands.length, 2)
  assert.equal(commands[0].predicateType, 'https://slsa.dev/provenance/v1')
  assert.equal(commands[1].predicateType, 'https://cyclonedx.org/bom')
  for (const command of commands) {
    assert.ok(command.args.includes('--source-digest'))
    assert.ok(command.args.includes('abc123'))
    assert.ok(command.args.includes('--source-ref'))
    assert.ok(command.args.includes('refs/tags/v1.0.1'))
    assert.ok(command.args.includes('--signer-workflow'))
    assert.ok(command.args.includes('owner/repo/.github/workflows/release.yml'))
    assert.ok(command.args.includes('--format'))
    assert.ok(command.args.includes('json'))
  }
})

test('attestation verification rejects an empty verification result', () => {
  assert.throws(() => verifyGithubAttestations({
    subjects: [{ path: '/tmp/a.msi', sha256: 'a'.repeat(64) }],
    repository: 'owner/repo',
    sourceDigest: 'abc123',
    sourceRef: 'refs/tags/v1.0.1',
    signerWorkflow: 'owner/repo/.github/workflows/release.yml',
    execute: () => '[]',
  }), /no verified attestations/)
})
