import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

import { validateSigningEnvironment } from './signing-policy.mjs'
import {
  assertSigningEvidence,
  collectSigningEvidence,
  createSigningEvidence,
  DEFAULT_RELEASE_TARGETS,
  writeSigningEvidence,
} from './signing-evidence.mjs'

test('preview and production releases have no signing-secret dependency', () => {
  for (const channel of ['preview', 'production']) {
    for (const target of DEFAULT_RELEASE_TARGETS) {
      const result = validateSigningEnvironment({ ...target, channel, env: {} })
      assert.deepEqual(result.requiredInputs, [])
      assert.equal(result.signingMode, 'unsigned')
    }
  }
})

test('unsigned production evidence covers every platform and architecture', () => {
  const records = DEFAULT_RELEASE_TARGETS.map((target) => createSigningEvidence({
    ...target,
    channel: 'production',
    signed: false,
    verifier: 'SHA-256 and GitHub attestation',
  }))
  assert.equal(assertSigningEvidence(records, { channel: 'production' }).length, 4)
  assert.throws(
    () => assertSigningEvidence(records.slice(1), { channel: 'production' }),
    /missing signing evidence/,
  )
})

test('signed records remain internally consistent without becoming mandatory', () => {
  const records = DEFAULT_RELEASE_TARGETS.map((target) => createSigningEvidence({
    ...target,
    channel: 'production',
    signed: target.platform === 'macos',
    notarized: target.platform === 'macos',
    verifier: target.platform === 'macos' ? 'codesign and stapler' : 'SHA-256 and GitHub attestation',
  }))
  assert.doesNotThrow(() => assertSigningEvidence(records, { channel: 'production' }))
  assert.throws(
    () => assertSigningEvidence(records.map((record) => (
      record.platform === 'macos' ? { ...record, notarized: false } : record
    )), { channel: 'production' }),
    /not notarized/,
  )
})

test('signing evidence collection rejects duplicate targets', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-signing-evidence-'))
  const target = { platform: 'windows', architecture: 'x86_64' }
  writeSigningEvidence(path.join(root, 'a'), {
    ...target,
    channel: 'preview',
    signed: false,
    verifier: 'preview',
  })
  writeSigningEvidence(path.join(root, 'b'), {
    ...target,
    channel: 'preview',
    signed: false,
    verifier: 'preview',
  })
  const records = collectSigningEvidence(root)
  assert.throws(
    () => assertSigningEvidence(records, { channel: 'preview', expectedTargets: [target] }),
    /duplicate signing evidence/,
  )
})

function stagingFixture(platform, architecture, files) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-stage-'))
  fs.writeFileSync(path.join(fixtureRoot, 'VERSION'), '0.1.1\n')
  const scripts = path.join(fixtureRoot, 'scripts/release')
  fs.mkdirSync(scripts, { recursive: true })
  for (const name of [
    'stage-release-assets.mjs',
    'signing-policy.mjs',
    'signing-evidence.mjs',
    'write-signing-evidence.mjs',
  ]) {
    fs.copyFileSync(path.resolve(import.meta.dirname, name), path.join(scripts, name))
  }
  const bundle = path.join(fixtureRoot, 'target/release/bundle')
  for (const [relative, contents = relative] of files) {
    const target = path.join(bundle, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
  }
  const evidence = spawnSync(process.execPath, [
    path.join(scripts, 'write-signing-evidence.mjs'),
    '--output-dir', bundle,
    '--platform', platform,
    '--architecture', architecture,
    '--channel', 'production',
    '--signed', 'false',
    '--verifier', 'test',
  ], { cwd: fixtureRoot, encoding: 'utf8' })
  assert.equal(evidence.status, 0, evidence.stderr)
  return fixtureRoot
}

test('release staging excludes unpacked bundle internals and gives assets unique target names', () => {
  const fixtureRoot = stagingFixture('linux', 'x86_64', [
    ['deb/scriptor.deb'],
    ['appimage/scriptor.AppImage'],
    ['appimage/scriptor.AppDir/usr/bin/scriptor', 'not a release asset'],
  ])
  const result = spawnSync(process.execPath, [
    path.join(fixtureRoot, 'scripts/release/stage-release-assets.mjs'),
    '--platform', 'linux',
    '--architecture', 'x86_64',
  ], { cwd: fixtureRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const staged = fs.readdirSync(path.join(fixtureRoot, 'release-output')).sort()
  assert.deepEqual(staged, [
    'scriptor-0.1.1-linux-x86_64.AppImage',
    'scriptor-0.1.1-linux-x86_64.deb',
    'signing-evidence-linux-x86_64.json',
  ])
})

test('release staging fails when a target kind is ambiguous', () => {
  const fixtureRoot = stagingFixture('windows', 'x86_64', [
    ['msi/a.msi'],
    ['msi/b.msi'],
    ['nsis/scriptor.exe'],
  ])
  const result = spawnSync(process.execPath, [
    path.join(fixtureRoot, 'scripts/release/stage-release-assets.mjs'),
    '--platform', 'windows',
    '--architecture', 'x86_64',
  ], { cwd: fixtureRoot, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /expected exactly one \.msi/)
})
