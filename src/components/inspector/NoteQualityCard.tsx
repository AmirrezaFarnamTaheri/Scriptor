import { AlertTriangle, CheckCircle2, FileOutput, Network } from 'lucide-react'

import { WidgetCard } from '../chrome/WorkspaceChrome'
import type { VaultHealthReport } from '../../types/vault'
import { useI18n } from '../../lib/i18n'

interface NoteQualityCardProps {
  activePath: string | null
  health: VaultHealthReport | null
  outboundLinks: number
  backlinkCount: number
  citationKeys: string[]
  bibliographyKeys: Set<string>
  isNoteDirty: boolean
  onOpenWorkbench: () => void
  onOpenPublish: () => void
  onOpenGraph: () => void
}

export function NoteQualityCard({
  activePath,
  health,
  outboundLinks,
  backlinkCount,
  citationKeys,
  bibliographyKeys,
  isNoteDirty,
  onOpenWorkbench,
  onOpenPublish,
  onOpenGraph,
}: NoteQualityCardProps) {
  const { t } = useI18n()
  if (!activePath) {
    return (
      <WidgetCard title={t('noteQuality.title')}>
        <p className="empty-state">{t('noteQuality.openNote')}</p>
      </WidgetCard>
    )
  }

  const missingCitations = citationKeys.filter((key) => !bibliographyKeys.has(key))
  const orphanRisk = backlinkCount === 0 && outboundLinks > 0
  const exportReady = !isNoteDirty && missingCitations.length === 0
  const vaultBroken = (health?.broken_links ?? 0) > 0

  const issues: string[] = []
  if (missingCitations.length > 0) {
    issues.push(t('noteQuality.unresolvedCitations', { count: missingCitations.length }))
  }
  if (orphanRisk) {
    issues.push(t('noteQuality.noInboundLinks'))
  }
  if (isNoteDirty) {
    issues.push(t('noteQuality.unsavedEdits'))
  }
  if (vaultBroken) {
    issues.push(t('noteQuality.brokenLinksInVault', { count: health?.broken_links ?? 0 }))
  }

  return (
    <WidgetCard title={t('noteQuality.title')}>
      <div className="note-quality-status">
        {exportReady && issues.length === 0 ? (
          <p className="note-quality-good">
            <CheckCircle2 size={14} aria-hidden="true" />
            {t('noteQuality.readyToExport')}
          </p>
        ) : (
          <p className="note-quality-warn">
            <AlertTriangle size={14} aria-hidden="true" />
            {issues.length > 0 ? issues[0] : t('noteQuality.reviewBeforePublishing')}
          </p>
        )}
      </div>

      <ul className="note-quality-metrics">
        <li>
          <span>{t('noteQuality.outboundLinks')}</span>
          <strong>{outboundLinks}</strong>
        </li>
        <li>
          <span>{t('noteQuality.backlinks')}</span>
          <strong>{backlinkCount}</strong>
        </li>
        <li>
          <span>{t('noteQuality.citations')}</span>
          <strong>
            {citationKeys.length}
            {missingCitations.length > 0 ? ` (${t('noteQuality.missingCount', { count: missingCitations.length })})` : ''}
          </strong>
        </li>
      </ul>

      {issues.length > 1 ? (
        <ul className="note-quality-issues">
          {issues.slice(1).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      <div className="note-quality-actions">
        <button type="button" className="toolbar-button" onClick={onOpenWorkbench}>
          {t('noteQuality.repairIssues')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenGraph}>
          <Network size={14} aria-hidden="true" />
          {t('noteQuality.graph')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenPublish}>
          <FileOutput size={14} aria-hidden="true" />
          {t('noteQuality.exportPublish')}
        </button>
      </div>
    </WidgetCard>
  )
}
