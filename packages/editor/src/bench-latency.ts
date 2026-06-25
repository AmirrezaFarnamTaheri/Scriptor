import { performance } from 'node:perf_hooks'

import {
  prefixBlockquoteLine,
  prefixHeadingLine,
  unwrapSelectionText,
  wrapSelectionText,
} from './transform-logic.ts'

const iterations = Number(process.argv.find((arg) => arg.startsWith('--iterations='))?.split('=')[1] ?? 200)

const samples: number[] = []
for (let index = 0; index < iterations; index += 1) {
  const start = performance.now()
  wrapSelectionText('Sample paragraph text for editor latency probe.', '**')
  unwrapSelectionText('**Sample**', '**', '**', '**', '**')
  prefixHeadingLine('## Heading sample', 2)
  prefixBlockquoteLine('Quoted line sample')
  samples.push(performance.now() - start)
}

const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
const max = Math.max(...samples)
console.log(
  JSON.stringify({
    iterations,
    average_ms: Number(average.toFixed(3)),
    max_ms: Number(max.toFixed(3)),
    budget_ms: 16,
    within_budget: average < 16,
  }),
)

if (average >= 16) {
  process.exitCode = 1
}
