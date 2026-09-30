import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'
export interface AssetUsageReport { assets: Array<{ path: string; bytes: number; used_by: string[] }>; truncated: boolean; source: 'derived-link-index' }
export async function indexerAssetUsage(expectedVaultId: string): Promise<AssetUsageReport> {
  requireNative()
  const value = await invoke<unknown>('indexer_asset_usage', { expectedVaultId })
  if (!value || typeof value !== 'object') throw new Error('Invalid asset inventory')
  const result = value as AssetUsageReport
  if (!Array.isArray(result.assets) || result.assets.length > 10000 || typeof result.truncated !== 'boolean' || result.source !== 'derived-link-index'
    || result.assets.some(asset => !asset || typeof asset.path !== 'string' || typeof asset.bytes !== 'number' || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0
      || !Array.isArray(asset.used_by) || asset.used_by.some(path => typeof path !== 'string'))) throw new Error('Invalid asset inventory')
  return result
}
