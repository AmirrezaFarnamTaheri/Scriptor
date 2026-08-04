import { runManifestValidationTests } from './manifest.ts'
import { runHostSandboxTests } from './host.ts'
import { listBundledMarketplaceCatalog } from './marketplace.ts'
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

export async function runPluginValidation(): Promise<string[]> {
  const failures = [
    ...runManifestValidationTests(),
    ...runRegistryTests(),
    ...runSandboxTests(),
    ...(await runHostSandboxTests()),
    ...runWasmHostScaffoldTests(),
  ]
  if (listBundledMarketplaceCatalog().length === 0) {
    failures.push('marketplace catalog is empty')
  }
  return failures
}
