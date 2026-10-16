import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { VaultHealthReport } from '../types/vault.ts'
import { isVaultHealthClear, vaultHealthStatus } from './vaultHealth.ts'

const healthy: VaultHealthReport = {
  vault_id: 'example',
  broken_links: 0,
  orphan_assets: 0,
  duplicate_titles: 0,
  invalid_frontmatter: 0,
  unresolved_citations: 0,
  indexed_notes: 10,
  total_words: 3000,
  slow_exports: 0,
  cache_status: 'fresh',
}

test('vault status stays honest before and during indexing', () => {
  assert.equal(vaultHealthStatus(null), 'loading')
  assert.equal(vaultHealthStatus({ ...healthy, cache_status: 'rebuilding' }), 'cacheRebuilding')
  assert.equal(vaultHealthStatus({ ...healthy, cache_status: 'stale' }), 'needsReview')
  assert.equal(vaultHealthStatus(healthy), 'good')
})

test('all health checks matter before collapsing metrics as healthy', () => {
  assert.equal(isVaultHealthClear(healthy), true)
  for (const key of [
    'broken_links', 'orphan_assets', 'duplicate_titles', 'invalid_frontmatter',
    'unresolved_citations', 'slow_exports',
  ] as const) {
    const report = { ...healthy, [key]: 1 }
    assert.equal(vaultHealthStatus(report), 'needsReview', `${key} must not claim Good`)
    assert.equal(isVaultHealthClear(report), false, `${key} must remain visible`)
  }
  assert.equal(isVaultHealthClear(null), false)
  assert.equal(isVaultHealthClear({ ...healthy, cache_status: 'stale' }), false)
})
