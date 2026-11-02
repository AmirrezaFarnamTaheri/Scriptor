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
