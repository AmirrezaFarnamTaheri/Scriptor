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
