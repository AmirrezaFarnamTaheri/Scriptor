import { Activity, CheckCircle2, ChevronDown, GitBranch, PanelRight } from 'lucide-react'

import { DiagnosticsPanel } from '../DiagnosticsPanel'
import { StatusDockPanel, type StatusDockTab } from '../StatusDockPanel'
import type { ClientDiagnosticEvent } from '../../hooks/useDiagnosticsSettings'
import type { ActivityEntry } from '../../hooks/useActivityLog'
import type { EditorLintMessage } from '@scriptor/editor'
import type {
  ExportJobOutput,
  ExportJobRecord,
  ExternalChangeConflict,
  GitChangedFile,
  SearchHit,
  VaultDescriptor,
  VaultHealthDiagnostics,
  VaultHealthReport,
} from '../../types/vault'

interface WorkspaceStatusFooterProps {
  statusDockTab: StatusDockTab
  onStatusDockTabChange: (tab: StatusDockTab) => void
  totalProblemCount: number
  diagnosticsPanelProps: {
    issues: VaultHealthDiagnostics['issues']
    gitConflicts: GitChangedFile[]
    externalChange: ExternalChangeConflict | null
    clientEvents: ClientDiagnosticEvent[]
    editorLintMessages: EditorLintMessage[]
    activeNotePath: string | null
    onClose: () => void
    onOpenIssue: (path: string, line?: number | null) => void
    onOpenEditorLint: (line: number) => void
    onGenerateLinkReferences: () => void
    onReloadExternalChange: () => void
    onKeepEditingExternalChange: () => void
    onRebuildIndex: () => void
    onFixVaultLint: () => void
    isFixingVaultLint: boolean
  }
  activity: ActivityEntry[]
  searchResults: SearchHit[]
  searchQuery: string
  isSearching: boolean
  exportResult: ExportJobOutput | null
  exportHistory: ExportJobRecord[]
  isExporting: boolean
  isIndexing: boolean
  graphProgress: number
  onOpenNote: (path: string) => void
  onCancelExport: () => void
  workspaceStatus: string
  rebuildSummary: { indexed_notes: number; skipped_notes: number } | null
  lastRebuildMs: number | null
  noteCount: number
  health: VaultHealthReport | null
  vault: VaultDescriptor | null
  diagnosticsOptIn: boolean
  onDiagnosticsOptInChange: (enabled: boolean) => void
  timeToFirstEditMs?: number | null
  timeToFirstExportMs?: number | null
}

export function WorkspaceStatusFooter({
  statusDockTab,
  onStatusDockTabChange,
  totalProblemCount,
  diagnosticsPanelProps,
  activity,
  searchResults,
  searchQuery,
  isSearching,
  exportResult,
  exportHistory,
  isExporting,
  isIndexing,
  graphProgress,
  onOpenNote,
  onCancelExport,
  workspaceStatus,
  rebuildSummary,
  lastRebuildMs,
  noteCount,
  health,
  vault,
  diagnosticsOptIn,
  onDiagnosticsOptInChange,
  timeToFirstEditMs = null,
  timeToFirstExportMs = null,
}: WorkspaceStatusFooterProps) {
  return (
    <footer className="status-strip">
      <button
        type="button"
        className="jobs-button"
        onClick={() => onStatusDockTabChange('jobs')}
        aria-pressed={statusDockTab === 'jobs'}
      >
        <PanelRight />
        Jobs
        <ChevronDown />
      </button>

      <div className="job-progress" aria-label={`Building graph ${graphProgress}%`}>
        <Activity />
        <div>
          <strong>{workspaceStatus === 'indexing' ? 'Building index...' : 'Index ready'}</strong>
          <div className="progress-track">
            <span style={{ width: `${graphProgress}%` }} />
          </div>
        </div>
        <span>{graphProgress}%</span>
        <small>
          {rebuildSummary
            ? `${rebuildSummary.indexed_notes + rebuildSummary.skipped_notes} / ${noteCount} notes`
            : `${noteCount} notes`}
          {lastRebuildMs != null ? ` · ${lastRebuildMs}ms` : ''}
        </small>
      </div>

      <div className="bottom-tabs-wrap">
        <StatusDockPanel
          activeTab={statusDockTab}
          onTabChange={onStatusDockTabChange}
          problemCount={totalProblemCount}
          issuesPanel={<DiagnosticsPanel {...diagnosticsPanelProps} />}
          activity={activity}
          searchResults={searchResults}
          searchQuery={searchQuery}
          isSearching={isSearching}
          exportResult={exportResult}
          exportHistory={exportHistory}
          isExporting={isExporting}
          isIndexing={isIndexing}
          graphProgress={graphProgress}
          onOpenNote={onOpenNote}
          onCancelExport={onCancelExport}
        />
      </div>

      <div className="repo-state">
        <label
          className="diagnostics-opt-in"
          title="When enabled, renderer errors are stored locally in .scriptor/diagnostics/client.jsonl"
        >
          <input
            type="checkbox"
            checked={diagnosticsOptIn}
            onChange={(event) => onDiagnosticsOptInChange(event.target.checked)}
            aria-label="Send local crash diagnostics"
          />
          <span>Diagnostics</span>
        </label>
        <span>{health?.cache_status ?? 'no vault'}</span>
        {timeToFirstEditMs != null ? <span title="Time to first edit this session">TTFE {timeToFirstEditMs < 1000 ? `${timeToFirstEditMs}ms` : `${(timeToFirstEditMs / 1000).toFixed(1)}s`}</span> : null}
        {timeToFirstExportMs != null ? <span title="Time to first export this session">TTFX {(timeToFirstExportMs / 1000).toFixed(1)}s</span> : null}
        <GitBranch />
        <span>{vault?.name ?? 'unopened'}</span>
        <CheckCircle2 />
      </div>
    </footer>
  )
}
