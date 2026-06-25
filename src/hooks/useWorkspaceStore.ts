import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createWorkspaceBundle,
  loadGlobalWorkspace,
  parseWorkspaceBundle,
  saveGlobalWorkspace,
  serializeWorkspaceBundle,
  type PortalItem,
  type PortalStore,
  type QuickCaptureStore,
  type WorkspaceBundle,
  VAULT_WORKSPACE_PATH,
} from '@scriptor/portal'

export interface UseWorkspaceStoreOptions {
  vaultOpen?: boolean
  readVaultText?: (path: string) => Promise<string | null>
  writeVaultText?: (path: string, text: string) => Promise<void>
}

export function useWorkspaceStore(options: UseWorkspaceStoreOptions = {}) {
  const [bundle, setBundle] = useState<WorkspaceBundle>(() => loadGlobalWorkspace())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (options.vaultOpen && options.readVaultText) {
        try {
          const raw = await options.readVaultText(VAULT_WORKSPACE_PATH)
          if (!cancelled && raw) {
            setBundle(parseWorkspaceBundle(raw))
          }
        } catch {
          // use local bundle
        }
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [options.vaultOpen, options.readVaultText])

  const persist = useCallback(
    async (next: WorkspaceBundle) => {
      setBundle(next)
      saveGlobalWorkspace(next)
      if (options.vaultOpen && options.writeVaultText) {
        try {
          await options.writeVaultText(VAULT_WORKSPACE_PATH, serializeWorkspaceBundle(next))
        } catch {
          // local only
        }
      }
    },
    [options.vaultOpen, options.writeVaultText],
  )

  const updatePortal = useCallback(
    (updater: (current: PortalStore) => PortalStore) => {
      void persist({ ...bundle, portal: updater(bundle.portal) })
    },
    [bundle, persist],
  )

  const updateQuickCapture = useCallback(
    (updater: (current: QuickCaptureStore) => QuickCaptureStore) => {
      void persist({ ...bundle, quickCapture: updater(bundle.quickCapture) })
    },
    [bundle, persist],
  )

  const portalItemsByCategory = useMemo(() => {
    const map = new Map<string, PortalItem[]>()
    for (const item of bundle.portal.items) {
      const list = map.get(item.categoryId) ?? []
      list.push(item)
      map.set(item.categoryId, list)
    }
    for (const [, items] of map) {
      items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title))
    }
    return map
  }, [bundle.portal.items])

  const resetWorkspace = useCallback(() => {
    void persist(createWorkspaceBundle())
  }, [persist])

  return {
    hydrated,
    bundle,
    portal: bundle.portal,
    quickCapture: bundle.quickCapture,
    portalItemsByCategory,
    updatePortal,
    updateQuickCapture,
    persist,
    resetWorkspace,
  }
}
