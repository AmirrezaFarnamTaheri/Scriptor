import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { auditPreviewInventory } from './preview-inventory.mjs'

const sha = 'a'.repeat(40)
const targets = [['windows', 'x86_64'], ['macos', 'aarch64'], ['linux', 'x86_64'], ['linux', 'aarch64']]
const installers = [
  'scriptor-1.3.4-windows-x86_64.msi', 'scriptor-1.3.4-windows-x86_64-setup.exe',
  'scriptor-1.3.4-macos-aarch64.dmg', 'scriptor-1.3.4-linux-x86_64.deb',
  'scriptor-1.3.4-linux-x86_64.AppImage', 'scriptor-1.3.4-linux-aarch64.deb',
  'scriptor-1.3.4-linux-aarch64.AppImage',
]
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-preview-inventory-'))
  for (const name of installers) fs.writeFileSync(path.join(directory, name), 'installer:' + name)
  for (const [platform, architecture] of targets) {
    const record = {
      schemaVersion: 2, platform, architecture, channel: 'preview',
      signed: false, notarized: false, signatureType: 'none',
      verifier: 'CI unsigned', sourceCommit: sha, createdAt: '2026-11-05T00:00:00.000Z',
    }
    fs.writeFileSync(path.join(directory, 'signing-evidence-' + platform + '-' + architecture + '.json'),
      JSON.stringify(record))
  }
  return { directory, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) }
}
const audit = directory => auditPreviewInventory({ directory, version: '1.3.4', sourceCommit: sha })

test('preview evidence: exactly seven installer hashes and four truthful unsigned target records', () => {
  const f = fixture()
  try {
    const result = audit(f.directory)
    assert.equal(result.scope, 'nonpublishing-preview-only')
    assert.equal(result.sourceCommit, sha)
    assert.equal(result.installers.length, 7)
    assert.equal(result.trustRecords.length, 4)
    assert.equal(result.installers.every(x => x.bytes > 0 && /^[a-f0-9]{64}$/.test(x.sha256)), true)
    assert.equal(result.releasePublished, false)
    assert.equal(result.installedRuntimeVerified, false)
    assert.equal(result.attestationsVerified, false)
  } finally { f.cleanup() }
})

test('preview evidence: missing, additional and symlink files cannot pass inventory', () => {
  const f = fixture()
  try {
    fs.unlinkSync(path.join(f.directory, installers[2]))
    assert.throws(() => audit(f.directory), /missing|cardinality|expected/i)
    fs.writeFileSync(path.join(f.directory, installers[2]), 'restored')
    fs.writeFileSync(path.join(f.directory, 'extra.exe'), 'extra')
    assert.throws(() => audit(f.directory), /unexpected|cardinality/i)
    fs.unlinkSync(path.join(f.directory, 'extra.exe'))
    fs.unlinkSync(path.join(f.directory, installers[0]))
    fs.symlinkSync(path.join(f.directory, installers[1]), path.join(f.directory, installers[0]))
    assert.throws(() => audit(f.directory), /regular|symlink|file/i)
  } finally { f.cleanup() }
})

test('preview evidence: forged native signature, source SHA and empty installer fail closed', () => {
  const f = fixture()
  try {
    const file = path.join(f.directory, 'signing-evidence-macos-aarch64.json')
    const initial = JSON.parse(fs.readFileSync(file, 'utf8'))
    fs.writeFileSync(file, JSON.stringify({ ...initial, signed: true, notarized: true, signatureType: 'developer-id' }))
    assert.throws(() => audit(f.directory), /unsigned|trust|sign/i)
    fs.writeFileSync(file, JSON.stringify({ ...initial, sourceCommit: 'b'.repeat(40) }))
    assert.throws(() => audit(f.directory), /source|commit/i)
    fs.writeFileSync(file, JSON.stringify(initial))
    fs.writeFileSync(path.join(f.directory, installers[3]), '')
    assert.throws(() => audit(f.directory), /empty|installer|bytes/i)
  } finally { f.cleanup() }
})

test('preview evidence: invalid source SHA or version mismatch is never accepted', () => {
  const f = fixture()
  try {
    assert.throws(() => auditPreviewInventory({ directory: f.directory,
      version: '1.3.3', sourceCommit: sha }), /version|missing|unexpected/i)
    assert.throws(() => auditPreviewInventory({ directory: f.directory,
      version: '1.3.4', sourceCommit: 'main' }), /source|commit|SHA/i)
  } finally { f.cleanup() }
})
