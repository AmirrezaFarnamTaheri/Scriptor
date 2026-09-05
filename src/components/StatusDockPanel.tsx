import { useState, type ReactNode } from 'react'

import { useI18n } from '../lib/i18n'
import type { ActivityEntry } from '../hooks/useActivityLog'
import type { ExportJobOutput, ExportJobRecord, SearchHit } from '../types/vault'
import { useTablistKeys } from '../hooks/useTablistKeys'

export type StatusDockTab = 'problems' | 'output' | 'search' | 'jobs'

interface StatusDockPanelProps {
  activeTab: StatusDockTab
  onTabChange: (tab: StatusDockTab) => void
  expanded: boolean
  problemCount: number
  issuesPanel: ReactNode
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
}

export function StatusDockPanel({
  activeTab,
  onTabChange,
  expanded,
  problemCount,
  issuesPanel,
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
}: StatusDockPanelProps) {
  const { t } = useI18n()
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const runningJob = exportHistory.find((job) => job.status === 'running')
  const liveExportOutput = runningJob?.live_stderr ?? ''
  const DOCK_TABS: readonly string[] = ['problems', 'output', 'search', 'jobs']
  const handleTablistKeys = useTablistKeys(DOCK_TABS, activeTab, (id) => onTabChange(id as StatusDockTab))

  return (
    <>
      <div className="bottom-tabs" role="tablist" aria-label="Status dock" onKeyDown={handleTablistKeys}>
        <button
          type="button"
          role="tab"
          tabIndex={activeTab === 'problems' ? 0 : -1}
          id={'dock-tab-problems'}
          aria-selected={activeTab === 'problems'}
          aria-expanded={activeTab === 'problems' && expanded}
          aria-controls="dock-panel-problems"
          className={activeTab === 'problems' ? 'active' : ''}
          onClick={() => onTabChange('problems')}
        >
          {t('statusDock.problems')} <span>{problemCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          tabIndex={activeTab === 'output' ? 0 : -1}
          id={'dock-tab-output'}
          aria-selected={activeTab === 'output'}
          aria-expanded={activeTab === 'output' && expanded}
          aria-controls="dock-panel-output"
          className={activeTab === 'output' ? 'active' : ''}
          onClick={() => onTabChange('output')}
        >
          {t('statusDock.output')}
        </button>
        <button
          type="button"
          role="tab"
          tabIndex={activeTab === 'search' ? 0 : -1}
          id={'dock-tab-search'}
          aria-selected={activeTab === 'search'}
          aria-expanded={activeTab === 'search' && expanded}
          aria-controls="dock-panel-search"
          className={activeTab === 'search' ? 'active' : ''}
          onClick={() => onTabChange('search')}
        >
          {t('statusDock.searchResults')} <span>{searchResults.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          tabIndex={activeTab === 'jobs' ? 0 : -1}
          id={'dock-tab-jobs'}
          aria-selected={activeTab === 'jobs'}
          aria-expanded={activeTab === 'jobs' && expanded}
          aria-controls="dock-panel-jobs"
          className={activeTab === 'jobs' ? 'active' : ''}
          onClick={() => onTabChange('jobs')}
        >
          {t('statusDock.jobs')} <span>{exportHistory.length}</span>
        </button>
      </div>

      {activeTab === 'problems' && expanded ? (
        <div id="dock-panel-problems" role="tabpanel" aria-labelledby="dock-tab-problems">
          {issuesPanel}
        </div>
      ) : null}

      {activeTab === 'output' && expanded ? (
        <section className="dock-panel" id="dock-panel-output" role="tabpanel" aria-labelledby="dock-tab-output">
          <header>
            <strong>{t('statusDock.output')}</strong>
          </header>
          {activity.length === 0 && !exportResult ? (
            <p className="empty-state">{t('statusDock.noOutput')}</p>
          ) : (
            <ul className="dock-list">
              {activity.map((entry) => (
                <li key={entry.id} className={`activity-${entry.kind}`}>
                  <span>{new Date(entry.ts).toLocaleTimeString()}</span>
                  <strong>{entry.message}</strong>
                  {entry.detail ? <small>{entry.detail}</small> : null}
                </li>
              ))}
              {exportResult ? (
                <li>
                  <strong>{exportResult.dry_run ? t('statusDock.exportDryRun') : t('statusDock.exportComplete')}</strong>
                  <small>{exportResult.artifact_path}</small>
                </li>
              ) : null}
              {isExporting ? (
                <li className="activity-job">
                  <strong>{t('statusDock.exportInProgress')}</strong>
                  {runningJob ? <small>{runningJob.profile_label}</small> : null}
                  {liveExportOutput ? <pre className="export-live-output">{liveExportOutput}</pre> : null}
                </li>
              ) : null}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'search' && expanded ? (
        <section className="dock-panel" id="dock-panel-search" role="tabpanel" aria-labelledby="dock-tab-search">
          <header>
            <strong>{t('statusDock.searchResults')}</strong>
            {searchQuery ? <span>for “{searchQuery}”</span> : null}
          </header>
          {isSearching ? <p className="empty-state">{t('statusDock.searching')}</p> : null}
          {!isSearching && searchResults.length === 0 ? (
            <p className="empty-state">{t('statusDock.noSearchResults')}</p>
          ) : (
            <ul className="dock-list">
              {searchResults.map((hit) => (
                <li key={`${hit.path}:${hit.note_id}`}>
                  <button type="button" onClick={() => onOpenNote(hit.path)}>
                    <strong>
                      {hit.title}
                      {hit.semantic ? <span className="search-hit-semantic">semantic</span> : null}
                    </strong>
                    <span>{hit.path}</span>
                    <small>{hit.snippet}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'jobs' && expanded ? (
        <section className="dock-panel jobs-panel" id="dock-panel-jobs" role="tabpanel" aria-labelledby="dock-tab-jobs">
          <header>
            <strong>{t('statusDock.backgroundJobs')}</strong>
          </header>
          <ul className="dock-list">
            <li className={isIndexing ? 'activity-job' : 'activity-success'}>
              <strong>{t('statusDock.indexRebuild')}</strong>
              <span>{isIndexing ? `${graphProgress}%` : t('statusDock.ready')}</span>
            </li>
            <li className={isExporting ? 'activity-job' : ''}>
              <strong>{t('statusDock.export')}</strong>
              <span>{isExporting ? t('statusDock.running') : exportResult ? t('statusDock.complete') : t('statusDock.idle')}</span>
              {isExporting ? (
                <button type="button" className="toolbar-button export-cancel-button" onClick={onCancelExport}>
                  {t('statusDock.cancelExport')}
                </button>
              ) : null}
            </li>
          </ul>

          <header className="jobs-history-header">
            <strong>{t('statusDock.exportHistory')}</strong>
          </header>
          {exportHistory.length === 0 ? (
            <p className="empty-state">{t('statusDock.noExports')}</p>
          ) : (
            <ul className="dock-list export-history-list">
              {exportHistory.map((job) => {
                const expanded = expandedJobId === job.id
                return (
                  <li key={job.id} className={`export-job-${job.status}`}>
                    <button
                      type="button"
                      className="export-job-toggle"
                      onClick={() => setExpandedJobId(expanded ? null : job.id)}
                    >
                      <strong>{job.profile_label}</strong>
                      <span>{job.note_path}</span>
                      <small>
                        {job.status === 'running'
                          ? 'Running…'
                          : `${new Date(job.finished_at).toLocaleTimeString()} · ${job.status}`}
                        {job.result ? ` · ${job.result.duration_ms}ms` : ''}
                      </small>
                    </button>
                    {expanded ? (
                      <div className="export-job-details">
                        {job.status === 'running' && job.live_stderr ? (
                          <pre className="export-live-output">{job.live_stderr}</pre>
                        ) : null}
                        {job.error ? <pre>{job.error}</pre> : null}
                        {job.result ? (
                          <>
                            <p>{job.result.artifact_path}</p>
                            <pre>{job.result.command.join(' ')}</pre>
                            {job.result.stderr ? <pre>{job.result.stderr}</pre> : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </>
  )
}
