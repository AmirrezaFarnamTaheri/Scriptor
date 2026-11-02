import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { assertExactSourceCommit, collectWarmScaleEvidence, parseCollectorSizes } from './collect-scale-smoke.mjs'
import { evaluateScaleEvidence } from './scale-evidence.mjs'

const sha = 'a'.repeat(40)
function harness(fail = '', wrongCount = false, overBudget = false) {
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-scale-test-'))
  const calls = []
  let tick = 0
  return {
    calls,
    cleanup: () => fs.rmSync(workRoot, { recursive: true, force: true }),
    options: {
      cliPath: 'scriptor.exe', sourceCommit: sha, sizes: [100], workRoot,
      host: { id: 'test-runner', os: 'win32', arch: 'x64', cpu: 'test CPU', memoryMb: 8192 },
      toolchain: { node: 'v22.16.0', rustc: 'rustc 1.96.0', cargo: 'cargo 1.96.0' },
      now: () => new Date(Date.UTC(2026, 10, 3, 0, 0, tick++)),
      execute: (args) => {
        calls.push(args)
        if (args[0] === fail) return { status: 7, stdout: '', stderr: 'fault injected' }
        if (args[0] === 'generate-vault') {
          const [, dir, , count] = args
          fs.mkdirSync(path.join(dir, 'notes'), { recursive: true })
          for (let i = 0; i < Number(count); i++) {
            fs.writeFileSync(path.join(dir, 'notes', 'note-' + String(i).padStart(5, '0') + '.md'), '# note ' + i + '\n')
          }
          return { status: 0, stdout: JSON.stringify({ note_count: Number(count) }) }
        }
        return { status: overBudget ? 4 : 0, stdout: JSON.stringify({
          scenario: args[0] === 'bench-scan' ? 'vault-scan' : 'warm-search',
          note_count: wrongCount ? 99 : 100, mean_ms: 12, samples_ms: [11, 12, 13],
          within_budget: !overBudget, iterations: 3,
        }) }
      },
    },
  }
}

test('MAT-023: distinct warm native CLI measurements remain partial evidence, never cold acceptance', () => {
  const h = harness()
  try {
    const e = collectWarmScaleEvidence(h.options)
    assert.equal(e.runs.length, 4)
    assert.equal(h.calls.filter(c => c[0] === 'generate-vault').length, 4)
    assert.equal(h.calls.filter(c => c[0] === 'bench-scan').length, 4)
    assert.equal(h.calls.filter(c => c[0] === 'bench-search').length, 4)
    assert.equal(new Set(e.runs.map(r => r.startedAt)).size, 4)
    assert.equal(new Set(e.runs.map(r => r.runId)).size, 4)
    assert.equal(new Set(e.runs.map(r => r.fixtureSha256)).size, 1)
    assert.equal(e.collector.coldCacheVerified, false)
    const assessment = evaluateScaleEvidence(e)
    assert.equal(assessment.readyForReview, false)
    assert.equal(assessment.validRunCount, 4)
    assert.equal(assessment.summaries.length, 2)
    assert.equal(assessment.missing.length, 28)
  } finally { h.cleanup() }
})

test('MAT-023: failed generation, warmup or measurement cannot generate accepted results', () => {
  for (const failure of ['generate-vault', 'bench-scan', 'bench-search']) {
    const h = harness(failure)
    try { assert.throws(() => collectWarmScaleEvidence(h.options), /failed|exit|CLI/i) }
    finally { h.cleanup() }
  }
})

test('MAT-023: unexpected note count and invalid source identity fail closed', () => {
  const h = harness('', true)
  try { assert.throws(() => collectWarmScaleEvidence(h.options), /note count/i) }
  finally { h.cleanup() }
  const invalid = harness()
  try {
    assert.throws(() => collectWarmScaleEvidence({ ...invalid.options, sourceCommit: 'main' }), /commit SHA/i)
    assert.throws(() => collectWarmScaleEvidence({ ...invalid.options, sizes: [999] }), /size/i)
  } finally { invalid.cleanup() }
})

test('MAT-023: size selection is constrained to valid complete fixture counts', () => {
  assert.deepEqual(parseCollectorSizes('all'), [100, 1000, 5000, 25000])
  assert.deepEqual(parseCollectorSizes('5k'), [5000])
  assert.throws(() => parseCollectorSizes('../../vault'), /size/i)
})

test('MAT-023: preserve actual over-budget CLI exit-4 measurements without presenting them as a pass', () => {
  const h = harness('', false, true)
  try {
    const evidence = collectWarmScaleEvidence(h.options)
    assert.equal(evidence.runs.length, 4)
    assert.equal(evidence.runs.every(run => run.report.within_budget === false), true)
    assert.equal(evidence.collector.overBudgetCases.length, 4)
    assert.equal(evaluateScaleEvidence(evidence).readyForReview, false)
  } finally { h.cleanup() }
})

test('MAT-023: CLI evidence must match checked-out exact Git HEAD and cannot accept an unrelated SHA', () => {
  assert.doesNotThrow(() => assertExactSourceCommit(sha, sha.toUpperCase()))
  assert.throws(() => assertExactSourceCommit(sha, 'b'.repeat(40)), /source|checkout|HEAD|SHA/i)
  assert.throws(() => assertExactSourceCommit(sha, 'main'), /source|checkout|HEAD|SHA/i)
})
