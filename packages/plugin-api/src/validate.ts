import { runManifestValidationTests } from './manifest.ts'
import { runHostSandboxTests } from './host.ts'
import { listBundledMarketplaceCatalog } from './marketplace.ts'
import { runRegistryTests } from './registry.ts'
import { runSandboxTests } from './sandbox.ts'

export async function runPluginValidation(): Promise<string[]> {
  const failures = [
    ...runManifestValidationTests(),
    ...runRegistryTests(),
    ...runSandboxTests(),
    ...runHostSandboxTests(),
  ]
  if (listBundledMarketplaceCatalog().length === 0) {
    failures.push('marketplace catalog is empty')
  }
  return failures
}
