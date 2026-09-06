import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PluginHost,
  PluginRegistry,
  collectContributions,
  createVaultQueryAdapter,
  listBundledMarketplaceCatalog,
  loadAllBundledManifests,
  loadMarketplaceCatalog,
  resolveMarketplaceManifest,
  type MarketplaceListing,
  type PluginConsent,
  type ReadOnlyVaultQuery,
} from '@scriptor/plugin-api'

import {
  indexerBacklinks,
  indexerSearch,
  vaultHealthDiagnostics,
  vaultReadNote,
} from '../bridge/commands'
import { loadPluginState, setPluginCapabilityEnabled } from '../bridge/plugin'
import { expectRecord, expectStringArray } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const PLUGIN_CONSENT_STORAGE_KEY = 'scriptor:plugins:consent'
const PLUGIN_CONSENT_SCHEMA_VERSION = 1

function validatePluginConsents(value: unknown): Record<string, PluginConsent> {
  const record = expectRecord(value, 'plugin consent store')
  return Object.fromEntries(
    Object.entries(record).map(([pluginId, rawConsent]) => {
      const consent = expectRecord(rawConsent, `plugin consent ${pluginId}`)
      const grantedPermissions = expectStringArray(
        consent.grantedPermissions,
        `plugin consent ${pluginId}.grantedPermissions`,
      ) as PluginConsent['grantedPermissions']
      const allowedVaultIds = expectStringArray(
        consent.allowedVaultIds,
        `plugin consent ${pluginId}.allowedVaultIds`,
      )
      const allowlistedHosts =
        consent.allowlistedHosts === undefined
          ? []
          : expectStringArray(consent.allowlistedHosts, `plugin consent ${pluginId}.allowlistedHosts`)
      const networkAccess = consent.networkAccess === 'allowlist' ? 'allowlist' : 'blocked'
      const reviewedAt = typeof consent.reviewedAt === 'string' ? consent.reviewedAt : undefined
      return [pluginId, { grantedPermissions, allowedVaultIds, allowlistedHosts, networkAccess, reviewedAt }]
    }),
  )
}

function readInitialPolicies(): Record<string, PluginConsent> {
  try {
    return readVersionedStorage({
      key: PLUGIN_CONSENT_STORAGE_KEY,
      schemaVersion: PLUGIN_CONSENT_SCHEMA_VERSION,
      fallback: {},
      validate: validatePluginConsents,
    })
  } catch {
    return {}
  }
}

function readInitialSafeMode(): boolean {
  try {
    return window.sessionStorage.getItem('scriptor.plugins.safeMode') === 'true'
  } catch {
    return false
  }
}

