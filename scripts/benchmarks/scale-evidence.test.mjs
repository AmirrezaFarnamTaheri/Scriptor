import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateScaleEvidence, SCALE_CASE_SIZES, SCALE_CASE_MODES } from './scale-evidence.mjs'

const sourceCommit = 'a'.repeat(40)
const fixture = (size) => size.toString(16).padStart(64, '0')
const base = () => ({
  schemaVersion: 1,
  sourceCommit,
  host: { id: 'win11-lab-host-a', os: 'windows', arch: 'x64', cpu: '8-core test host', memoryMb: 16384 },
  toolchain: { node: 'v22.16.0', rustc: 'rustc 1.96.0', cargo: 'cargo 1.96.0' },
  runs: [],
})
const run = ({ size = 100, mode = 'scan', condition = 'warm', replicate = 1, ms = 10 } = {}) => ({
  size, mode, condition, replicate,
  runId: 'run-' + size + '-' + mode + '-' + condition + '-' + replicate,
  startedAt: '2026-11-01T' + String(replicate).padStart(2, '0') + ':00:00.000Z',
  fixtureSha256: fixture(size),
  noteCount: size,
  report: { note_count: size, samples_ms: [ms - 1, ms, ms + 1], mean_ms: ms },
  ...(condition === 'cold'
    ? { cacheReset: { method: 'fresh-volume', evidence: 'volume-' + size + '-' + mode + '-' + replicate } }
    : { warmed: true }),
})
const fullMatrix = () => {
  const evidence = base()
  for (const size of [100, 1000, 5000, 25000]) {
    for (const mode of ['scan', 'search']) {
      for (const condition of ['cold', 'warm']) {
        evidence.runs.push(run({ size, mode, condition, replicate: 1 }), run({ size, mode, condition, replicate: 2, ms: 12 }))
      }
    }
  }
  return evidence
}

test('MAT-023: incomplete evidence lists all missing independent cold and warm cases instead of reporting success', () => {
  const result = evaluateScaleEvidence(base())
  assert.equal(result.readyForReview, false)
  assert.equal(result.validRunCount, 0)
  assert.equal(result.missing.length, 32)
  assert.deepEqual(SCALE_CASE_SIZES, [100, 1000, 5000, 25000])
  assert.deepEqual(SCALE_CASE_MODES, ['scan', 'search'])
  assert.equal(result.summaries.length, 0)
})

test('MAT-023: complete 100, 1k, 5k, 25k scan/search matrix summarizes independent runs without claiming a speedup', () => {
  const result = evaluateScaleEvidence(fullMatrix())
  assert.equal(result.readyForReview, true)
  assert.equal(result.validRunCount, 32)
  assert.equal(result.missing.length, 0)
  assert.equal(result.summaries.length, 16)
  assert.deepEqual(result.summaries[0], {
    size: 100, mode: 'scan', condition: 'cold', repeats: 2,
    meanMs: 11, minRepeatMs: 10, maxRepeatMs: 12, spreadPercent: 18.2,
  })
  assert.equal('pass' in result, false, 'a complete measured matrix is not a performance acceptance verdict')
})

test('MAT-023: refuses a claimed cold run without documented cache clearing and a warm run without priming', () => {
  const cold = base()
  cold.runs = [run({ condition: 'cold' })]
  delete cold.runs[0].cacheReset
  assert.throws(() => evaluateScaleEvidence(cold), /cold.*cache|cache.*cold/i)
  const warm = base()
  warm.runs = [run()]
  delete warm.runs[0].warmed
  assert.throws(() => evaluateScaleEvidence(warm), /warm|primed/i)
})

test('MAT-023: rejects mismatched fixture and reported measured note counts', () => {
  const input = base()
  input.runs.push({ ...run({ size: 25000 }), noteCount: 24999 })
  assert.throws(() => evaluateScaleEvidence(input), /note.?count|notes/i)
  input.runs = [run({ size: 25000 })]
  input.runs[0].report.note_count = 1000
  assert.throws(() => evaluateScaleEvidence(input), /note.?count|notes/i)
  input.runs = [run()]
  input.runs[0].fixtureSha256 = 'bad hash'
  assert.throws(() => evaluateScaleEvidence(input), /fixture|sha256/i)
})

test('MAT-023: rejects non-independent repeats and incompatible fixtures across scenarios', () => {
  const evidence = base()
  evidence.runs = [run(), run()]
  assert.throws(() => evaluateScaleEvidence(evidence), /duplicate|repeat/i)
  evidence.runs = [run({ mode: 'scan' }), { ...run({ mode: 'search' }), fixtureSha256: 'b'.repeat(64) }]
  assert.throws(() => evaluateScaleEvidence(evidence), /fixture|hash/i)
  evidence.runs = [run(), { ...run({ replicate: 2 }), runId: 'run-100-scan-warm-1' }]
  assert.throws(() => evaluateScaleEvidence(evidence), /runId|independent/i)
})

test('MAT-023: rejects source, host or toolchain identities that make independent results irreproducible', () => {
  const input = base()
  input.sourceCommit = 'main'
  assert.throws(() => evaluateScaleEvidence(input), /commit|source/i)
  input.sourceCommit = sourceCommit
  input.host.cpu = ''
  assert.throws(() => evaluateScaleEvidence(input), /host|cpu/i)
  input.host.cpu = '8-core test host'
  input.toolchain.rustc = null
  assert.throws(() => evaluateScaleEvidence(input), /toolchain|rustc/i)
})

test('MAT-023: rejects invented means, nonfinite samples, and missing latency distributions', () => {
  const evidence = base()
  const row = run()
  row.report.mean_ms = 1000
  evidence.runs = [row]
  assert.throws(() => evaluateScaleEvidence(evidence), /reported mean|samples|inconsistent/i)
  row.report.mean_ms = 10
  row.report.samples_ms = [1, Infinity, 3]
  assert.throws(() => evaluateScaleEvidence(evidence), /samples|finite/i)
  row.report.samples_ms = [10]
  assert.throws(() => evaluateScaleEvidence(evidence), /samples|iterations/i)
})


test('MAT-023: distinct run IDs with the same UTC start cannot establish independent repeat evidence', () => {
  const input = base()
  const first = run({ condition: 'warm', replicate: 1 })
  input.runs = [first, { ...run({ condition: 'warm', replicate: 2 }), startedAt: first.startedAt }]
  assert.throws(() => evaluateScaleEvidence(input), /independent|timestamp|start time/i)
})


test('MAT-023: timestamp precision aliases cannot be counted as separate measurement starts', () => {
  const input = base()
  const first = run({ condition: 'warm', replicate: 1 })
  const second = { ...run({ condition: 'warm', replicate: 2 }), startedAt: '2026-11-01T01:00:00.0000Z' }
  input.runs = [first, second]
  assert.throws(() => evaluateScaleEvidence(input), /independent|timestamp|start time/i)
})


test('MAT-023: zero-duration timing samples cannot certify instantaneous operation or hide clock quantization', () => {
  const evidence = base()
  const row = run()
  evidence.runs = [row]
  row.report.samples_ms = [0, 0, 0]
  row.report.mean_ms = 0
  assert.throws(() => evaluateScaleEvidence(evidence), /zero|positive|clock|precision/i)
  row.report.samples_ms = [0, 0.25, 0.5]
  row.report.mean_ms = 0.25
  assert.throws(() => evaluateScaleEvidence(evidence), /zero|positive|clock|precision/i)
  row.report.samples_ms = [0.125, 0.25, 0.375]
  row.report.mean_ms = 0.25
  assert.equal(evaluateScaleEvidence(evidence).validRunCount, 1)
})
