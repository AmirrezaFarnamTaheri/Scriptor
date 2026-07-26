import { useCallback, useMemo, useRef, useState } from 'react'

export interface PerfMetricsSnapshot {
  vaultOpenMs: number | null
  lastSearchMs: number | null
  openTabCount: number
  vaultSectionCount: number
  graphNodeCount: number | null
}

const EMPTY: PerfMetricsSnapshot = {
  vaultOpenMs: null,
  lastSearchMs: null,
  openTabCount: 0,
  vaultSectionCount: 0,
  graphNodeCount: null,
}

export function usePerfMetrics() {
  const [metrics, setMetrics] = useState<PerfMetricsSnapshot>(EMPTY)
  const vaultOpenStarted = useRef<number | null>(null)

  const markVaultOpenStart = useCallback(() => {
    vaultOpenStarted.current = performance.now()
  }, [])

  const markVaultOpenEnd = useCallback(() => {
    if (vaultOpenStarted.current === null) return
    const elapsed = Math.round(performance.now() - vaultOpenStarted.current)
    vaultOpenStarted.current = null
    setMetrics((current) => ({ ...current, vaultOpenMs: elapsed }))
  }, [])

  const recordSearchMs = useCallback((ms: number) => {
    setMetrics((current) => ({ ...current, lastSearchMs: Math.round(ms) }))
  }, [])

  const setWorkspaceCounts = useCallback((openTabCount: number, vaultSectionCount: number) => {
    setMetrics((current) => ({ ...current, openTabCount, vaultSectionCount }))
  }, [])

  const setGraphNodeCount = useCallback((graphNodeCount: number | null) => {
    setMetrics((current) => ({ ...current, graphNodeCount }))
  }, [])

  return useMemo(
    () => ({
      metrics,
      markVaultOpenStart,
      markVaultOpenEnd,
      recordSearchMs,
      setWorkspaceCounts,
      setGraphNodeCount,
    }),
    [metrics, markVaultOpenStart, markVaultOpenEnd, recordSearchMs, setWorkspaceCounts, setGraphNodeCount],
  )
}
