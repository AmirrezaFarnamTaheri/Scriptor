import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { collectBinaryReview, verifyBinaryReview, writeBinaryReview } from './binary-review.mjs'

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
function fixture({ failDaemon = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-binary-review-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Binary Review Test')
  git('config', 'user.email', 'binary-review@invalid.local')
  fs.writeFileSync(path.join(root, 'VERSION'), '1.3.3\n')
  git('add', 'VERSION')
  git('commit', '-qm', 'source')
  const commit = git('rev-parse', 'HEAD')
  const binaryDir = path.join(root, 'target/release')
  fs.mkdirSync(binaryDir, { recursive: true })
  const stubs = [
    ['scriptor',
      "#!/usr/bin/env node\nif (process.argv[2] === '--version') console.log('scriptor 1.3.3')\n"
      + "else if (process.argv[2] === 'system-info') console.log('system status ok')\n"
      + 'else process.exit(8)\n'],
    ['scriptor-daemon',
      "#!/usr/bin/env node\nif (process.argv[2] === '--version') "
      + (failDaemon ? 'process.exit(7)\n' : "console.log('scriptor-daemon 1.3.3')\n")
      + 'else process.exit(8)\n'],
  ]
  for (const [name, source] of stubs) {
    fs.writeFileSync(path.join(binaryDir, name), source)
    fs.chmodSync(path.join(binaryDir, name), 0o755)
  }
  return {
    root, commit, binaryDir,
    options: { root, expectedCommit: commit, platform: 'linux', architecture: 'x86_64' },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

test('MAT-024: real source-bound CLI/daemon probes and exact binary SHA-256 are recorded and rechecked', () => {
  const f = fixture()
  try {
    const manifest = collectBinaryReview(f.options)
    assert.equal(manifest.schemaVersion, 2)
    assert.equal(manifest.scope, 'cli-daemon-smoke-only')
    assert.equal(manifest.sourceCommit, f.commit)
    assert.equal(manifest.version, '1.3.3')
    assert.deepEqual(manifest.binaries.map(b => b.name), ['scriptor', 'scriptor-daemon'])
    assert.deepEqual(manifest.probes.map(p => p.id), ['cli-version', 'daemon-version', 'cli-system-info'])
    assert.equal(manifest.probes.every(p => p.exitCode === 0 && p.elapsedMs >= 0), true)
    assert.equal(manifest.binaries[0].sha256, hash(fs.readFileSync(path.join(f.binaryDir, 'scriptor'))))
    assert.equal(manifest.acceptance.installedDesktopVerified, false)
    assert.equal(manifest.acceptance.publishAuthorized, false)
    assert.deepEqual(verifyBinaryReview({ ...f.options, manifest }), {
      verifiedBinaries: 2, verifiedLiveProbes: 3, sourceCommit: f.commit,
      scope: 'cli-daemon-smoke-only',
    })
  } finally { f.cleanup() }
})

test('MAT-024: daemon nonzero process exit cannot produce hash-only successful review', () => {
  const f = fixture({ failDaemon: true })
  try { assert.throws(() => collectBinaryReview(f.options), /daemon-version|exit|probe/i) }
  finally { f.cleanup() }
})

test('MAT-024: mismatched Git checkout, spoofed version and source identity fail closed', () => {
  const f = fixture()
  try {
    assert.throws(() => collectBinaryReview({ ...f.options, expectedCommit: 'a'.repeat(40) }), /commit|source/i)
    const m = collectBinaryReview(f.options)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m, sourceCommit: 'b'.repeat(40) } }), /source|commit/i)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m, version: '9.9.9' } }), /version/i)
  } finally { f.cleanup() }
})

test('MAT-024: receipts reject removed targets, malicious path, fabricated exit and false acceptance', () => {
  const f = fixture()
  try {
    const m = collectBinaryReview(f.options)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m, binaries: [m.binaries[0]] } }), /exactly|binary/i)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m,
      binaries: [{ ...m.binaries[0], path: '../outside' }, m.binaries[1]] } }), /path/i)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m, probes: m.probes.slice(0, 2) } }), /probe/i)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m,
      probes: [{ ...m.probes[0], exitCode: 8 }, ...m.probes.slice(1)] } }), /probe|exit/i)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...m,
      acceptance: { ...m.acceptance, publishAuthorized: true } } }), /acceptance/i)
    fs.appendFileSync(path.join(f.binaryDir, 'scriptor'), '\n// tampered\n')
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: m }), /SHA256|bytes|hash/i)
  } finally { f.cleanup() }
})

test('MAT-024: complete evidence is written atomically and cannot be silently overwritten', () => {
  const f = fixture()
  try {
    const m = collectBinaryReview(f.options)
    const output = path.join(f.root, 'dist/release-review/binary-review-linux.json')
    writeBinaryReview(output, m)
    const original = fs.readFileSync(output, 'utf8')
    assert.equal(JSON.parse(original).sourceCommit, f.commit)
    assert.throws(() => writeBinaryReview(output, m), /overwrite|exist|refus/i)
    assert.equal(fs.readFileSync(output, 'utf8'), original)
    assert.equal(fs.readdirSync(path.dirname(output)).length, 1)
  } finally { f.cleanup() }
})

test('MAT-024: a forged system-info output digest fails independent live re-probe', () => {
  const f = fixture()
  try {
    const manifest = collectBinaryReview(f.options)
    const probes = manifest.probes.map((probe, index) => index === 2
      ? { ...probe, outputSha256: 'f'.repeat(64) }
      : probe)
    assert.throws(() => verifyBinaryReview({ ...f.options, manifest: { ...manifest, probes } }),
      /system-info|output|digest|probe/i)
  } finally { f.cleanup() }
})