export function usePluginRegistry(
  activeVaultId: string | null,
  options: { marketplaceActive?: boolean } = {},
) {
  const vaultOpen = activeVaultId !== null
  const [registry] = useState(() => new PluginRegistry(readInitialSafeMode(), readInitialPolicies()))
  const [revision, setRevision] = useState(0)
  const [manifestsReady, setManifestsReady] = useState(false)

  const bump = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    void loadAllBundledManifests()
      .then((manifests) => {
        if (cancelled) return
        for (const manifest of manifests) {
          if (!registry.has(manifest.id)) {
            registry.register(manifest)
          }
        }
        for (const [pluginId, consent] of Object.entries(readInitialPolicies())) {
          if (!registry.has(pluginId) || registry.getConsent(pluginId)) continue
          registry.setConsent(pluginId, consent)
        }
        setManifestsReady(true)
        bump()
      })
      .catch(() => {
        if (!cancelled) setManifestsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [bump, registry])

  // Native first-party capabilities are persisted per vault. Once manifests
  // and consent are available, restore runtime enablement from that authority.
  // A native-enabled capability still cannot run unless current consent allows
  // it for this vault, so stale native state never bypasses registry policy.
  useEffect(() => {
    if (!manifestsReady || !activeVaultId) return
    let cancelled = false
    void loadPluginState()
      .then((enabledCapabilities) => {
        if (cancelled || !enabledCapabilities) return
        let changed = false
        for (const plugin of registry.listAll()) {
          const capabilityId = plugin.manifest.capabilityId
          if (!capabilityId) continue
          const shouldEnable = enabledCapabilities.has(capabilityId) && registry.canEnable(plugin.manifest.id, activeVaultId)
          if (plugin.enabled !== shouldEnable) {
            registry.setEnabled(plugin.manifest.id, shouldEnable, activeVaultId)
            changed = true
          }
        }
        if (changed) bump()
      })
      .catch((error) => {
        console.error('Failed to restore native plugin capability state', error)
      })
    return () => {
      cancelled = true
    }
  }, [activeVaultId, bump, manifestsReady, registry])

  const vaultQuery = useMemo<ReadOnlyVaultQuery | null>(() => {
    if (!vaultOpen) return null
    return createVaultQueryAdapter({
      search: async (query, limit) => {
        const hits = await indexerSearch(query, limit ?? 10)
        return hits.map((hit) => ({
          path: hit.path,
          title: hit.title,
          snippet: hit.snippet,
        }))
      },
      readNote: async (path) => {
        const note = await vaultReadNote(path)
        return {
          path,
          title: note.metadata.title,
          markdown: note.markdown,
        }
      },
      backlinks: async (path) => {
        const hits = await indexerBacklinks(path)
        return hits.map((hit) => ({
          fromPath: hit.from_path,
          fromTitle: hit.from_title,
          line: hit.line,
        }))
      },
      healthIssues: async () => {
        const diagnostics = await vaultHealthDiagnostics()
        return diagnostics.issues
      },
    })
  }, [vaultOpen])

  const snapshot = useMemo(() => registry.getSnapshot(), [registry, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const enabledPlugins = useMemo(
    () => registry.listEnabledForVault(activeVaultId),
    [activeVaultId, registry, revision], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const plugins = useMemo(() => registry.listAll(), [registry, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const contributions = useMemo(() => collectContributions(enabledPlugins), [enabledPlugins])

  const canExecutePluginCommand = useCallback(
    (pluginId: string, permission: import('@scriptor/core/contracts/plugin').PluginPermission['permission']) => {
      const plugin = registry.get(pluginId)
      if (!plugin?.enabled || !registry.canEnable(pluginId, activeVaultId)) return false
      const policy = registry.defaultPolicy(pluginId)
      if (!policy?.grantedPermissions.includes(permission)) return false
      if (permission === 'read' || permission === 'write-approved') {
        return Boolean(activeVaultId && policy.allowedVaultIds.includes(activeVaultId))
      }
      return true
    },
    [activeVaultId, registry, revision], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pluginHosts = useMemo(
    () =>
      enabledPlugins.map((plugin) => ({
        pluginId: plugin.manifest.id,
        host: new PluginHost(
          registry.defaultPolicy(plugin.manifest.id) ?? {
            pluginId: plugin.manifest.id,
            enabled: false,
            grantedPermissions: [],
            allowedVaultIds: [],
            networkAccess: 'blocked',
            allowlistedHosts: [],
          },
          activeVaultId,
          vaultQuery,
        ),
      })),
    [activeVaultId, enabledPlugins, registry, vaultQuery],
  )

  const setSafeMode = useCallback(
    (enabled: boolean) => {
      registry.setSafeMode(enabled)
      try {
        window.sessionStorage.setItem('scriptor.plugins.safeMode', String(enabled))
      } catch {
        // ignore storage failures
      }
      bump()
    },
    [bump, registry],
  )

  const setPluginEnabled = useCallback(
    async (pluginId: string, enabled: boolean): Promise<boolean> => {
      const plugin = registry.get(pluginId)
      if (!plugin) return false
      if (enabled && !registry.canEnable(pluginId, activeVaultId)) {
        bump()
        return false
      }

      const capabilityId = plugin.manifest.capabilityId
      try {
        if (capabilityId) await setPluginCapabilityEnabled(capabilityId, enabled)
        const changed = registry.setEnabled(pluginId, enabled, activeVaultId)
        if (!changed && capabilityId && enabled) {
          await setPluginCapabilityEnabled(capabilityId, false)
        }
        bump()
        return changed
      } catch (error) {
        console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin ${pluginId}`, error)
        bump()
        return false
      }
    },
    [activeVaultId, bump, registry],
  )

  const setPluginConsent = useCallback(
    async (pluginId: string, consent: PluginConsent) => {
      const wasEnabled = registry.get(pluginId)?.enabled === true
      registry.setConsent(pluginId, consent)
      writeVersionedStorage(
        PLUGIN_CONSENT_STORAGE_KEY,
        PLUGIN_CONSENT_SCHEMA_VERSION,
        registry.exportConsents(),
      )
      const plugin = registry.get(pluginId)
      // Consent may revoke a required permission or vault scope and therefore
      // disable an already-running plugin. Propagate that real transition to
      // the native authority, but do not emit a redundant disable for a plugin
      // that was already off: Store's "grant then enable" flow starts the
      // enable immediately and the two async native writes could otherwise race.
      if (wasEnabled && plugin?.manifest.capabilityId && !plugin.enabled) {
        try {
          await setPluginCapabilityEnabled(plugin.manifest.capabilityId, false)
        } catch (error) {
          console.error(`Failed to synchronize consent for plugin ${pluginId}`, error)
        }
      }
      bump()
    },
    [bump, registry],
  )

  const revokePluginConsent = useCallback(
    async (pluginId: string) => {
      const plugin = registry.get(pluginId)
      try {
        if (plugin?.manifest.capabilityId) {
          await setPluginCapabilityEnabled(plugin.manifest.capabilityId, false)
        }
      } catch (error) {
        console.error(`Failed to disable native capability while revoking ${pluginId}`, error)
        return
      }
      registry.revokeConsent(pluginId)
      writeVersionedStorage(
        PLUGIN_CONSENT_STORAGE_KEY,
        PLUGIN_CONSENT_SCHEMA_VERSION,
        registry.exportConsents(),
      )
      bump()
    },
    [bump, registry],
  )

  const [marketplaceCatalog, setMarketplaceCatalog] = useState<MarketplaceListing[]>(() =>
    listBundledMarketplaceCatalog(),
  )
  const remoteCatalogRequested = useRef(false)

  useEffect(() => {
    if (!options.marketplaceActive || remoteCatalogRequested.current) return
    const remoteUrl =
      typeof import.meta.env.VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL === 'string'
        ? import.meta.env.VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL
        : null
    if (!remoteUrl?.trim()) return
    remoteCatalogRequested.current = true
    void loadMarketplaceCatalog(remoteUrl)
      .then(setMarketplaceCatalog)
      .catch(() => {
        remoteCatalogRequested.current = false
        // keep bundled catalog on remote fetch failure
      })
  }, [options.marketplaceActive])

  const installFromMarketplace = useCallback(
    async (listingId: string) => {
      const listing = marketplaceCatalog.find((entry) => entry.id === listingId)
      if (!listing) {
        throw new Error(`unknown marketplace listing: ${listingId}`)
      }
      if (registry.has(listing.id)) {
        await setPluginEnabled(listing.id, false)
        return
      }
      const manifest = await resolveMarketplaceManifest(listing)
      const result = registry.register(manifest)
      if (!result.ok) {
        throw new Error(result.errors.join('; '))
      }
      bump()
    },
    [bump, marketplaceCatalog, registry, setPluginEnabled],
  )

  return {
    snapshot,
    contributions,
    vaultQuery,
    pluginHosts,
    pluginPolicies: Object.fromEntries(
      plugins.map((plugin) => [plugin.manifest.id, registry.defaultPolicy(plugin.manifest.id)]),
    ),
    activeVaultId,
    setSafeMode,
    setPluginEnabled,
    setPluginConsent,
    revokePluginConsent,
    installFromMarketplace,
    marketplaceCatalog,
    plugins,
    activePlugins: enabledPlugins,
    canExecutePluginCommand,
    manifestsReady,
  }
}
