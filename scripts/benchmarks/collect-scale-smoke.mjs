#!/usr/bin/env node
/**
 * MAT-023: collect source-bound, real CLI *warm* scan/search measurements.
 * No OS cache purge or cold-start measurement is performed here. A partial
 * matrix must NEVER be labeled ready for MAT-023 performance acceptance.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { hashDirectory, parseBenchmarkReport } from './benchmark-utils.mjs'
import { evaluateScaleEvidence, SCALE_CASE_SIZES, SCALE_CASE_MODES } from './scale-evidence.mjs'

const NAME_TO_COUNT = { '100': 100, '1k': 1000, '5k': 5000, '25k': 25000 }
const SIZE_NAMES = Object.keys(NAME_TO_COUNT)

export function parseCollectorSizes(value) {
  if (value === 'all') return [...SCALE_CASE_SIZES]
  if (Object.hasOwn(NAME_TO_COUNT, value)) return [NAME_TO_COUNT[value]]
  throw new Error(`Unsupported benchmark size ${String(value)}; expected all, ${SIZE_NAMES.join(', ')}`)
}

function runExecutable(executable, args, timeout) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 1024 * 1024,
  })
  if (result.error) throw new Error(`CLI invocation failed: ${result.error.message}`)
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function ensureCommandSuccess(result, command) {
  if (!result || result.status !== 0) {
    throw new Error(`CLI ${command} failed (exit ${result?.status ?? 'unknown'}): ${String(result?.stderr ?? '').slice(0, 400)}`)
  }
}

function assertReport(report, size, mode) {
  if (report.scenario !== (mode === 'scan' ? 'vault-scan' : 'warm-search')) {
    throw new Error(`Unexpected CLI scenario for ${size}/${mode}`)
  }
  if (report.note_count !== size) throw new Error(`Measured note count differs from ${size} for ${mode}`)
  if (typeof report.within_budget !== 'boolean' || !Array.isArray(report.samples_ms)
    || report.samples_ms.length < 3 || !Number.isFinite(report.mean_ms)) {
    throw new Error(`Missing successful measured samples/budget for ${size}/${mode}`)
  }
}

/**
 * The Scriptor CLI deliberately exits 4 when a measured latency breaches its
 * budget, AFTER emitting its authoritative JSON. Preserve that real result
 * instead of silently losing negative performance evidence. All other errors
 * and contradictory exit-status/report pairs fail closed.
 */
function measuredCliReport(result, size, mode, phase) {
  if (!result || (result.status !== 0 && result.status !== 4)) {
    ensureCommandSuccess(result, `${mode} ${phase}`)
  }
  const report = parseBenchmarkReport(`${size}/${mode}/${phase}`, result.stdout)
  assertReport(report, size, mode)
  if ((result.status === 0) !== report.within_budget) {
    throw new Error(`Contradictory CLI budget exit code/report for ${size}/${mode}/${phase}`)
  }
  return report
}

/**
 * Runs each repeated measurement in a distinct native process on a fresh
 * generated fixture and invokes a separate warm-up process before recording.
 * The CLI reports warm search samples after rebuilding the FTS5 index.
 * Cold cache/first-open/startup/editor/RAM/package metrics are NOT measured.
 */
export function collectWarmScaleEvidence({
  cliPath, sourceCommit, sizes, workRoot, host, toolchain,
  execute = (args) => runExecutable(cliPath, args, 15 * 60 * 1000),
  now = () => new Date(),
  onProgress = () => {},
}) {
  if (typeof sourceCommit !== 'string' || !/^[a-f\d]{40}$/i.test(sourceCommit)) {
    throw new Error('An exact source commit SHA is required')
  }
  if (!Array.isArray(sizes) || sizes.length === 0 || new Set(sizes).size !== sizes.length
    || sizes.some(size => !SCALE_CASE_SIZES.includes(size))) {
    throw new Error('Unsupported or duplicate benchmark sizes')
  }
  if (!fs.existsSync(workRoot) || !fs.statSync(workRoot).isDirectory()) {
    throw new Error('Benchmark workRoot must exist as an isolated directory')
  }
  const runs = []
  // Every report, including the first empty snapshot, is valid incomplete
  // evidence. Timed-out 25k operations must not erase independently measured
  // smaller cases from the uploaded artifact.
  const snapshot = () => ({
    schemaVersion: 1, sourceCommit, host, toolchain, runs: [...runs],
    collector: {
      kind: 'real-cli-warm-only',
      coldCacheVerified: false, startupMeasured: false, editorMeasured: false,
      residentMemoryMeasured: false, packagedArtifactMeasured: false,
      overBudgetCases: runs.filter(row => !row.report.within_budget)
        .map(row => ({ size: row.size, mode: row.mode, replicate: row.replicate })),
      note: 'Partial or complete warm-only CLI collection, not cold/OS-cache proof or capability acceptance.',
    },
  })
  onProgress(snapshot())
  const repeatFixtureHashes = new Map()
  for (const size of sizes) for (const mode of SCALE_CASE_MODES) for (const replicate of [1, 2]) {
    const dir = path.join(workRoot, `vault-${size}-${mode}-${replicate}`)
    if (fs.existsSync(dir)) throw new Error(`Refusing to reuse non-fresh benchmark fixture ${dir}`)
    const generate = execute(['generate-vault', dir, '--count', String(size), '--prefix', 'notes'])
    ensureCommandSuccess(generate, 'generate-vault')
    if (JSON.parse(generate.stdout).note_count !== size) throw new Error('Generated note count mismatch')
    const fixture = hashDirectory(dir)
    if (fixture.fileCount !== size) throw new Error(`Synthetic fixture contains ${fixture.fileCount}, not ${size}, files`)
    const priorHash = repeatFixtureHashes.get(size)
    if (priorHash !== undefined && priorHash !== fixture.sha256) {
      throw new Error(`Fixture drift across independently generated ${size}-note runs`)
    }
    repeatFixtureHashes.set(size, fixture.sha256)
    const commandArgs = mode === 'scan'
      ? ['bench-scan', dir, '--iterations', '3']
      : ['bench-search', dir, 'note', '--iterations', '3']
    const warmup = execute(commandArgs)
    measuredCliReport(warmup, size, mode, 'warm-up')
    const startedAt = now().toISOString()
    const observed = execute(commandArgs)
    const report = measuredCliReport(observed, size, mode, 'measurement')
    runs.push({
      size, mode, condition: 'warm', replicate,
      runId: `cli-${size}-${mode}-warm-${replicate}`,
      startedAt, fixtureSha256: fixture.sha256,
      noteCount: size, warmed: true, report,
    })
    onProgress(snapshot())
  }
  const evidence = snapshot()
  const assessment = evaluateScaleEvidence(evidence)
  if (assessment.readyForReview || assessment.missing.length === 0) {
    throw new Error('Warm-only collector must never produce complete cold/warm MAT-023 evidence')
  }
  return evidence
}

