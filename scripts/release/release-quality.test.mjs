import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RELEASE_QUALITY_CHECKS,
  runReleaseQualityChecks,
} from './release-quality.mjs'

test('release quality owns a complete release-proof command set', () => {
  const ids = RELEASE_QUALITY_CHECKS.map((item) => item.id)
  assert.deepEqual(ids, [
    'governance',
    'source-contracts',
    'contract-typecheck',
    'mcp-validation',
    'lint',
    'build',
    'release-smoke',
    'accessibility-axe',
    'e2e',
    'visual-regression',
    'performance',
  ])
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(RELEASE_QUALITY_CHECKS.at(-1).output, 'performance-evidence.json')
})

test('release quality records every check and fails closed after a failing check', async () => {
  const calls = []
  const evidence = await runReleaseQualityChecks({
    source: { schemaVersion: 2, sourceCommit: 'abc', sourceTreeSha256: 'tree' },
    version: '1.0.1',
    createdAt: '2026-08-27T00:00:00.000Z',
    execute: async (check) => {
      calls.push(check.id)
      return { status: check.id === 'lint' ? 'failed' : 'passed', durationMs: 3 }
    },
  })

  assert.equal(evidence.schemaVersion, 1)
  assert.equal(evidence.pass, false)
  assert.equal(evidence.checks.length, RELEASE_QUALITY_CHECKS.length)
  assert.deepEqual(calls, RELEASE_QUALITY_CHECKS.map((item) => item.id))
  assert.equal(evidence.checks.find((item) => item.id === 'lint').status, 'failed')
})
