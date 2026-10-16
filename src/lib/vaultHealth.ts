/**
 * Shared presentation for the vault health snapshot.
 *
 * The cache status arrives from the indexer as a lowercase wire value
 * (`fresh` | `stale` | `rebuilding`). The inspector, the workspace footer and
 * the health dashboard all display it, and each one used to decide how to
 * present it independently — which is how the same metric ended up reading
 * `Fresh` in one panel and `fresh` in another.
 */
import type { I18nValue } from './i18n'
import type { VaultHealthReport } from '../types/vault'

export type Translate = I18nValue['t']

export function cacheStatusLabel(t: Translate, status: VaultHealthReport['cache_status']): string {
  if (status === 'fresh') return t('inspector.health.cacheFresh')
  if (status === 'stale') return t('inspector.health.cacheStale')
  return t('inspector.health.cacheRebuilding')
}

/** One consistent health state for the inspector and all vault status badges. */
export function vaultHealthStatus(health: VaultHealthReport | null): 'loading' | 'cacheRebuilding' | 'needsReview' | 'good' {
  if (!health) return 'loading'
  if (health.cache_status === 'rebuilding') return 'cacheRebuilding'
  if (health.cache_status !== 'fresh' || [
    health.broken_links, health.orphan_assets, health.duplicate_titles,
    health.invalid_frontmatter, health.unresolved_citations, health.slow_exports,
  ].some(count => count !== 0)) return 'needsReview'
  return 'good'
}

/** Hide detailed metrics only when nothing needs attention. */
export function isVaultHealthClear(health: VaultHealthReport | null): boolean {
  return vaultHealthStatus(health) === 'good'
}
