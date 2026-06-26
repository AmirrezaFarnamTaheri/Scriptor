/**
 * WASM plugin host ABI scaffold (BL-39). Full sandbox runtime is not yet wired.
 */
export const WASM_PLUGIN_ABI_VERSION = 1

export interface WasmPluginManifest {
  id: string
  wasmPath: string
  abiVersion: number
  capabilities: string[]
}

export function validateWasmPluginManifest(manifest: WasmPluginManifest): string[] {
  const errors: string[] = []
  if (!manifest.id.trim()) errors.push('id is required')
  if (!manifest.wasmPath.trim()) errors.push('wasmPath is required')
  if (manifest.abiVersion !== WASM_PLUGIN_ABI_VERSION) {
    errors.push(`unsupported abiVersion ${manifest.abiVersion}`)
  }
  if (manifest.capabilities.length === 0) errors.push('at least one capability is required')
  return errors
}

export async function loadWasmPlugin(_manifest: WasmPluginManifest): Promise<null> {
  // Placeholder until BL-39 runtime lands; safe mode plugins remain JS-only today.
  return null
}
