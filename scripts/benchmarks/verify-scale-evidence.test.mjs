import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const command = path.join(import.meta.dirname, 'verify-scale-evidence.mjs')
const input = {
  schemaVersion: 1,
  sourceCommit: 'a'.repeat(40),
  host: { id: 'host', os: 'windows', arch: 'x64', cpu: '8 cores', memoryMb: 16384 },
  toolchain: { node: '22', rustc: '1.96', cargo: '1.96' },
  runs: [],
}
const run = (size, mode, condition, replicate) => ({
  size, mode, condition, replicate, runId: size + '-' + mode + '-' + condition + '-' + replicate,
  startedAt: replicate === 1 ? '2026-11-01T15:22:00.000Z' : '2026-11-01T15:22:01.000Z', fixtureSha256: String(size).padStart(64, '0'),
  noteCount: size, report: {
    scenario: mode === 'scan' ? 'vault-scan' : 'warm-search',
    note_count: size, samples_ms: [10, 11, 12], mean_ms: 11, within_budget: true,
  },
  ...(condition === 'cold' ? { cacheReset: { method: 'fresh-volume', evidence: 'attested' } } : { warmed: true }),
})
const runCli = (data) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-mat023-'))
  try {
    fs.writeFileSync(path.join(root, 'run.json'), JSON.stringify(data))
    return spawnSync(process.execPath, [command, path.join(root, 'run.json')], { encoding: 'utf8' })
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
}

test('MAT-023 CLI returns nonzero for incomplete cold/warm matrix and reports missing cases', () => {
  const result = runCli(input)
  assert.equal(result.status, 1)
  const value = JSON.parse(result.stdout)
  assert.equal(value.readyForReview, false)
  assert.equal(value.missing.length, 32)
})

test('MAT-023 CLI can report a complete measured matrix without claiming performance success', () => {
  const data = { ...input, runs: [] }
  for (const size of [100, 1000, 5000, 25000]) for (const mode of ['scan', 'search']) {
    for (const condition of ['cold', 'warm']) for (const replicate of [1, 2]) data.runs.push(run(size, mode, condition, replicate))
  }
  const result = runCli(data)
  assert.equal(result.status, 0, result.stderr)
  const value = JSON.parse(result.stdout)
  assert.equal(value.readyForReview, true)
  assert.equal('pass' in value, false)
})

test('MAT-023 CLI rejects invalid evidence without a false success response', () => {
  const result = runCli({ schemaVersion: 1, runs: [] })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /exact 40-hex source commit/i)
  assert.equal(result.stdout, '')
})
