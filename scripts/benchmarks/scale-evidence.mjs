/**
 * MAT-023 evidence validator: validates externally recorded measurements. It does
 * not execute benchmarks, clear OS caches, or certify performance targets.
 */
export const SCALE_CASE_SIZES = Object.freeze([100, 1000, 5000, 25000])
export const SCALE_CASE_MODES = Object.freeze(['scan', 'search'])
const CONDITIONS = ['cold', 'warm']
const REPEATS = [1, 2]
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const requireText = (value, field) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Missing ' + field + ' metadata')
}
const percent = (value) => Math.round(value * 10) / 10
const key = (row) => row.size + '/' + row.mode + '/' + row.condition + '/' + row.replicate

/** Returns a completeness assessment, not a benchmark pass/fail claim. */
export function evaluateScaleEvidence(evidence) {
  if (!isObject(evidence) || evidence.schemaVersion !== 1) throw new Error('Unsupported scale evidence schemaVersion')
  if (typeof evidence.sourceCommit !== 'string' || !/^[0-9a-f]{40}$/i.test(evidence.sourceCommit)) {
    throw new Error('Provide an exact 40-hex source commit')
  }
  if (!isObject(evidence.host)) throw new Error('Missing host identity')
  for (const field of ['id', 'os', 'arch', 'cpu']) requireText(evidence.host[field], 'host.' + field)
  if (!finite(evidence.host.memoryMb) || evidence.host.memoryMb <= 0) throw new Error('Missing host.memoryMb')
  if (!isObject(evidence.toolchain)) throw new Error('Missing toolchain identity')
  for (const field of ['node', 'rustc', 'cargo']) requireText(evidence.toolchain[field], 'toolchain.' + field)
  if (!Array.isArray(evidence.runs) || evidence.runs.length > 32) throw new Error('Scale evidence requires up to 32 run records')

  const usedKeys = new Set()
  const usedRuns = new Set()
  const fixtures = new Map()
  const byCase = new Map()
  for (const row of evidence.runs) {
    if (!isObject(row)) throw new Error('Malformed scale evidence run')
    if (!SCALE_CASE_SIZES.includes(row.size) || !SCALE_CASE_MODES.includes(row.mode) || !CONDITIONS.includes(row.condition)
      || !REPEATS.includes(row.replicate)) throw new Error('Unknown scale evidence size, mode, condition or repeat')
    const caseKey = key(row)
    if (usedKeys.has(caseKey)) throw new Error('Duplicate repeat for ' + caseKey)
    usedKeys.add(caseKey)
    requireText(row.runId, 'runId')
    if (usedRuns.has(row.runId)) throw new Error('Duplicate runId ' + row.runId + '; independent runs need distinct IDs')
    usedRuns.add(row.runId)
    const startedAtMs = typeof row.startedAt === 'string' ? Date.parse(row.startedAt) : Number.NaN
    // Date.parse normalizes impossible dates (e.g. 2026-02-30 -> March 2).
    // Evidence timestamps must name the actual observed Gregorian UTC day;
    // retain support for fractional precision beyond milliseconds.
    if (typeof row.startedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z$/.test(row.startedAt)
      || !Number.isFinite(startedAtMs)
      || new Date(startedAtMs).toISOString().slice(0, 19) !== row.startedAt.slice(0, 19)) {
      throw new Error('Invalid startedAt for ' + caseKey)
    }
    if (typeof row.fixtureSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(row.fixtureSha256)) {
      throw new Error('Invalid fixture SHA256 for ' + caseKey)
    }
    if (fixtures.has(row.size) && fixtures.get(row.size) !== row.fixtureSha256) {
      throw new Error('Inconsistent fixture hash across ' + row.size + '-note scenarios')
    }
    fixtures.set(row.size, row.fixtureSha256)
    if (row.noteCount !== row.size || !isObject(row.report) || row.report.note_count !== row.size) {
      throw new Error('Measured note count differs from expected ' + row.size + ' notes in ' + caseKey)
    }
    if (row.condition === 'cold') {
      if (!isObject(row.cacheReset) || !['fresh-volume', 'os-cache-purge'].includes(row.cacheReset.method)
        || typeof row.cacheReset.evidence !== 'string' || !row.cacheReset.evidence.trim()) {
        throw new Error('Cold cache reset proof required for ' + caseKey)
      }
    } else if (row.warmed !== true) throw new Error('Warm run must attest its primed cache: ' + caseKey)
    const expectedScenario = row.mode === 'scan' ? 'vault-scan' : 'warm-search'
    if (row.report.scenario !== expectedScenario) {
      throw new Error('Invalid CLI report scenario for ' + caseKey)
    }
    if (typeof row.report.within_budget !== 'boolean') {
      throw new Error('Invalid CLI report within_budget result for ' + caseKey)
    }
    const samples = row.report.samples_ms
    if (!Array.isArray(samples) || samples.length < 3 || samples.length > 1000
      || samples.some((value) => !finite(value) || value <= 0)) {
      throw new Error('Invalid strictly positive finite samples/iterations for ' + caseKey)
    }
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    if (!finite(row.report.mean_ms) || row.report.mean_ms <= 0
      || // Precision-aware consistency: the previous 0.5 ms absolute allowance
      // could validate a mean hundreds of times larger than sub-ms samples.
      Math.abs(mean - row.report.mean_ms) > Math.max(0.000001, mean * 0.01)) {
      throw new Error('Reported mean inconsistent with samples for ' + caseKey)
    }
    const expectedBudget = row.mode === 'scan' ? 500 + 150 * Math.floor(row.size / 1000) : 100
    if (row.report.budget_ms !== expectedBudget) {
      throw new Error('Invalid native CLI budget threshold for ' + caseKey)
    }
    // Reported means permit small display rounding differences, but those
    // differences must never reverse the verdict of the actual sample mean.
    if (row.report.within_budget !== (row.report.mean_ms <= expectedBudget)
      || row.report.within_budget !== (mean <= expectedBudget)) {
      throw new Error('CLI budget verdict contradicts reported or recomputed measured mean for ' + caseKey)
    }
    byCase.set(caseKey, row)
  }

  const missing = []
  const summaries = []
  for (const size of SCALE_CASE_SIZES) for (const mode of SCALE_CASE_MODES) for (const condition of CONDITIONS) {
    const a = byCase.get(size + '/' + mode + '/' + condition + '/1')
    const b = byCase.get(size + '/' + mode + '/' + condition + '/2')
    if (!a) missing.push(size + '/' + mode + '/' + condition + '/1')
    if (!b) missing.push(size + '/' + mode + '/' + condition + '/2')
    if (a && b) {
      if (Date.parse(a.startedAt) === Date.parse(b.startedAt)) {
        throw new Error('Independent repeats require distinct UTC run start timestamps for ' + size + '/' + mode + '/' + condition)
      }
      const smaller = Math.min(a.report.mean_ms, b.report.mean_ms)
      const larger = Math.max(a.report.mean_ms, b.report.mean_ms)
      const mean = (smaller + larger) / 2
      summaries.push({ size, mode, condition, repeats: 2,
        meanMs: mean, minRepeatMs: smaller, maxRepeatMs: larger,
        spreadPercent: mean === 0 ? 0 : percent((larger - smaller) / mean * 100) })
    }
  }
  return {
    readyForReview: missing.length === 0,
    validRunCount: evidence.runs.length,
    missing,
    summaries,
  }
}
