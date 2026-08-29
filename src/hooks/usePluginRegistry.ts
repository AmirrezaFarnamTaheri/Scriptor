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
        // PluginRegistry ingests consents once, in its constructor, which runs
        // before these manifests exist. Re-apply stored grants for plugins that
        // have no in-memory policy yet, otherwise `canEnable` keeps refusing to
        // activate a plugin the user already reviewed and `setEnabled` fails
        // silently. Policies already held in memory win over storage.
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
  const enabledPlugins = useMemo(() => registry.listEnabled(), [registry, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const plugins = useMemo(() => registry.listAll(), [registry, revision]) // eslint-disable-line react-hooks/exhaustive-deps
  const contributions = useMemo(() => collectContributions(enabledPlugins), [enabledPlugins])
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
    (pluginId: string, enabled: boolean) => {
      registry.setEnabled(pluginId, enabled, activeVaultId)
      bump()
    },
    [activeVaultId, bump, registry],
  )

  const setPluginConsent = useCallback(
    (pluginId: string, consent: PluginConsent) => {
      registry.setConsent(pluginId, consent)
      writeVersionedStorage(
        PLUGIN_CONSENT_STORAGE_KEY,
        PLUGIN_CONSENT_SCHEMA_VERSION,
        registry.exportConsents(),
      )
      bump()
    },
    [bump, registry],
  )

  const revokePluginConsent = useCallback(
    (pluginId: string) => {
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
        registry.setEnabled(listing.id, false, activeVaultId)
        bump()
        return
      }
      const manifest = await resolveMarketplaceManifest(listing)
      const result = registry.register(manifest)
      if (!result.ok) {
        throw new Error(result.errors.join('; '))
      }
      bump()
    },
    [activeVaultId, bump, marketplaceCatalog, registry],
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
    manifestsReady,
  }
}
