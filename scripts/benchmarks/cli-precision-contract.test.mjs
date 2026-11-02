import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const cliBench = fs.readFileSync(path.resolve(import.meta.dirname, '../../crates/cli/src/bench.rs'), 'utf8')

test('MAT-023: real scan/search CLI samples retain submillisecond precision', () => {
  assert.doesNotMatch(cliBench, /started\.elapsed\(\)\.as_millis\(\)\s+as\s+u64/)
  assert.match(cliBench, /fn high_precision_ms\(elapsed: Duration\) -> f64/)
  assert.match(cliBench, /elapsed\.as_secs_f64\(\)\s*\*\s*1_000\.0/)
  assert.equal((cliBench.match(/samples_ms: Vec<f64>/g) ?? []).length, 3)
  assert.match(cliBench, /fn measured_durations_keep_microsecond_precision\(\)/)
})


test('MAT-023: hosted PR measurements bind the collector SHA to the checked-out exact source commit', () => {
  const ref = '${{ github.event.pull_request.head.sha || github.sha }}'
  for (const name of ['mat023-hosted-warm.yml', 'perf-trends.yml']) {
    const workflow = fs.readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows', name), 'utf8')
    assert.ok(workflow.includes('ref: ' + ref), name + ' must checkout exact source')
    assert.ok(workflow.includes('--source-sha "' + ref + '"'), name + ' must pass the same source SHA')
  }
})
