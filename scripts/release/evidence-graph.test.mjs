import assert from 'node:assert/strict'
import test from 'node:test'

import { createReleaseEvidenceGraph } from './evidence-graph.mjs'
import { RELEASE_QUALITY_CHECKS } from './release-quality.mjs'

const source = { schemaVersion: 2, sourceCommit: 'a'.repeat(40), sourceTreeSha256: 'b'.repeat(64) }
const subjects = [
  { path: 'Scriptor.msi', bytes: 12, sha256: '1'.repeat(64) },
  { path: 'Scriptor.dmg', bytes: 34, sha256: '2'.repeat(64) },
]
const quality = {
  schemaVersion: 1,
  version: '1.0.1',
  source,
  requiredChecks: RELEASE_QUALITY_CHECKS.map((check) => check.id),
  checks: RELEASE_QUALITY_CHECKS.map((check) => ({ id: check.id, status: 'passed' })),
  pass: true,
}
const performance = { schemaVersion: 3, source, pass: true, results: [] }
const receipt = { schemaVersion: 4, version: '1.0.1', trustProfile: 'unsigned', source, subjects }
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.7',
  metadata: {
    component: { version: '1.0.1' },
    properties: [
      { name: 'scriptor:source-commit', value: source.sourceCommit },
      { name: 'scriptor:source-tree-sha256', value: source.sourceTreeSha256 },
    ],
  },
}
const attestations = {
  schemaVersion: 1,
  sourceDigest: source.sourceCommit,
  subjects: subjects.map((subject) => ({ path: subject.path, sha256: subject.sha256, provenanceVerified: true, sbomVerified: true })),
  pass: true,
}
const signing = [
  { platform: 'windows', architecture: 'x86_64', trustProfile: 'unsigned' },
  { platform: 'macos', architecture: 'aarch64', trustProfile: 'unsigned' },
  { platform: 'linux', architecture: 'aarch64', trustProfile: 'unsigned' },
  { platform: 'linux', architecture: 'x86_64', trustProfile: 'unsigned' },
]
const nodes = [
  { id: 'source:VERSION', kind: 'source-input', path: 'VERSION', sha256: '3'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:quality', kind: 'quality-evidence', path: 'release-quality-evidence.json', sha256: '4'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:performance', kind: 'performance-evidence', path: 'performance-evidence.json', sha256: '5'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:receipt', kind: 'release-receipt', path: 'release-receipt.json', sha256: '6'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:sbom', kind: 'sbom', path: 'scriptor.cyclonedx.json', sha256: '7'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:checksums', kind: 'checksums', path: 'SHA256SUMS', sha256: '8'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:attestations', kind: 'attestation-verification', path: 'attestation-verification.json', sha256: '9'.repeat(64), required: true, status: 'verified' },
  { id: 'evidence:signing', kind: 'signing-evidence-set', path: 'signing-evidence-set', sha256: 'a'.repeat(64), required: true, status: 'verified' },
  ...subjects.map((subject) => ({ id: `installer:${subject.path}`, kind: 'installer', path: subject.path, sha256: subject.sha256, required: true, status: 'verified' })),
]

test('release evidence graph is source-bound, deterministic, and closes all required evidence', () => {
  const input = {
    version: '1.0.1', channel: 'production', trustProfile: 'unsigned', source, subjects,
    quality, performance, receipt, sbom, attestations, signing, nodes,
    createdAt: '2026-08-27T00:00:00.000Z',
  }
  const first = createReleaseEvidenceGraph(input)
  const second = createReleaseEvidenceGraph(input)
  assert.deepEqual(first, second)
  assert.equal(first.schema, 'scriptor.release-evidence-graph.v1')
  assert.equal(first.pass, true)
  assert.equal(first.summary.installerCount, 2)
  assert.ok(first.edges.some((edge) => edge.from === 'evidence:receipt' && edge.to === 'installer:Scriptor.msi'))
})

test('release evidence graph fails closed when no quality checks are declared', () => {
  assert.throws(() => createReleaseEvidenceGraph({
    version: '1.0.1', channel: 'production', trustProfile: 'unsigned', source, subjects,
    quality: { ...quality, requiredChecks: [], checks: [] },
    performance, receipt, sbom, attestations, signing, nodes,
  }), /required checks/)
})
