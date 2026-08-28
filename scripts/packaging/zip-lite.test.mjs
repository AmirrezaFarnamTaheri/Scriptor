import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { assembleZip, buildZip, listZip, main } from './zip-lite.mjs'

const root = path.resolve(import.meta.dirname, '../..')

function buildAndListArchive(profile = 'source-review') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-zip-profile-'))
  const output = path.join(temp, 'Scriptor-lite.zip')
  const { count } = buildZip(root, output, profile)
  assert.ok(count > 0, 'archive must contain at least the profile record')
  return { temp, entries: new Set(listZip(output)), profile, output }
}

test('source-review archive preserves validation and release-policy inputs', () => {
  const { temp, entries } = buildAndListArchive()
  try {
    const required = [
      'Scriptor/perf-baselines.json',
      'Scriptor/apps/desktop/src-tauri/icons/icon.icns',
      'Scriptor/apps/desktop/src-tauri/icons/icon.ico',
      'Scriptor/apps/desktop/src-tauri/icons/icon.png',
      'Scriptor/docs/brand/app-icon.svg',
      'Scriptor/pnpm-lock.yaml',
      'Scriptor/Cargo.lock',
      'Scriptor/rust-toolchain.toml',
      'Scriptor/scripts/validation/desktop-branding.mjs',
      'Scriptor/scripts/benchmarks/check-baselines.mjs',
      'Scriptor/PACKAGING_PROFILE.json',
    ]
    for (const entry of required) {
      assert.ok(entries.has(entry), `source-review ZIP missing required validation input: ${entry}`)
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('lite archive still excludes build, dependency, VCS, and cache trees', () => {
  const { temp, entries } = buildAndListArchive()
  try {
    for (const entry of entries) {
      assert.doesNotMatch(entry, /\/(?:node_modules|target|\.git|dist|coverage|test-results)(?:\/|$)/)
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('archives are reproducible: identical content produces identical bytes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-zip-repro-'))
  try {
    const first = path.join(temp, 'first.zip')
    const second = path.join(temp, 'second.zip')
    buildZip(root, first, 'source-review')
    buildZip(root, second, 'source-review')
    const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    assert.equal(hash(first), hash(second), 'two builds of the same tree must be byte-identical')
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('packaging profile record is embedded with the requested profile', () => {
  const { temp, output } = buildAndListArchive('runtime-lite')
  try {
    const archive = fs.readFileSync(output)
    const marker = Buffer.from('Scriptor/PACKAGING_PROFILE.json')
    assert.ok(archive.includes(marker), 'profile record must be embedded')
    // runtime-lite additionally prunes synthetic fixtures and screenshot baselines.
    for (const entry of listZip(output)) {
      assert.doesNotMatch(entry, /\/(?:synthetic-1k|synthetic-5k|synthetic-25k|screenshots\.spec\.ts-snapshots)\//)
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})

test('CLI rejects missing option values and unknown options before creating an archive', () => {
  const errors = []
  const originalError = console.error
  console.error = (message) => {
    errors.push(String(message))
  }
  try {
    assert.equal(main(['--output']), 1)
    assert.equal(main(['--profile']), 1)
    assert.equal(main(['--unknown']), 1)
  } finally {
    console.error = originalError
  }

  assert.deepEqual(errors, [
    'Packaging failed: --output requires a path',
    'Packaging failed: --profile requires a value',
    'Packaging failed: unknown option: --unknown',
  ])
})

test('ZIP32 entry limits fail with actionable ZIP64 guidance', () => {
  const entry = {
    header: Buffer.alloc(30),
    nameBuffer: Buffer.from('x'),
    compressed: Buffer.alloc(0),
    crc: 0,
    method: 0,
    compressedSize: 0,
    uncompressedSize: 0,
  }
  assert.throws(
    () => assembleZip(Array.from({ length: 0x10000 }, () => entry)),
    /ZIP64 support is required above 65535/,
  )
})

test('a failed build preserves an existing archive', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-zip-recovery-'))
  try {
    const output = path.join(temp, 'existing.zip')
    fs.writeFileSync(output, 'known-good-archive')
    assert.throws(() => buildZip(path.join(temp, 'missing-source'), output), /missing required inputs/)
    assert.equal(fs.readFileSync(output, 'utf8'), 'known-good-archive')
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
