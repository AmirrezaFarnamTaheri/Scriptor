import type { PerfMetricsSnapshot } from '../hooks/usePerfMetrics'

interface PerfHudOverlayProps {
  metrics: PerfMetricsSnapshot
}

export function PerfHudOverlay({ metrics }: PerfHudOverlayProps) {
  return (
    <div className="perf-hud-overlay" role="status" aria-live="polite" aria-label="Performance metrics">
      <strong>Perf</strong>
      <dl>
        <div>
          <dt>Vault open</dt>
          <dd>{metrics.vaultOpenMs === null ? '—' : `${metrics.vaultOpenMs} ms`}</dd>
        </div>
        <div>
          <dt>Last search</dt>
          <dd>{metrics.lastSearchMs === null ? '—' : `${metrics.lastSearchMs} ms`}</dd>
        </div>
        <div>
          <dt>Tabs</dt>
          <dd>{metrics.openTabCount}</dd>
        </div>
        <div>
          <dt>Sections</dt>
          <dd>{metrics.vaultSectionCount}</dd>
        </div>
        <div>
          <dt>Graph nodes</dt>
          <dd>{metrics.graphNodeCount ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
