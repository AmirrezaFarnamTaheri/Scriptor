import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { buildZip, listZip } from './zip-lite.mjs'

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
