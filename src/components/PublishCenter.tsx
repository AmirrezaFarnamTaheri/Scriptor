import { useMemo } from 'react'
import { FileOutput, Globe, History, Loader2 } from 'lucide-react'

import type { ExportProfile } from '@scriptor/core/contracts/export'

import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type { ExportJobOutput, ExportJobRecord } from '../types/vault'

interface PublishCenterProps {
  activePath: string | null
  exportProfiles: ExportProfile[]
  exportHistory: ExportJobRecord[]
  exportResult: ExportJobOutput | null
  isExporting: boolean
  nativeReady: boolean
  onClose: () => void
  onExport: (profileId: string, dryRun?: boolean) => void
  onCancelExport: () => void
  onPublishStarlight: () => void
}

function formatStatus(entry: ExportJobRecord): string {
  if (entry.status === 'running') return 'Running…'
  if (entry.status === 'success') return 'Success'
  if (entry.status === 'dry-run') return 'Dry run'
  if (entry.status === 'cancelled') return 'Cancelled'
  if (entry.status === 'error') return 'Failed'
  return entry.status
}

export function PublishCenter({
  activePath,
  exportProfiles,
  exportHistory,
  exportResult,
  isExporting,
  nativeReady,
  onClose,
  onExport,
  onCancelExport,
  onPublishStarlight,
}: PublishCenterProps) {
  const subtitle = useMemo(() => {
    if (!activePath) return 'Open a note to export or publish.'
    if (isExporting) return `Exporting ${activePath}…`
    return `Active note: ${activePath}`
  }, [activePath, isExporting])

  return (
    <UnifiedPanelShell
      title="Publish center"
      subtitle={subtitle}
      icon={<FileOutput size={18} />}
      ariaLabel="Publish center"
      onClose={onClose}
      className="publish-center-panel knowledge-filters-panel"
      wide
      headerActions={
        isExporting ? (
          <button type="button" className="toolbar-button" onClick={onCancelExport}>
            Cancel export
          </button>
        ) : null
      }
    >
      <div className="publish-center-grid">
        <section className="publish-center-section">
          <h3>
            <FileOutput size={16} />
            Export profiles
          </h3>
          <p className="health-subtitle">
            Pandoc profiles from your vault config and installed plugins.
          </p>
          <ul className="publish-profile-list">
            {exportProfiles.map((profile) => (
              <li key={profile.id}>
                <div>
                  <strong>{profile.label}</strong>
                  <small>{profile.format.toUpperCase()} · {profile.outputDirectory}</small>
                </div>
                <div className="publish-profile-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={!activePath || isExporting}
                    onClick={() => onExport(profile.id, true)}
                  >
                    Dry run
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!activePath || isExporting || !nativeReady}
                    onClick={() => onExport(profile.id, false)}
                  >
                    {isExporting ? <Loader2 className="spin" size={14} /> : null}
                    Export
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="publish-center-section">
          <h3>
            <Globe size={16} />
            Site publishing
          </h3>
          <p className="health-subtitle">
            Build a Starlight documentation site from your vault notes.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={!nativeReady}
            onClick={onPublishStarlight}
          >
            Publish Starlight site
          </button>
        </section>

        <section className="publish-center-section publish-center-history">
          <h3>
            <History size={16} />
            Recent exports
          </h3>
          {exportHistory.length === 0 ? (
            <p className="empty-state">No exports yet for this session.</p>
          ) : (
            <ul className="publish-history-list">
              {exportHistory.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.profile_label}</strong>
                    <small>{entry.note_path}</small>
                  </div>
                  <span className={`publish-status publish-status-${entry.status}`}>{formatStatus(entry)}</span>
                  {entry.result?.artifact_path ? (
                    <code className="publish-artifact">{entry.result.artifact_path}</code>
                  ) : entry.error ? (
                    <small className="publish-error">{entry.error}</small>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {exportResult ? (
          <section className="publish-center-section">
            <h3>Latest result</h3>
            <pre className="mcp-result" aria-live="polite">
              {JSON.stringify(exportResult, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </UnifiedPanelShell>
  )
}
