import type { JourneySnapshot } from '../hooks/useJourneyMetrics'

import { BENCH_SCRIPTS } from '../lib/releaseQuality'

interface ReleaseQualityPanelProps {
  journey: JourneySnapshot
  timeToFirstEditMs: number | null
  timeToFirstExportMs: number | null
  onResetJourney: () => void
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ReleaseQualityPanel({
  journey,
  timeToFirstEditMs,
  timeToFirstExportMs,
  onResetJourney,
}: ReleaseQualityPanelProps) {
  const categories = ['startup', 'index', 'editor', 'canvas', 'release'] as const

  return (
    <div className="release-quality-panel">
      <h3>Release quality dashboard</h3>
      <p className="health-subtitle">
        Run benchmarks from a terminal in the repo root. Journey metrics below are captured locally in this workspace.
      </p>

      <div className="metric-grid health-metrics journey-metrics">
        <div className="metric">
          <span>Time to first edit</span>
          <strong>{formatDuration(timeToFirstEditMs)}</strong>
        </div>
        <div className="metric">
          <span>Time to first export</span>
          <strong>{formatDuration(timeToFirstExportMs)}</strong>
        </div>
        <div className="metric">
          <span>Last index rebuild</span>
          <strong>{formatDuration(journey.lastIndexRebuildMs)}</strong>
        </div>
        <div className="metric">
          <span>Panel opens tracked</span>
          <strong>{Object.values(journey.panelOpens).reduce((sum, count) => sum + count, 0)}</strong>
        </div>
      </div>

      <button type="button" className="toolbar-button" onClick={onResetJourney}>
        Reset journey metrics
      </button>

      {categories.map((category) => (
        <section key={category} className="bench-category">
          <h4>{category}</h4>
          <ul className="bench-script-list">
            {BENCH_SCRIPTS.filter((script) => script.category === category).map((script) => (
              <li key={script.id}>
                <div>
                  <strong>{script.label}</strong>
                  <p>{script.description}</p>
                </div>
                <code>{script.command}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
