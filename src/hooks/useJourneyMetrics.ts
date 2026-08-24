import { useCallback, useMemo, useState } from 'react'

import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

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

function validateSnapshot(value: unknown): JourneySnapshot {
  const parsed = expectRecord(value, 'journey metrics')
  const panelOpensRecord = typeof parsed.panelOpens === 'object' && parsed.panelOpens !== null
    ? expectRecord(parsed.panelOpens, 'journey metrics.panelOpens')
    : {}
  const panelOpens = Object.fromEntries(
    Object.entries(panelOpensRecord).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    ),
  )
  const nullableNumber = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
  return {
    vaultOpenedAt: nullableNumber(parsed.vaultOpenedAt),
    firstEditAt: nullableNumber(parsed.firstEditAt),
    firstExportAt: nullableNumber(parsed.firstExportAt),
    lastIndexRebuildMs: nullableNumber(parsed.lastIndexRebuildMs),
    panelOpens,
  }
}

function readSnapshot(): JourneySnapshot {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: { ...EMPTY, panelOpens: {} },
    validate: validateSnapshot,
  })
}

let pendingSnapshot: JourneySnapshot | null = null
let persistTimer: number | null = null

function flushPersist() {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer)
    persistTimer = null
  }
  if (pendingSnapshot !== null) {
    persist(pendingSnapshot)
    pendingSnapshot = null
  }
}

// Journey marks can fire per interaction; coalesce storage writes to at
// most one per second and always flush when the app is hidden or closed.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersist)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist()
  })
}

function persistThrottled(snapshot: JourneySnapshot) {
  pendingSnapshot = snapshot
  if (persistTimer === null) {
    persistTimer = window.setTimeout(flushPersist, 1000)
  }
}
function persist(snapshot: JourneySnapshot) {
  writeVersionedStorage(STORAGE_KEY, 1, snapshot)
}

export function useJourneyMetrics() {
  const [snapshot, setSnapshot] = useState<JourneySnapshot>(() => readSnapshot())

  const update = useCallback((updater: (current: JourneySnapshot) => JourneySnapshot) => {
    setSnapshot((current) => {
      const next = updater(current)
      if (next === current) {
        return current
      }
      persistThrottled(next)
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

  return useMemo(
    () => ({
      snapshot,
      markVaultOpen,
      markFirstEdit,
      markExport,
      markIndexRebuild,
      recordPanelOpen,
      reset,
      timeToFirstEditMs,
      timeToFirstExportMs,
    }),
    [
      snapshot,
      markVaultOpen,
      markFirstEdit,
      markExport,
      markIndexRebuild,
      recordPanelOpen,
      reset,
      timeToFirstEditMs,
      timeToFirstExportMs,
    ],
  )
}
