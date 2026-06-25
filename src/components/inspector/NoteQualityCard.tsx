import { AlertTriangle, CheckCircle2, FileOutput, Network } from 'lucide-react'

import { WidgetCard } from '../chrome/WorkspaceChrome'
import type { VaultHealthReport } from '../../types/vault'

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
  if (!activePath) {
    return (
      <WidgetCard title="Note quality">
        <p className="empty-state">Open a note to see quality guidance.</p>
      </WidgetCard>
    )
  }

  const missingCitations = citationKeys.filter((key) => !bibliographyKeys.has(key))
  const orphanRisk = backlinkCount === 0 && outboundLinks > 0
  const exportReady = !isNoteDirty && missingCitations.length === 0
  const vaultBroken = (health?.broken_links ?? 0) > 0

  const issues: string[] = []
  if (missingCitations.length > 0) {
    issues.push(`${missingCitations.length} unresolved citation${missingCitations.length === 1 ? '' : 's'}`)
  }
  if (orphanRisk) {
    issues.push('No inbound links — consider backlinking from related notes')
  }
  if (isNoteDirty) {
    issues.push('Unsaved edits — save before export')
  }
  if (vaultBroken) {
    issues.push(`${health?.broken_links ?? 0} broken links in vault`)
  }

  return (
    <WidgetCard title="Note quality">
      <div className="note-quality-status">
        {exportReady && issues.length === 0 ? (
          <p className="note-quality-good">
            <CheckCircle2 size={14} />
            Export ready
          </p>
        ) : (
          <p className="note-quality-warn">
            <AlertTriangle size={14} />
            {issues.length > 0 ? issues[0] : 'Review before publishing'}
          </p>
        )}
      </div>

      <ul className="note-quality-metrics">
        <li>
          <span>Outbound links</span>
          <strong>{outboundLinks}</strong>
        </li>
        <li>
          <span>Backlinks</span>
          <strong>{backlinkCount}</strong>
        </li>
        <li>
          <span>Citations</span>
          <strong>
            {citationKeys.length}
            {missingCitations.length > 0 ? ` (${missingCitations.length} missing)` : ''}
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
          Repair queue
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenGraph}>
          <Network size={14} />
          Graph
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenPublish}>
          <FileOutput size={14} />
          Publish
        </button>
      </div>
    </WidgetCard>
  )
}
