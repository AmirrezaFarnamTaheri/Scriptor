import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { evaluateBenchmarkThreshold, hashDirectory, parseBenchmarkReport, summarizeSamples } from './benchmark-utils.mjs'

test('parseBenchmarkReport accepts pretty JSON surrounded by human output', () => {
  const report = parseBenchmarkReport('scan', 'starting\n{\n  "mean_ms": 12.5,\n  "p95_ms": 18\n}\ndone\n')
  assert.equal(report.mean_ms, 12.5)
  assert.equal(report.p95_ms, 18)
})


test('parseBenchmarkReport normalizes producers that emit average_ms', () => {
  const report = parseBenchmarkReport('editor', '{"average_ms": 7.25, "max_ms": 9}')
  assert.equal(report.mean_ms, 7.25)
  assert.equal(report.max_ms, 9)
})

test('parseBenchmarkReport rejects reports without a finite mean', () => {
  assert.throws(() => parseBenchmarkReport('scan', '{"mean_ms":"fast"}'), /finite mean_ms/)
})


test('evaluateBenchmarkThreshold fails an intentionally injected regression above 15 percent', () => {
  const verdict = evaluateBenchmarkThreshold('injected', { mean_ms: 116, samples_ms: [116] }, 100)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.limitMs, 115)
  assert.equal(verdict.deltaPercent, 16)
})

test('evaluateBenchmarkThreshold accepts a measurement on the 15 percent boundary', () => {
  const verdict = evaluateBenchmarkThreshold('boundary', { mean_ms: 115, samples_ms: [115] }, 100)
  assert.equal(verdict.pass, true)
})

test('summarizeSamples emits deterministic mean and percentiles', () => {
  assert.deepEqual(summarizeSamples([20, 10, 40, 30]), {
    mean_ms: 25,
    min_ms: 10,
    p50_ms: 20,
    p95_ms: 40,
    max_ms: 40,
  })
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
