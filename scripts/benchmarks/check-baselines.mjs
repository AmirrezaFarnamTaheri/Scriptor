#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { getSourceIdentity } from '../release/source-identity.mjs'
import {
  BENCHMARK_EVIDENCE_SCHEMA_VERSION,
  evaluateBenchmarkThreshold,
  hashDirectory,
  parseBenchmarkReport,
  summarizeSamples,
} from './benchmark-utils.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const baselinesPath = path.join(root, 'perf-baselines.json')
const vaultSize = 1000
const iterations = 3
const outputArg = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length)
const outputPath = path.resolve(root, outputArg ?? 'artifacts/performance/performance-evidence.json')

function fail(message) {
  throw new Error(message)
}

function run(file, args, options = {}) {
  try {
    return execFileSync(file, args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 10 * 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    })
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n')
    if (output) process.stderr.write(`${output}\n`)
    fail(`${file} ${args.join(' ')} exited non-zero`)
  }
}

function toolVersion(file, args = ['--version']) {
  try { return run(file, args, { timeout: 30_000 }).trim() } catch { return null }
}

if (!fs.existsSync(baselinesPath)) fail('perf-baselines.json not found')
const baselines = JSON.parse(fs.readFileSync(baselinesPath, 'utf8'))
const required = ['vault_scan_1k_ms','search_1k_ms','canvas_snapshot_ms','editor_frame_ms','preview_render_ms','startup_ms']
for (const key of required) {
  if (typeof baselines[key] !== 'number' || !Number.isFinite(baselines[key]) || baselines[key] <= 0) {
    fail(`baseline not defined as a positive finite number: ${key}`)
  }
}

console.log('==> build release CLI once')
run('cargo', ['build', '--locked', '--release', '-p', 'scriptor-cli'])
const executable = path.join(root, 'target', 'release', process.platform === 'win32' ? 'scriptor.exe' : 'scriptor')
if (!fs.existsSync(executable)) fail(`release CLI not found after build: ${executable}`)

const source = getSourceIdentity({ root, allowArchive: true })
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-perf-'))
const syntheticVault = path.join(tempRoot, 'synthetic-1k')
try {
  console.log(`==> generate canonical ${vaultSize}-note synthetic vault`)
  run(executable, ['generate-vault', syntheticVault, '--count', String(vaultSize), '--prefix', 'notes'])
  const noteCount = fs.readdirSync(path.join(syntheticVault, 'notes'), { recursive: true })
    .filter((name) => String(name).toLowerCase().endsWith('.md')).length
  if (noteCount !== vaultSize) fail(`synthetic vault cardinality mismatch: expected ${vaultSize}, found ${noteCount}`)
  const fixtureIdentity = hashDirectory(syntheticVault)

  const results = []
  const record = (name, raw, expectedNotes = null) => {
    const report = parseBenchmarkReport(name, raw)
    if (expectedNotes !== null && report.note_count !== expectedNotes) {
      fail(`${name} measured ${report.note_count ?? 'unknown'} notes; expected ${expectedNotes}`)
    }
    results.push(evaluateBenchmarkThreshold(name, report, baselines[name]))
  }
  const benchmark = (name, args, expectedNotes = null) => {
    console.log(`==> ${name}`)
    record(name, run(executable, args), expectedNotes)
  }

  benchmark('vault_scan_1k_ms', ['bench-scan', syntheticVault, '--iterations', String(iterations)], vaultSize)
  run(executable, ['--in-process', 'rebuild-index', syntheticVault])
  benchmark('search_1k_ms', ['bench-search', syntheticVault, 'note', '--iterations', String(iterations)], vaultSize)
  benchmark('canvas_snapshot_ms', ['bench-canvas-snapshot', 'packages/test-fixtures/canvas/overlap-blocks.json', '--iterations', String(iterations)])

  console.log('==> editor_frame_ms')
  record('editor_frame_ms', run('node', ['--experimental-strip-types', 'packages/editor/src/bench-latency.ts', `--iterations=${iterations * 50}`]))

  console.log('==> preview_render_ms')
  record('preview_render_ms', run('node', ['--experimental-strip-types', 'packages/renderer/src/bench-preview.ts', `--iterations=${iterations}`]))

  console.log('==> startup_ms')
  const startupSamples = []
  for (let index = 0; index < 6; index += 1) {
    const started = performance.now()
    run(executable, ['system-info'], { timeout: 30_000 })
    const elapsed = performance.now() - started
    if (index > 0) startupSamples.push(elapsed)
  }
  const startupSummary = summarizeSamples(startupSamples)
  record('startup_ms', JSON.stringify({
    scenario: 'warm-cli-startup',
    iterations: startupSamples.length,
    samples_ms: startupSamples,
    ...startupSummary,
  }))

  const evidence = {
    schemaVersion: BENCHMARK_EVIDENCE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    policy: { baselineFile: 'perf-baselines.json', maxRegressionPercent: 15 },
    source,
    host: { platform: os.platform(), release: os.release(), arch: os.arch(), cpuCount: os.cpus().length },
    toolchain: { node: process.version, cargo: toolVersion('cargo'), rustc: toolVersion('rustc') },
    fixture: {
      kind: 'synthetic', expectedNotes: vaultSize, actualNotes: noteCount,
      fileCount: fixtureIdentity.fileCount, sha256: fixtureIdentity.sha256,
    },
    results,
    pass: results.every((result) => result.pass),
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.benchmarkId}: ${result.measuredMs.toFixed(1)}ms <= ${result.limitMs.toFixed(1)}ms`)
  }
  console.log(`Performance evidence: ${path.relative(root, outputPath)}`)
  if (!evidence.pass) fail(`${results.filter((result) => !result.pass).length} benchmark(s) exceeded the 15% regression limit`)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}
