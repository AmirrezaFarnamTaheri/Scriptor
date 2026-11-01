import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateScaleEvidence, SCALE_CASE_SIZES, SCALE_CASE_MODES } from './scale-evidence.mjs'

const sourceCommit = 'a'.repeat(40)
const fixture = size => size.toString(16).padStart(64, '0')
const base = () => ({
  schemaVersion: 1, sourceCommit,
  host: { id: 'lab-host-a', os: 'windows', arch: 'x64', cpu: '8-core test host', memoryMb: 16384 },
  toolchain: { node: 'v22.16.0', rustc: 'rustc 1.96.0', cargo: 'cargo 1.96.0' },
  runs: [],
})
const run = ({ size = 100, mode = 'scan', condition = 'warm', replicate = 1, ms = 10 } = {}) => ({
  size, mode, condition, replicate, runId: 'run-' + size + '-' + mode + '-' + condition + '-' + replicate,
  startedAt: '2026-11-01T' + String(replicate).padStart(2, '0') + ':00:00.000Z',
  fixtureSha256: fixture(size), noteCount: size,
  report: { note_count: size, samples_ms: [ms - 1, ms, ms + 1], mean_ms: ms },
  ...(condition === 'cold' ? { cacheReset: { method: 'fresh-volume', evidence: 'volume-' + size + '-' + mode + '-' + replicate } } : { warmed: true }),
})
const fullMatrix = () => {
  const evidence = base()
  for (const size of SCALE_CASE_SIZES) for (const mode of SCALE_CASE_MODES) {
    for (const condition of ['cold', 'warm']) for (const replicate of [1, 2])
      evidence.runs.push(run({ size, mode, condition, replicate, ms: replicate === 1 ? 10 : 12 }))
  }
  return evidence
}

test('MAT-023: missing independent cold/warm repetitions cannot report a complete benchmark matrix', () => {
  const report = evaluateScaleEvidence(base())
  assert.equal(report.readyForReview, false)
  assert.equal(report.validRunCount, 0)
  assert.equal(report.missing.length, 32)
  assert.equal(report.summaries.length, 0)
})

test('MAT-023: complete 100/1k/5k/25k scan/search matrix reports variance without claiming a speedup', () => {
  const report = evaluateScaleEvidence(fullMatrix())
  assert.equal(report.readyForReview, true)
  assert.equal(report.missing.length, 0)
  assert.equal(report.summaries.length, 16)
  assert.deepEqual(report.summaries[0], {
    size: 100, mode: 'scan', condition: 'cold', repeats: 2,
    meanMs: 11, minRepeatMs: 10, maxRepeatMs: 12, spreadPercent: 18.2,
  })
  assert.equal('pass' in report, false)
})

test('MAT-023: refuses cold without cache-clearing evidence and warm without priming', () => {
  const input = base(); input.runs = [run({ condition: 'cold' })]
  delete input.runs[0].cacheReset
  assert.throws(() => evaluateScaleEvidence(input), /cold.*cache|cache.*cold/i)
  input.runs = [run()]; delete input.runs[0].warmed
  assert.throws(() => evaluateScaleEvidence(input), /warm|primed/i)
})

test('MAT-023: rejects mismatched expected and measured note counts or invalid fixture checksums', () => {
  const input = base()
  input.runs.push({ ...run({ size: 25000 }), noteCount: 24999 })
  assert.throws(() => evaluateScaleEvidence(input), /note.?count|notes/i)
  input.runs = [run({ size: 25000 })]; input.runs[0].report.note_count = 1000
  assert.throws(() => evaluateScaleEvidence(input), /note.?count|notes/i)
  input.runs = [run()]; input.runs[0].fixtureSha256 = 'bad hash'
  assert.throws(() => evaluateScaleEvidence(input), /fixture|sha256/i)
})

test('MAT-023: rejects duplicated runs, reused run IDs and changed fixture identity', () => {
  const evidence = base()
  evidence.runs = [run(), run()]
  assert.throws(() => evaluateScaleEvidence(evidence), /duplicate|repeat/i)
  evidence.runs = [run({ mode: 'scan' }), { ...run({ mode: 'search' }), fixtureSha256: 'b'.repeat(64) }]
  assert.throws(() => evaluateScaleEvidence(evidence), /fixture|hash/i)
  evidence.runs = [run(), { ...run({ replicate: 2 }), runId: 'run-100-scan-warm-1' }]
  assert.throws(() => evaluateScaleEvidence(evidence), /runId|independent/i)
})

test('MAT-023: rejects missing source, host and toolchain identity', () => {
  const input = base(); input.sourceCommit = 'main'
  assert.throws(() => evaluateScaleEvidence(input), /commit|source/i)
  input.sourceCommit = sourceCommit; input.host.cpu = ''
  assert.throws(() => evaluateScaleEvidence(input), /host|cpu/i)
  input.host.cpu = '8-core test host'; input.toolchain.rustc = null
  assert.throws(() => evaluateScaleEvidence(input), /toolchain|rustc/i)
})

test('MAT-023: rejects invented means, nonfinite samples and missing latency distributions', () => {
  const evidence = base(); const row = run(); row.report.mean_ms = 1000; evidence.runs = [row]
  assert.throws(() => evaluateScaleEvidence(evidence), /reported mean|samples|inconsistent/i)
  row.report.mean_ms = 10; row.report.samples_ms = [1, Infinity, 3]
  assert.throws(() => evaluateScaleEvidence(evidence), /samples|finite/i)
  row.report.samples_ms = [10]
  assert.throws(() => evaluateScaleEvidence(evidence), /samples|iterations/i)
})
