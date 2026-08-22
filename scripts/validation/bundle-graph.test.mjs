import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const validator = path.resolve(import.meta.dirname, 'bundle-graph.mjs')

function createBundle(assetSource) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'scriptor-bundle-graph-'))
  const assets = path.join(directory, 'assets')
  const manifestDirectory = path.join(directory, '.vite')
  mkdirSync(assets, { recursive: true })
  mkdirSync(manifestDirectory, { recursive: true })
  writeFileSync(path.join(directory, 'index.html'), '<div id="root"></div>')
  writeFileSync(path.join(assets, 'index.js'), assetSource)
  writeFileSync(
    path.join(manifestDirectory, 'manifest.json'),
    JSON.stringify({ 'index.html': { file: 'assets/index.js', isEntry: true } }),
  )
  return directory
}

function validate(directory) {
  return spawnSync(process.execPath, [validator, directory], { encoding: 'utf8' })
}

test('production bundle validation rejects compiled E2E fault injection', () => {
  const directory = createBundle(
    'sessionStorage.getItem("e2e:editor-render-failure"); throw new Error("E2E editor render failure")',
  )
  try {
    const result = validate(directory)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /test-only marker/i)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('production bundle validation accepts assets without test-only markers', () => {
  const directory = createBundle('console.log("production")')
  try {
    const result = validate(directory)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('screenshot documentation passes E2E mode directly to Vite', () => {
  const documentation = readFileSync(
    path.resolve(import.meta.dirname, '../../docs/assets/screenshots/README.md'),
    'utf8',
  )
  assert.match(documentation, /pnpm exec vite build --mode e2e/)
  assert.doesNotMatch(documentation, /pnpm build --mode e2e/)
})
