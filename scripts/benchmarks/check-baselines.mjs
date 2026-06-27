import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const BASELINES_PATH = join(ROOT, 'perf-baselines.json')

function loadBaselines() {
  if (!existsSync(BASELINES_PATH)) {
    console.error('perf-baselines.json not found')
    process.exit(1)
  }
  return JSON.parse(readFileSync(BASELINES_PATH, 'utf8'))
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 120_000 })
  } catch (err) {
    return err.stdout ?? ''
  }
}

function parseMeanMs(output) {
  for (const line of output.split('\n')) {
    try {
      const obj = JSON.parse(line)
      if (typeof obj.mean_ms === 'number') return obj.mean_ms
    } catch {}
  }
  return null
}

function checkThreshold(name, measured, baseline) {
  const limit = baseline * 1.15
  const pass = measured <= limit
  const pct = ((measured / baseline - 1) * 100).toFixed(1)
  return { name, measured, baseline, limit, pass, pct: Number(pct) }
}

const baselines = loadBaselines()
const report = { timestamp: new Date().toISOString(), results: [] }

console.log('==> vault_scan benchmark')
const scanOut = run('cargo run -p scriptor-cli -- bench-scan packages/test-fixtures/vaults/minimal --iterations 3')
const scanMs = parseMeanMs(scanOut) ?? 0
report.results.push(checkThreshold('vault_scan_1k_ms', scanMs, baselines.vault_scan_1k_ms))

console.log('==> search benchmark')
const searchOut = run('cargo run -p scriptor-cli -- bench-search packages/test-fixtures/vaults/minimal Research --iterations 3')
const searchMs = parseMeanMs(searchOut) ?? 0
report.results.push(checkThreshold('search_1k_ms', searchMs, baselines.search_1k_ms))

console.log('==> canvas_snapshot benchmark')
const canvasOut = run('cargo run -p scriptor-cli -- bench-canvas-snapshot packages/test-fixtures/canvas/overlap-blocks.json --iterations 3')
const canvasMs = parseMeanMs(canvasOut) ?? 0
report.results.push(checkThreshold('canvas_snapshot_ms', canvasMs, baselines.canvas_snapshot_ms))

console.log('\n=== Performance Baseline Report ===')
const failures = []
for (const r of report.results) {
  const status = r.pass ? 'PASS' : 'FAIL'
  console.log(`  ${r.name}: ${r.measured.toFixed(1)}ms / ${r.baseline}ms baseline (${r.pct}%) [${status}]`)
  if (!r.pass) failures.push(r)
}

report.pass = failures.length === 0
console.log(JSON.stringify(report, null, 2))

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} benchmark(s) exceeded threshold by >15%`)
  process.exit(1)
}

console.log('\nAll benchmarks within thresholds.')
