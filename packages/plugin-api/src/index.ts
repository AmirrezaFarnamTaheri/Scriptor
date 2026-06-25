export type {
  PluginActivation,
  PluginCapability,
  PluginContributions,
  PluginManifest,
  PluginPermission,
  PluginRuntimePolicy,
} from '@scriptor/core/contracts/plugin'

export { PLUGIN_API_VERSION, validatePluginManifest, runManifestValidationTests } from './manifest.ts'
export type { ManifestValidationResult } from './manifest.ts'
export {
  PluginRegistry,
  runRegistryTests,
} from './registry.ts'
export type { LoadedPlugin, PluginRegistryEntry, PluginRegistrySnapshot } from './registry.ts'
export { collectContributions } from './contributions.ts'
export { PluginHost, runHostSandboxTests } from './host.ts'
export {
  createVaultQueryAdapter,
} from './vault-query.ts'
export type {
  ReadOnlyVaultQuery,
  VaultQueryBacklink,
  VaultQueryHealthIssue,
  VaultQuerySearchHit,
} from './vault-query.ts'
export { evaluateSandboxCapability, assertSandboxCapability, runSandboxTests } from './sandbox.ts'
export type { SandboxCapability, SandboxDecision } from './sandbox.ts'
export { runPluginValidation } from './validate.ts'
export {
  fetchRemoteMarketplaceCatalog,
  listBundledMarketplaceCatalog,
  loadAllBundledManifests,
  loadMarketplaceCatalog,
  resolveMarketplaceManifest,
} from './marketplace.ts'
export type { MarketplaceListing } from './marketplace.ts'
