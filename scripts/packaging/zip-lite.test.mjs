import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const script = path.join(root, 'scripts/zip-lite.py')

function buildAndListArchive(profile = 'source-review') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-zip-profile-'))
  const output = path.join(temp, 'Scriptor-lite.zip')
  const build = spawnSync('python3', [script, '--profile', profile, '--output', output], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  const list = spawnSync(
    'python3',
    ['-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', output],
    { cwd: root, encoding: 'utf8' },
  )
  assert.equal(list.status, 0, list.stderr || list.stdout)
  return { temp, entries: new Set(list.stdout.trim().split(/\r?\n/).filter(Boolean)), profile }
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
