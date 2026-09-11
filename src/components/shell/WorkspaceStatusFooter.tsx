import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, GitBranch, PanelRight } from 'lucide-react'

import { DiagnosticsPanel } from '../DiagnosticsPanel'
import { StatusDockPanel, type StatusDockTab } from '../StatusDockPanel'
import { SubsystemToggles } from './SubsystemToggles'
import { usePersistedBoolean } from '../../hooks/usePersistedBoolean'
import { useI18n } from '../../lib/i18n'
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
  hibernateGraph: boolean
  onHibernateGraphChange: (enabled: boolean) => void
  hibernateMcp: boolean
  onHibernateMcpChange: (enabled: boolean) => void
  hibernateWatcher: boolean
  onHibernateWatcherChange: (enabled: boolean) => void
  hibernateGit: boolean
  onHibernateGitChange: (enabled: boolean) => void
  hibernateSpellcheck: boolean
  onHibernateSpellcheckChange: (enabled: boolean) => void
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
  hibernateGraph,
  onHibernateGraphChange,
  hibernateMcp,
  onHibernateMcpChange,
  hibernateWatcher,
  onHibernateWatcherChange,
  hibernateGit,
  onHibernateGitChange,
  hibernateSpellcheck,
  onHibernateSpellcheckChange,
}: WorkspaceStatusFooterProps) {
  const [dockExpanded, setDockExpanded] = useState(false)
  const [chromeCollapsed, setChromeCollapsed] = usePersistedBoolean(
    'scriptor:status-dock-collapsed',
    true,
  )
  const { t } = useI18n()
  const previousDockTab = useRef(statusDockTab)

  useEffect(() => {
    if (previousDockTab.current !== statusDockTab) {
      previousDockTab.current = statusDockTab
      setDockExpanded(true)
      setChromeCollapsed(false)
    }
  }, [statusDockTab, setChromeCollapsed])

  const activateDockTab = (tab: StatusDockTab) => {
    if (tab === statusDockTab) {
      setDockExpanded((expanded) => !expanded)
      return
    }
    onStatusDockTabChange(tab)
  }

  const toggleChrome = useCallback(() => {
    if (chromeCollapsed) setDockExpanded(true)
    setChromeCollapsed(!chromeCollapsed)
  }, [chromeCollapsed, setChromeCollapsed])

  const summaryTab: StatusDockTab = totalProblemCount > 0 ? 'problems' : 'jobs'
  const indexComplete = workspaceStatus !== 'indexing' && graphProgress >= 100
  const completedNoteCount = rebuildSummary
    ? rebuildSummary.indexed_notes + rebuildSummary.skipped_notes
    : noteCount

  return (
    <footer className={`status-strip${chromeCollapsed ? ' is-dock-collapsed' : ''}`}>
      <div className="status-summary">
        <button
          type="button"
          className={`jobs-button${totalProblemCount > 0 ? ' has-problems' : ''}`}
          onClick={() => {
            if (chromeCollapsed) {
              setChromeCollapsed(false)
              setDockExpanded(true)
              onStatusDockTabChange(summaryTab)
            } else {
              activateDockTab(summaryTab)
            }
          }}
          aria-pressed={statusDockTab === summaryTab}
          aria-expanded={statusDockTab === summaryTab && dockExpanded && !chromeCollapsed}
        >
          {totalProblemCount > 0 ? <AlertTriangle /> : <PanelRight />}
          {totalProblemCount > 0 ? (
            <>{t('statusDock.problems')} <span>{totalProblemCount}</span></>
          ) : (
            t('statusDock.backgroundJobs')
          )}
          <ChevronDown />
        </button>

        <button
          type="button"
          className="dock-chrome-toggle has-custom-tooltip"
          onClick={toggleChrome}
          aria-expanded={!chromeCollapsed}
          aria-controls="status-dock-chrome"
          aria-label={chromeCollapsed ? t('statusDock.showTabs') : t('statusDock.hideTabs')}
        >
          {chromeCollapsed ? <ChevronRight /> : <ChevronDown />}
          <span className="custom-tooltip" aria-hidden="true">
            {chromeCollapsed ? t('statusDock.showTabs') : t('statusDock.hideTabs')}
          </span>
        </button>

        {indexComplete ? (
          <div className="job-progress is-done" aria-label={t('statusDock.indexReadyAria', { percent: graphProgress })}>
            <CheckCircle2 />
            <strong>{t('statusDock.indexReady')}</strong>
            <small>
              {t('statusDock.notesCount', { count: completedNoteCount })}
              {diagnosticsOptIn && lastRebuildMs != null ? ` · ${lastRebuildMs}ms` : ''}
            </small>
          </div>
        ) : (
          <div
            className="job-progress"
            aria-label={t('statusDock.buildingGraphAria', { percent: graphProgress })}
          >
            <Activity />
            <div>
              <strong>{t('statusDock.buildingIndex')}</strong>
              <div className="progress-track">
                <span style={{ width: `${graphProgress}%` }} />
              </div>
            </div>
            <span>{graphProgress}%</span>
            <small>
              {rebuildSummary
                ? t('statusDock.notesProgress', { done: completedNoteCount, total: noteCount })
                : t('statusDock.notesCount', { count: noteCount })}
            </small>
          </div>
        )}

        <div className="repo-state">
          <label
            className="diagnostics-opt-in"
            title={t('statusDock.diagnosticsTitle')}
          >
            <input
              type="checkbox"
              checked={diagnosticsOptIn}
              onChange={(event) => onDiagnosticsOptInChange(event.target.checked)}
              aria-label={t('statusDock.diagnosticsOptInAria')}
            />
            <span>{t('statusDock.diagnostics')}</span>
          </label>
          <span>{health?.cache_status ?? 'no vault'}</span>
          {diagnosticsOptIn && timeToFirstEditMs != null ? <span title="Time to first edit this session">TTFE {timeToFirstEditMs < 1000 ? `${timeToFirstEditMs}ms` : `${(timeToFirstEditMs / 1000).toFixed(1)}s`}</span> : null}
          {diagnosticsOptIn && timeToFirstExportMs != null ? <span title="Time to first export this session">TTFX {(timeToFirstExportMs / 1000).toFixed(1)}s</span> : null}
          <SubsystemToggles
            graph={hibernateGraph}
            onGraphChange={onHibernateGraphChange}
            mcp={hibernateMcp}
            onMcpChange={onHibernateMcpChange}
            watcher={hibernateWatcher}
            onWatcherChange={onHibernateWatcherChange}
            git={hibernateGit}
            onGitChange={onHibernateGitChange}
            spellcheck={hibernateSpellcheck}
            onSpellcheckChange={onHibernateSpellcheckChange}
          />
          <GitBranch />
          <span>{vault?.name ?? t('statusDock.unopened')}</span>
          <CheckCircle2 />
        </div>
      </div>

      {!chromeCollapsed ? (
        <div className="bottom-tabs-wrap" id="status-dock-chrome">
          <StatusDockPanel
            activeTab={statusDockTab}
            onTabChange={activateDockTab}
            expanded={dockExpanded}
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
      ) : null}
    </footer>
  )
}