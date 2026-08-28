import { performance } from 'node:perf_hooks'
import { generateMediumPreviewFixture } from './benchmark-fixtures.ts'
import { renderMarkdownPreview } from './preview.ts'

const iterations = Number(process.argv.find((arg) => arg.startsWith('--iterations='))?.split('=')[1] ?? 5)
if (!Number.isSafeInteger(iterations) || iterations <= 0) throw new Error('iterations must be a positive integer')

const source = generateMediumPreviewFixture()
const samples_ms: number[] = []
let outputLength = 0
for (let index = 0; index < iterations; index += 1) {
  const started = performance.now()
  const html = renderMarkdownPreview(source)
  samples_ms.push(performance.now() - started)
  outputLength = html.length
  if (outputLength === 0) throw new Error('preview benchmark produced empty HTML')
}
const sorted = [...samples_ms].sort((a, b) => a - b)
const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]
const mean = samples_ms.reduce((sum, value) => sum + value, 0) / samples_ms.length
const report = {
  scenario: 'preview-render-medium',
  fixture: 'renderer:medium',
  iterations,
  samples_ms: samples_ms.map((value) => Number(value.toFixed(3))),
  mean_ms: Number(mean.toFixed(3)),
  min_ms: Number(sorted[0].toFixed(3)),
  p50_ms: Number(percentile(0.5).toFixed(3)),
  p95_ms: Number(percentile(0.95).toFixed(3)),
  max_ms: Number(sorted.at(-1)!.toFixed(3)),
  output_bytes: outputLength,
  budget_ms: 250,
  within_budget: mean <= 250,
}
console.log(JSON.stringify(report))
if (!report.within_budget) process.exitCode = 1
