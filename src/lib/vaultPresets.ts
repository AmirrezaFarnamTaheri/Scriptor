import { vaultReadNote, vaultSaveAsset } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

export async function loadVaultPresetJson<T>(relativePath: string): Promise<T | null> {
  if (!isNativeBridgeAvailable()) return null
  try {
    const document = await vaultReadNote(relativePath)
    return JSON.parse(document.markdown) as T
  } catch {
    return null
  }
}

export async function saveVaultPresetJson(relativePath: string, value: unknown): Promise<void> {
  if (!isNativeBridgeAvailable()) return
  const payload = `${JSON.stringify(value, null, 2)}\n`
  const bytes = Array.from(new TextEncoder().encode(payload))
  await vaultSaveAsset(relativePath, bytes)
}

export const VAULT_GRAPH_PRESETS_PATH = '.scriptor/presets/graph.json'
export const VAULT_SAVED_VIEWS_PATH = '.scriptor/presets/saved-views.json'
export const VAULT_SMART_COLLECTIONS_PATH = '.scriptor/presets/smart-collections.json'
