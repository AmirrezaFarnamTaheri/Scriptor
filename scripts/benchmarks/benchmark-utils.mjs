import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const BENCHMARK_EVIDENCE_SCHEMA_VERSION = 3
export const DEFAULT_MAX_REGRESSION_PERCENT = 15

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseBenchmarkReport(name, output) {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end < start) {
    throw new Error(`could not find JSON benchmark report for ${name}`)
  }

  let report
  try {
    report = JSON.parse(output.slice(start, end + 1))
  } catch (error) {
    throw new Error(
      `could not parse benchmark report for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  if (typeof report !== 'object' || report === null || Array.isArray(report)) {
    throw new Error(`benchmark report for ${name} must be an object`)
  }
  const mean_ms = [report.mean_ms, report.meanMs, report.average_ms].find(finiteNumber)
  if (!finiteNumber(mean_ms)) {
    throw new Error(`benchmark report for ${name} has no finite mean_ms`)
  }
  const samples_ms = Array.isArray(report.samples_ms)
    ? report.samples_ms
    : Array.isArray(report.samples)
      ? report.samples
      : []
  if (samples_ms.some((value) => !finiteNumber(value) || value < 0)) {
    throw new Error(`benchmark report for ${name} contains invalid samples`)
  }
  return { ...report, mean_ms, samples_ms }
}

export function summarizeSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.some((value) => !finiteNumber(value) || value < 0)) {
    throw new Error('benchmark samples must be a non-empty array of finite non-negative numbers')
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  return {
    mean_ms: mean,
    min_ms: sorted[0],
    p50_ms: percentile(0.5),
    p95_ms: percentile(0.95),
    max_ms: sorted.at(-1),
  }
}

export function evaluateBenchmarkThreshold(name, report, baseline, { maxRegressionPercent = DEFAULT_MAX_REGRESSION_PERCENT } = {}) {
  if (!finiteNumber(baseline) || baseline <= 0) throw new Error(`missing positive numeric baseline: ${name}`)
  if (!finiteNumber(maxRegressionPercent) || maxRegressionPercent < 0) throw new Error('max regression percent must be non-negative')
  const measured = report.mean_ms
  if (!finiteNumber(measured) || measured < 0) throw new Error(`benchmark ${name} has no finite non-negative mean_ms`)
  const limit = baseline + (baseline * maxRegressionPercent) / 100
  return {
    benchmarkId: name,
    unit: 'ms',
    measuredMs: measured,
    baselineMs: baseline,
    maxRegressionPercent,
    limitMs: limit,
    deltaPercent: Number(((measured / baseline - 1) * 100).toFixed(1)),
    distribution: {
      minMs: report.min_ms ?? null,
      p50Ms: report.p50_ms ?? null,
      p95Ms: report.p95_ms ?? null,
      maxMs: report.max_ms ?? null,
    },
    iterations: report.iterations ?? report.samples_ms?.length ?? null,
    samplesMs: report.samples_ms ?? [],
    noteCount: report.note_count ?? null,
    producerBudgetMs: report.budget_ms ?? null,
    producerWithinBudget: report.within_budget ?? null,
    pass: measured <= limit,
  }
}

export function hashDirectory(root) {
  const absoluteRoot = path.resolve(root)
  const files = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) files.push(path.relative(absoluteRoot, absolute).replaceAll('\\', '/'))
    }
  }

  walk(absoluteRoot)
  files.sort((a, b) => a.localeCompare(b))
  const tree = crypto.createHash('sha256')
  for (const relative of files) {
    const contents = fs.readFileSync(path.join(absoluteRoot, relative))
    tree.update(relative)
    tree.update('\0')
    tree.update(String(contents.length))
    tree.update('\0')
    tree.update(crypto.createHash('sha256').update(contents).digest('hex'))
    tree.update('\0')
  }
  return { sha256: tree.digest('hex'), fileCount: files.length }
}
