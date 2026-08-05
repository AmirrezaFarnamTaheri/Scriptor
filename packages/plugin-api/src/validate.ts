import { runManifestValidationTests } from './manifest.ts'
import { runHostSandboxTests } from './host.ts'
import { listBundledMarketplaceCatalog, resolveMarketplaceManifest } from './marketplace.ts'
import { runRegistryTests } from './registry.ts'
import { runSandboxTests } from './sandbox.ts'
import { validateWasmPluginManifest, WASM_PLUGIN_ABI_VERSION } from './wasm-host.ts'

function runWasmHostScaffoldTests(): string[] {
  const failures: string[] = []
  const valid = validateWasmPluginManifest({
    id: 'sample',
    wasmPath: 'plugins/sample.wasm',
    abiVersion: WASM_PLUGIN_ABI_VERSION,
    capabilities: ['read'],
  })
  if (valid.length > 0) {
    failures.push(`wasm manifest validation rejected valid manifest: ${valid.join(', ')}`)
  }
  const invalid = validateWasmPluginManifest({
    id: '',
    wasmPath: '',
    abiVersion: 0,
    capabilities: [],
  })
  if (invalid.length === 0) {
    failures.push('wasm manifest validation should reject empty manifest')
  }
  return failures
}

async function runMarketplaceCatalogTests(): Promise<string[]> {
  const failures: string[] = []
  for (const listing of listBundledMarketplaceCatalog()) {
    try {
      await resolveMarketplaceManifest(listing)
    } catch (error) {
      failures.push(
        `marketplace listing ${listing.id} failed manifest resolution: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  return failures
}

export async function runPluginValidation(): Promise<string[]> {
  const failures = [
    ...runManifestValidationTests(),
    ...runRegistryTests(),
    ...runSandboxTests(),
    ...(await runHostSandboxTests()),
    ...(await runMarketplaceCatalogTests()),
    ...runWasmHostScaffoldTests(),
  ]
  if (listBundledMarketplaceCatalog().length === 0) {
    failures.push('marketplace catalog is empty')
  }
  return failures
}
