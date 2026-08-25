#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { hashDirectory, parseBenchmarkReport } from './benchmark-utils.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const baselinesPath = path.join(root, 'perf-baselines.json')
const vaultSize = 1000
const iterations = 3

function fail(message) {
  console.error(`FAILED: ${message}`)
  process.exit(1)
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
    if (output) console.error(output)
    fail(`${file} ${args.join(' ')} exited non-zero`)
  }
}

function checkThreshold(name, report, baseline) {
  const measured = report.mean_ms
  if (typeof baseline !== 'number' || !Number.isFinite(baseline)) fail(`missing numeric baseline: ${name}`)
  const limit = baseline * 1.15
  return {
    name,
    measured,
    baseline,
    limit,
    deltaPercent: Number(((measured / baseline - 1) * 100).toFixed(1)),
    distribution: {
      minMs: report.min_ms ?? null,
      p50Ms: report.p50_ms ?? null,
      p95Ms: report.p95_ms ?? null,
      maxMs: report.max_ms ?? null,
    },
    noteCount: report.note_count ?? null,
    pass: measured <= limit,
  }
}

if (!fs.existsSync(baselinesPath)) fail('perf-baselines.json not found')
const baselines = JSON.parse(fs.readFileSync(baselinesPath, 'utf8'))
const required = [
  'vault_scan_1k_ms',
  'search_1k_ms',
  'canvas_snapshot_ms',
  'editor_frame_ms',
  'preview_render_ms',
  'scan_single_iter_ms',
]
for (const key of required) if (!(key in baselines)) fail(`baseline not defined: ${key}`)

console.log('==> build release CLI and daemon once')
run('cargo', ['build', '--locked', '--release', '-p', 'scriptor-cli', '-p', 'scriptor-daemon'])
const executable = path.join(root, 'target', 'release', process.platform === 'win32' ? 'scriptor.exe' : 'scriptor')
if (!fs.existsSync(executable)) fail(`release CLI not found after build: ${executable}`)

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
  const benchmark = (name, args, baselineKey = name, expectedNotes = null) => {
    console.log(`==> ${name}`)
    const output = run(executable, args)
    const report = parseBenchmarkReport(name, output)
    if (expectedNotes !== null && report.note_count !== expectedNotes) {
      fail(`${name} measured ${report.note_count ?? 'unknown'} notes; expected ${expectedNotes}`)
    }
    results.push(checkThreshold(baselineKey, report, baselines[baselineKey]))
  }

  benchmark('vault_scan_1k_ms', ['bench-scan', syntheticVault, '--iterations', String(iterations)], 'vault_scan_1k_ms', vaultSize)
  run(executable, ['--in-process', 'rebuild-index', syntheticVault])
  benchmark('search_1k_ms', ['bench-search', syntheticVault, 'note', '--iterations', String(iterations)], 'search_1k_ms', vaultSize)
  benchmark('canvas_snapshot_ms', ['bench-canvas-snapshot', 'packages/test-fixtures/canvas/overlap-blocks.json', '--iterations', String(iterations)])

  console.log('==> editor_frame_ms')
  const editorOutput = run('node', ['--experimental-strip-types', 'packages/editor/src/bench-latency.ts', `--iterations=${iterations * 50}`])
  const editorReport = parseBenchmarkReport('editor_frame_ms', editorOutput)
  results.push(checkThreshold('editor_frame_ms', editorReport, baselines.editor_frame_ms))

  console.log('==> preview_render_ms')
  const previewOutput = run('node', ['--experimental-strip-types', 'packages/renderer/src/bench-preview.ts', `--iterations=${iterations}`])
  const previewReport = parseBenchmarkReport('preview_render_ms', previewOutput)
  results.push(checkThreshold('preview_render_ms', previewReport, baselines.preview_render_ms))

  // NOTE: this is a single-pass vault scan, NOT application startup.
  // Packaged-shell startup instrumentation is a separate roadmap item.
  console.log('==> scan_single_iter_ms')
  const startupOutput = run(executable, ['bench-scan', syntheticVault, '--iterations', '1'])
  const startupReport = parseBenchmarkReport('scan_single_iter_ms', startupOutput)
  results.push(checkThreshold('scan_single_iter_ms', startupReport, baselines.scan_single_iter_ms))

  const report = {
    schemaVersion: 2,
    timestamp: new Date().toISOString(),
    executable,
    fixture: {
      kind: 'synthetic',
      expectedNotes: vaultSize,
      actualNotes: noteCount,
      fileCount: fixtureIdentity.fileCount,
      sha256: fixtureIdentity.sha256,
      path: syntheticVault,
    },
    iterations,
    results,
    pass: results.every((result) => result.pass),
  }
  for (const result of results) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}: ${result.measured.toFixed(1)}ms <= ${result.limit.toFixed(1)}ms`)
  }
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) fail(`${results.filter((result) => !result.pass).length} benchmark(s) exceeded the 15% regression limit`)
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true })
}
