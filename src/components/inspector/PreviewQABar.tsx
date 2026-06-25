interface PreviewQABarProps {
  activePath: string | null
  isNoteDirty: boolean
  missingCitations: number
  onOpenPublish: () => void
}

export function PreviewQABar({ activePath, isNoteDirty, missingCitations, onOpenPublish }: PreviewQABarProps) {
  if (!activePath) return null

  const renderStatus = isNoteDirty ? 'Draft (unsaved)' : 'Synced with editor'
  const exportStatus =
    missingCitations > 0
      ? `${missingCitations} citation${missingCitations === 1 ? '' : 's'} need bibliography entries`
      : isNoteDirty
        ? 'Save note before export'
        : 'Ready to export'

  return (
    <div className="preview-qa-bar" role="status" aria-label="Preview quality">
      <div>
        <strong>Render</strong>
        <span>{renderStatus}</span>
      </div>
      <div>
        <strong>Export</strong>
        <span>{exportStatus}</span>
      </div>
      <button type="button" className="toolbar-button" onClick={onOpenPublish}>
        Publish center
      </button>
    </div>
  )
}
