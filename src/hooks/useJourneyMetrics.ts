import { useCallback, useState } from 'react'

export interface JourneySnapshot {
  vaultOpenedAt: number | null
  firstEditAt: number | null
  firstExportAt: number | null
  lastIndexRebuildMs: number | null
  panelOpens: Record<string, number>
}

const STORAGE_KEY = 'scriptor:journey-metrics'

const EMPTY: JourneySnapshot = {
  vaultOpenedAt: null,
  firstEditAt: null,
  firstExportAt: null,
  lastIndexRebuildMs: null,
  panelOpens: {},
}

function readSnapshot(): JourneySnapshot {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY, panelOpens: {} }
    const parsed = JSON.parse(raw) as Partial<JourneySnapshot>
    return {
      vaultOpenedAt: parsed.vaultOpenedAt ?? null,
      firstEditAt: parsed.firstEditAt ?? null,
      firstExportAt: parsed.firstExportAt ?? null,
      lastIndexRebuildMs: parsed.lastIndexRebuildMs ?? null,
      panelOpens: parsed.panelOpens ?? {},
    }
  } catch {
    return { ...EMPTY, panelOpens: {} }
  }
}

function persist(snapshot: JourneySnapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore storage failures
  }
}

export function useJourneyMetrics() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot>(() => readSnapshot())

  const update = useCallback((updater: (current: JourneySnapshot) => JourneySnapshot) => {
    setSnapshot((current) => {
      const next = updater(current)
      persist(next)
      return next
    })
  }, [])

  const markVaultOpen = useCallback(() => {
    update((current) => ({
      ...current,
      vaultOpenedAt: Date.now(),
      firstEditAt: null,
      firstExportAt: null,
    }))
  }, [update])

  const markFirstEdit = useCallback(() => {
    update((current) =>
      current.firstEditAt
        ? current
        : {
            ...current,
            firstEditAt: Date.now(),
          },
    )
  }, [update])

  const markExport = useCallback(() => {
    update((current) =>
      current.firstExportAt
        ? current
        : {
            ...current,
            firstExportAt: Date.now(),
          },
    )
  }, [update])

  const markIndexRebuild = useCallback((durationMs: number) => {
    update((current) => ({
      ...current,
      lastIndexRebuildMs: durationMs,
    }))
  }, [update])

  const recordPanelOpen = useCallback((panelId: string) => {
    update((current) => ({
      ...current,
      panelOpens: {
        ...current.panelOpens,
        [panelId]: (current.panelOpens[panelId] ?? 0) + 1,
      },
    }))
  }, [update])

  const reset = useCallback(() => {
    const next = { ...EMPTY, panelOpens: {} }
    persist(next)
    setSnapshot(next)
  }, [])

  const timeToFirstEditMs =
    snapshot.vaultOpenedAt && snapshot.firstEditAt
      ? snapshot.firstEditAt - snapshot.vaultOpenedAt
      : null

  const timeToFirstExportMs =
    snapshot.vaultOpenedAt && snapshot.firstExportAt
      ? snapshot.firstExportAt - snapshot.vaultOpenedAt
      : null

  return {
    snapshot,
    markVaultOpen,
    markFirstEdit,
    markExport,
    markIndexRebuild,
    recordPanelOpen,
    reset,
    timeToFirstEditMs,
    timeToFirstExportMs,
  }
}
