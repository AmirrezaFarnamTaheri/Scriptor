import { useCallback, useState } from 'react'
import { Activity, Database, RefreshCw, Search, Server } from 'lucide-react'

import {
  daemonBacklinks,
  daemonEndpoint,
  daemonGraph,
  daemonHealthDiagnostics,
  daemonListNoteSummaries,
  daemonRebuildIndex,
  daemonSearch,
} from '../bridge/commands'
import type { BacklinkHit, GraphQueryOutput, RebuildSummary, SearchHit } from '../types/vault'

interface DaemonOpsPanelProps {
  activePath: string | null
  daemonVersion: string | null
  daemonError: string | null
  onRefresh: () => void
  onStart: () => void
}

export function DaemonOpsPanel({
  activePath,
  daemonVersion,
  daemonError,
  onRefresh,
  onStart,
}: DaemonOpsPanelProps) {
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [rebuildSummary, setRebuildSummary] = useState<RebuildSummary | null>(null)
  const [healthIssueCount, setHealthIssueCount] = useState<number | null>(null)
  const [noteCount, setNoteCount] = useState<number | null>(null)
  const [backlinkHits, setBacklinkHits] = useState<BacklinkHit[]>([])
  const [graphSummary, setGraphSummary] = useState<GraphQueryOutput | null>(null)

  const run = useCallback(async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    setStatus(null)
    try {
      await task()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }, [])

  return (
    <div className="daemon-ops-panel settings-subsection">
      <h4 className="settings-subheading">
        <Server size={16} />
        Daemon operations
      </h4>
      <p className="health-subtitle">
        Direct IPC to the headless engine for index rebuild, search, health, and graph probes.
      </p>

      <p className={daemonVersion ? 'settings-status ok' : 'settings-status warn'} role="status">
        {daemonVersion
          ? `Connected — v${daemonVersion}`
          : daemonError
            ? `Offline — ${daemonError}`
            : 'Status unknown'}
      </p>

      <div className="settings-actions">
        <button type="button" className="toolbar-button" disabled={Boolean(busy)} onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh status
        </button>
        <button type="button" className="toolbar-button" disabled={Boolean(busy)} onClick={onStart}>
          <Server size={14} />
          Start daemon
        </button>
        <button
          type="button"
          className="toolbar-button"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('endpoint', async () => {
              const info = await daemonEndpoint()
              setEndpoint(`${info.socket_name} (pid ${info.pid})`)
              setStatus(`Endpoint: ${info.socket_name}`)
            })
          }
        >
          Show endpoint
        </button>
      </div>

      {endpoint ? <p className="health-subtitle">Socket: {endpoint}</p> : null}

      <div className="settings-actions">
        <button
          type="button"
          className="toolbar-button"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('rebuild', async () => {
              const summary = await daemonRebuildIndex()
              setRebuildSummary(summary)
              setStatus(`Rebuilt ${summary.indexed_notes} notes (${summary.skipped_notes} skipped)`)
            })
          }
        >
          <Database size={14} />
          Rebuild index
        </button>
        <button
          type="button"
          className="toolbar-button"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('health', async () => {
              const diagnostics = await daemonHealthDiagnostics()
              setHealthIssueCount(diagnostics.issues.length)
              setStatus(`${diagnostics.issues.length} health issue(s)`)
            })
          }
        >
          <Activity size={14} />
          Health diagnostics
        </button>
        <button
          type="button"
          className="toolbar-button"
          disabled={Boolean(busy)}
          onClick={() =>
            void run('notes', async () => {
              const notes = await daemonListNoteSummaries()
              setNoteCount(notes.length)
              setStatus(`${notes.length} indexed note(s)`)
            })
          }
        >
          Count notes
        </button>
        {activePath ? (
          <>
            <button
              type="button"
              className="toolbar-button"
              disabled={Boolean(busy)}
              onClick={() =>
                void run('backlinks', async () => {
                  const hits = await daemonBacklinks(activePath)
                  setBacklinkHits(hits)
                  setStatus(`${hits.length} backlink(s) for active note`)
                })
              }
            >
              Backlinks (active)
            </button>
            <button
              type="button"
              className="toolbar-button"
              disabled={Boolean(busy)}
              onClick={() =>
                void run('graph', async () => {
                  const graph = await daemonGraph(activePath, 1)
                  setGraphSummary(graph)
                  setStatus(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`)
                })
              }
            >
              Graph (active)
            </button>
          </>
        ) : null}
      </div>

      <form
        className="daemon-search-form"
        onSubmit={(event) => {
          event.preventDefault()
          void run('search', async () => {
            const hits = await daemonSearch(searchQuery.trim(), 12)
            setSearchHits(hits)
            setStatus(`${hits.length} search hit(s)`)
          })
        }}
      >
        <label className="settings-field">
          Daemon search
          <div className="daemon-search-row">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Query indexed notes…"
            />
            <button type="submit" className="toolbar-button" disabled={Boolean(busy) || !searchQuery.trim()}>
              <Search size={14} />
              Search
            </button>
          </div>
        </label>
      </form>

      {busy ? <p className="health-subtitle">Running: {busy}…</p> : null}
      {status ? <p className="settings-status ok">{status}</p> : null}

      {rebuildSummary ? (
        <p className="health-subtitle">
          Last rebuild: {rebuildSummary.indexed_notes} indexed, {rebuildSummary.skipped_notes} skipped
        </p>
      ) : null}
      {healthIssueCount !== null ? (
        <p className="health-subtitle">Health issues: {healthIssueCount}</p>
      ) : null}
      {noteCount !== null ? <p className="health-subtitle">Indexed notes: {noteCount}</p> : null}

      {searchHits.length > 0 ? (
        <ul className="daemon-hit-list compact-list">
          {searchHits.map((hit) => (
            <li key={hit.path}>
              <strong>{hit.title}</strong>
              <small>{hit.path}</small>
              {hit.snippet ? <span>{hit.snippet}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {backlinkHits.length > 0 ? (
        <ul className="daemon-hit-list compact-list">
          {backlinkHits.map((hit) => (
            <li key={`${hit.from_path}:${hit.line}`}>
              <strong>{hit.from_title}</strong>
              <small>L{hit.line}</small>
            </li>
          ))}
        </ul>
      ) : null}

      {graphSummary ? (
        <p className="health-subtitle">
          Graph focus: {graphSummary.nodes.length} nodes · {graphSummary.edges.length} edges
        </p>
      ) : null}
    </div>
  )
}
