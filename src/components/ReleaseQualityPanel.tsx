import type { JourneySnapshot } from '../hooks/useJourneyMetrics'

export interface BenchScript {
  id: string
  label: string
  command: string
  description: string
  category: 'startup' | 'index' | 'editor' | 'canvas' | 'release'
}

export const BENCH_SCRIPTS: BenchScript[] = [
  { id: 'startup', label: 'Startup', command: 'pnpm bench:startup', description: 'Cold app startup timing', category: 'startup' },
  { id: 'idle-memory', label: 'Idle memory', command: 'pnpm bench:idle-memory', description: 'Memory after vault idle', category: 'startup' },
  { id: 'vault-scan', label: 'Vault scan', command: 'pnpm bench:vault-scan', description: 'Full vault indexing pass', category: 'index' },
  { id: 'search', label: 'Search', command: 'pnpm bench:search', description: 'Indexed search latency', category: 'index' },
  { id: 'scan-1k', label: 'Scan 1k notes', command: 'pnpm bench:scan-1k', description: 'Large vault scan (1k)', category: 'index' },
  { id: 'scan-5k', label: 'Scan 5k notes', command: 'pnpm bench:scan-5k', description: 'Large vault scan (5k)', category: 'index' },
  { id: 'editor-latency', label: 'Editor latency', command: 'pnpm bench:editor-latency', description: 'Keystroke-to-paint editor latency', category: 'editor' },
  { id: 'large-note', label: 'Large note open', command: 'pnpm bench:large-note', description: 'Open very large markdown note', category: 'editor' },
  { id: 'canvas', label: 'Canvas interaction', command: 'pnpm bench:canvas', description: 'Canvas block placement benchmark', category: 'canvas' },
  { id: 'canvas-snapshot', label: 'Canvas snapshot', command: 'pnpm bench:canvas-snapshot', description: 'Canvas export snapshot timing', category: 'canvas' },
  { id: 'release', label: 'Full release gate', command: 'pnpm check:release', description: 'Complete release quality pipeline', category: 'release' },
]

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
