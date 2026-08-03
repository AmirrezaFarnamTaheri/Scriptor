import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { hashDirectory, parseBenchmarkReport } from './benchmark-utils.mjs'

test('parseBenchmarkReport accepts pretty JSON surrounded by human output', () => {
  const report = parseBenchmarkReport('scan', 'starting\n{\n  "mean_ms": 12.5,\n  "p95_ms": 18\n}\ndone\n')
  assert.equal(report.mean_ms, 12.5)
  assert.equal(report.p95_ms, 18)
})

test('parseBenchmarkReport rejects reports without a finite mean', () => {
  assert.throws(() => parseBenchmarkReport('scan', '{"mean_ms":"fast"}'), /finite mean_ms/)
})

test('hashDirectory is order-independent and content-sensitive', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-benchmark-utils-'))
  try {
    fs.mkdirSync(path.join(root, 'nested'))
    fs.writeFileSync(path.join(root, 'nested', 'b.md'), 'bravo')
    fs.writeFileSync(path.join(root, 'a.md'), 'alpha')
    const first = hashDirectory(root)
    const second = hashDirectory(root)
    assert.deepEqual(first, second)
    assert.equal(first.fileCount, 2)
    fs.writeFileSync(path.join(root, 'a.md'), 'changed')
    assert.notEqual(hashDirectory(root).sha256, first.sha256)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
