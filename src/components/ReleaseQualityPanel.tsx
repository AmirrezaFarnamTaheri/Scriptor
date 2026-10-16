import { memo } from 'react'
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

export const ReleaseQualityPanel = memo(function ReleaseQualityPanel({
  journey,
  timeToFirstEditMs,
  timeToFirstExportMs,
  onResetJourney,
}: ReleaseQualityPanelProps) {
  const categories = ['startup', 'index', 'editor', 'canvas', 'release'] as const

  return (
    <div className="release-quality-panel" data-help-topic="quality">
      <h3>Performance checks</h3>
      <p className="health-subtitle">
        Run detailed checks from the Scriptor project folder in a terminal. The usage numbers below come from this device.
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
          <span>Times panels opened</span>
          <strong>{Object.values(journey.panelOpens).reduce((sum, count) => sum + count, 0)}</strong>
        </div>
      </div>

      <button type="button" className="toolbar-button" onClick={onResetJourney}>
        Clear local usage numbers
      </button>

      {categories.map((category) => (
        <section key={category} className="bench-category">
          <h4>{category[0].toUpperCase() + category.slice(1)}</h4>
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
})

