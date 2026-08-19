import { useMemo } from 'react'
import { FileOutput, Globe, History, Loader2 } from 'lucide-react'

import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { DqlResultRow, CodeChunkRunResult } from '@scriptor/renderer'

import { ExportPreflightPreview } from './ExportPreflightPreview'
import { ExportPrintPreview } from './ExportPrintPreview'
import { PublishDiffView } from './PublishDiffView'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { supportsPrintPagePreview } from '@scriptor/export'
import type { ExportJobOutput, ExportJobRecord, PublishPlan } from '../types/vault'

interface PublishCenterProps {
  activePath: string | null
  draftMarkdown: string
  previewProps: {
    fetchNote?: (target: string) => Promise<string | null>
    readVaultText?: (path: string) => Promise<string | null>
    executeDql?: (query: string) => Promise<DqlResultRow[]>
    runCodeChunk?: (language: string, code: string) => Promise<CodeChunkRunResult>
    postProcessHtml?: (html: string) => string
    renderPlantUmlLocal?: (source: string) => Promise<string | null>
  }
  exportProfiles: ExportProfile[]
  exportHistory: ExportJobRecord[]
  exportResult: ExportJobOutput | null
  isExporting: boolean
  nativeReady: boolean
  /** Publish plan returned by vault_publish_plan_starlight — null until the user initiates a plan. */
  publishPlan?: PublishPlan | null
  /** True while vault_publish_apply_starlight is running. */
  applyingPlan?: boolean
  /** Whether the plan was built with requireFrontmatterOptIn = true (default). */
  publishRequireOptIn?: boolean
  onClose: () => void
  onExport: (profileId: string, dryRun?: boolean) => void
  onCancelExport: () => void
  /** Initiates the read-only vault_publish_plan_starlight scan. */
  onPlanStarlight: () => void
  /** Discards the current plan and re-runs vault_publish_plan_starlight. */
  onReplanStarlight?: () => void
  /** Applies the reviewed plan with the given selection and orphan deletions. */
  onApplyPlan?: (selectedPaths: string[], deleteOrphans: string[]) => void
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
  draftMarkdown,
  previewProps,
  exportProfiles,
  exportHistory,
  exportResult,
  isExporting,
  nativeReady,
  publishPlan = null,
  applyingPlan = false,
  publishRequireOptIn = true,
  onClose,
  onExport,
  onCancelExport,
  onPlanStarlight,
  onReplanStarlight,
  onApplyPlan,
}: PublishCenterProps) {
  const handleReplanStarlight = onReplanStarlight ?? onPlanStarlight
  const handleApplyPlan = onApplyPlan ?? (() => {})

  const subtitle = useMemo(() => {
    if (!activePath) return 'Open a note to export or publish.'
    if (isExporting) return `Exporting ${activePath}…`
    return `Active note: ${activePath}`
  }, [activePath, isExporting])

  const preflightProfileLabel = useMemo(() => {
    if (!exportResult?.dry_run) return null
    const match = exportHistory.find((entry) => entry.result?.job_id === exportResult.job_id)
    return match?.profile_label ?? exportResult.format
  }, [exportHistory, exportResult])

  const preflightProfile = useMemo(() => {
    if (!preflightProfileLabel) return null
    return exportProfiles.find((profile) => profile.label === preflightProfileLabel) ?? null
  }, [exportProfiles, preflightProfileLabel])

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

        {exportResult?.dry_run && preflightProfileLabel ? (
          <ExportPreflightPreview
            result={exportResult}
            profileLabel={preflightProfileLabel}
            activePath={activePath}
            draftMarkdown={draftMarkdown}
            previewProps={previewProps}
          />
        ) : null}

        {exportResult?.dry_run && preflightProfile && supportsPrintPagePreview(preflightProfile.format) ? (
          <ExportPrintPreview markdown={draftMarkdown} activePath={activePath} previewProps={previewProps} />
        ) : null}

        <section className="publish-center-section">
          <h3>
            <Globe size={16} />
            Site publishing
          </h3>
          {publishPlan != null ? (
            <PublishDiffView
              plan={publishPlan}
              requireFrontmatterOptIn={publishRequireOptIn}
              onApply={handleApplyPlan}
              onReplan={handleReplanStarlight}
              applying={applyingPlan}
            />
          ) : (
            <>
              <p className="health-subtitle">
                Build a Starlight documentation site from your vault notes.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={!nativeReady}
                onClick={onPlanStarlight}
              >
                Plan Starlight publish
              </button>
            </>
          )}
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

        {exportResult && !exportResult.dry_run ? (
          <section className="publish-center-section">
            <h3>Latest export</h3>
            <p className="health-subtitle">Artifact written to disk.</p>
            <code className="publish-artifact">{exportResult.artifact_path}</code>
          </section>
        ) : null}
      </div>
    </UnifiedPanelShell>
  )
}
