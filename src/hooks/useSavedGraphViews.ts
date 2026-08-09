/**
 * useSavedGraphViews
 * -------------------
 * Manage named, persisted graph filter state snapshots stored in VaultConfig.
 *
 * Operations:
 *  - `saveView(name, filterState)` — saves a new view
 *  - `deleteView(id)`              — removes an existing view
 *  - `applyView(id)`               — returns the filter state for a saved view
 *
 * All mutations go through `vaultSaveConfig` so they are persisted to disk
 * in the vault's `.scriptor/config.toml`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { vaultLoadConfig, vaultSaveConfig } from '../bridge/commands/vault'
import type { SavedGraphView, VaultConfig } from '../types/vault'

// We use nanoid-lite (pure math, no imports) for IDs to avoid adding a dep.
function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

export interface GraphFilterState {
  tags?: string[]
  focusPath?: string | null
  depth?: number
  modifiedWithinDays?: number | null
  clusterIds?: string[]
}

export type SavedViewsStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SavedGraphViewsResult {
  status: SavedViewsStatus
  views: SavedGraphView[]
  saveView: (name: string, filter: GraphFilterState) => Promise<void>
  deleteView: (id: string) => Promise<void>
  applyView: (id: string) => GraphFilterState | null
  error?: string
}

export function useSavedGraphViews(): SavedGraphViewsResult {
  const [status, setStatus] = useState<SavedViewsStatus>('loading')
  const [config, setConfig] = useState<VaultConfig | null>(null)
  const [error, setError] = useState<string | undefined>()

  // Load vault config on mount
  useEffect(() => {
    vaultLoadConfig()
      .then((c) => {
        setConfig(c)
        setStatus('ready')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load vault config.')
        setStatus('error')
      })
  }, [])

  const views: SavedGraphView[] = useMemo(() => config?.saved_views ?? [], [config])

  const saveView = useCallback(
    async (name: string, filter: GraphFilterState) => {
      if (!config) return
      const newView: SavedGraphView = {
        id: generateId(),
        name: name.trim() || 'Unnamed View',
        created_at: new Date().toISOString(),
        tags: filter.tags,
        focus_path: filter.focusPath ?? null,
        depth: filter.depth,
        modified_within_days: filter.modifiedWithinDays ?? null,
        cluster_ids: filter.clusterIds,
      }
      const updated: VaultConfig = {
        ...config,
        saved_views: [...(config.saved_views ?? []), newView],
      }
      await vaultSaveConfig(updated)
      setConfig(updated)
    },
    [config],
  )

  const deleteView = useCallback(
    async (id: string) => {
      if (!config) return
      const updated: VaultConfig = {
        ...config,
        saved_views: (config.saved_views ?? []).filter((v) => v.id !== id),
      }
      await vaultSaveConfig(updated)
      setConfig(updated)
    },
    [config],
  )

  const applyView = useCallback(
    (id: string): GraphFilterState | null => {
      const view = views.find((v) => v.id === id)
      if (!view) return null
      return {
        tags: view.tags,
        focusPath: view.focus_path ?? null,
        depth: view.depth,
        modifiedWithinDays: view.modified_within_days ?? null,
        clusterIds: view.cluster_ids,
      }
    },
    [views],
  )

  return { status, views, saveView, deleteView, applyView, error }
}