/** Commit only validated, source-bound partial evidence to disk.
 * A temporary file and rename keep a killed benchmark from publishing
 * truncated or synthesized JSON. This output is never MAT acceptance.
 */
export function writeWarmScaleEvidence(outputPath, evidence, cliSha256) {
  if (typeof cliSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(cliSha256)) {
    throw new Error('The compiled CLI must have a SHA-256 identity')
  }
  const snapshot = { ...evidence, collector: { ...evidence.collector, cliSha256 } }
  const assessment = evaluateScaleEvidence(snapshot)
  if (assessment.readyForReview) {
    throw new Error('Warm-only measurements cannot certify the complete scale matrix')
  }
  const output = path.resolve(outputPath)
  const temporary = output + '.tmp'
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2) + '\n')
  fs.renameSync(temporary, output)
  return snapshot
}

function readVersion(executable) {
  const result = runExecutable(executable, ['--version'], 15_000)
  ensureCommandSuccess(result, `${executable} --version`)
  return result.stdout.trim()
}

/** Prevent operator-supplied commit metadata from masquerading as checkout provenance. */
export function assertExactSourceCommit(expected, checkedOut) {
  if (typeof expected !== 'string' || typeof checkedOut !== 'string'
    || !/^[a-f0-9]{40}$/i.test(expected) || !/^[a-f0-9]{40}$/i.test(checkedOut)
    || expected.toLowerCase() !== checkedOut.toLowerCase()) {
    throw new Error('MAT-023 source SHA does not match the checked-out exact Git HEAD')
  }
}

function parseOptions(args) {
  const values = {}
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || i + 1 >= args.length) throw new Error('Expected --key value arguments')
    if (!['--cli', '--source-sha', '--size', '--output'].includes(args[i]) || values[args[i]]) {
      throw new Error(`Unknown or repeated option ${args[i]}`)
    }
    values[args[i]] = args[i + 1]
  }
  if (!values['--cli'] || !values['--source-sha'] || !values['--size'] || !values['--output']) {
    throw new Error('Usage: node collect-scale-smoke.mjs --cli <binary> --source-sha <40-hex> --size all|100|1k|5k|25k --output <json>')
  }
  return values
}

function main() {
  const opts = parseOptions(process.argv.slice(2))
  const gitHead = runExecutable('git', ['rev-parse', 'HEAD'], 15_000)
  ensureCommandSuccess(gitHead, 'git rev-parse HEAD')
  assertExactSourceCommit(opts['--source-sha'], gitHead.stdout.trim())
  const cliPath = path.resolve(opts['--cli'])
  if (!fs.statSync(cliPath).isFile()) throw new Error('Compiled CLI binary not found')
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-warm-scale-'))
  try {
    const host = {
      id: process.env.RUNNER_NAME || os.hostname(),
      os: os.platform(), arch: os.arch(), cpu: os.cpus()[0]?.model || 'unknown CPU',
      memoryMb: Math.round(os.totalmem() / 1024 / 1024),
    }
    const toolchain = { node: process.version, rustc: readVersion('rustc'), cargo: readVersion('cargo') }
    const output = path.resolve(opts['--output'])
    fs.mkdirSync(path.dirname(output), { recursive: true })
    // Preserve the original no-overwrite rule for an operator-supplied path,
    // while allowing this one collector to atomically replace its own progress.
    fs.closeSync(fs.openSync(output, 'wx'))
    const binarySha256 = crypto.createHash('sha256').update(fs.readFileSync(cliPath)).digest('hex')
    const evidence = collectWarmScaleEvidence({
      cliPath, sourceCommit: opts['--source-sha'],
      sizes: parseCollectorSizes(opts['--size']), workRoot, host, toolchain,
      onProgress: partial => {
        writeWarmScaleEvidence(output, partial, binarySha256)
        process.stdout.write(`Recorded ${partial.runs.length} native warm cases so far; cold matrix incomplete.\n`)
      },
    })
    const assessment = evaluateScaleEvidence(evidence)
    process.stdout.write(`Measured ${evidence.runs.length} warm CLI scenarios, ${assessment.missing.length} cold/other cases outstanding. Evidence: ${output}\n`)
    if (evidence.collector.overBudgetCases.length > 0) {
      throw new Error(`${evidence.collector.overBudgetCases.length} benchmark runs exceeded their CLI performance budget; measured failure evidence was saved`)
    }
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main() } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
