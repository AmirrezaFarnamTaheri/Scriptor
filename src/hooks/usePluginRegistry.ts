import { useCallback, useEffect, useMemo, useState } from 'react'
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
  type ReadOnlyVaultQuery,
} from '@scriptor/plugin-api'

import {
  indexerBacklinks,
  indexerSearch,
  vaultHealthDiagnostics,
  vaultReadNote,
} from '../bridge/commands'

function readInitialSafeMode(): boolean {
  try {
    return window.sessionStorage.getItem('scriptor.plugins.safeMode') === 'true'
  } catch {
    return false
  }
}

export function usePluginRegistry(vaultOpen: boolean) {
  const [registry] = useState(() => new PluginRegistry(readInitialSafeMode()))
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
  const contributions = useMemo(() => collectContributions(enabledPlugins), [enabledPlugins])
  const pluginHosts = useMemo(
    () =>
      enabledPlugins.map((plugin) => ({
        pluginId: plugin.manifest.id,
        host: new PluginHost(
          registry.defaultPolicy(plugin.manifest.id) ?? {
            pluginId: plugin.manifest.id,
            enabled: plugin.enabled,
            grantedPermissions: plugin.manifest.permissions.map((entry) => entry.permission),
            allowedVaultIds: [],
            networkAccess: 'blocked',
            allowlistedHosts: [],
          },
          vaultQuery,
        ),
      })),
    [enabledPlugins, registry, vaultQuery],
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
      registry.setEnabled(pluginId, enabled)
      bump()
    },
    [bump, registry],
  )

  const [marketplaceCatalog, setMarketplaceCatalog] = useState<MarketplaceListing[]>(() =>
    listBundledMarketplaceCatalog(),
  )

  useEffect(() => {
    const remoteUrl =
      typeof import.meta.env.VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL === 'string'
        ? import.meta.env.VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL
        : null
    if (!remoteUrl?.trim()) return
    void loadMarketplaceCatalog(remoteUrl)
      .then(setMarketplaceCatalog)
      .catch(() => {
        // keep bundled catalog on remote fetch failure
      })
  }, [])

  const installFromMarketplace = useCallback(
    async (listingId: string) => {
      const listing = marketplaceCatalog.find((entry) => entry.id === listingId)
      if (!listing) {
        throw new Error(`unknown marketplace listing: ${listingId}`)
      }
      if (registry.has(listing.id)) {
        registry.setEnabled(listing.id, !registry.getSnapshot().safeMode)
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
    [bump, marketplaceCatalog, registry],
  )

  return {
    snapshot,
    contributions,
    vaultQuery,
    pluginHosts,
    setSafeMode,
    setPluginEnabled,
    installFromMarketplace,
    marketplaceCatalog,
    plugins: registry.listAll(),
    manifestsReady,
  }
}
