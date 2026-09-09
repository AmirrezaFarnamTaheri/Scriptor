import { FileOutput, Quote } from 'lucide-react'

interface InlineEditorAssistProps {
  activePath: string | null
  brokenLinkCount?: number
  citationCount?: number
  onInsertCitation: () => void
  onOpenExport: () => void
}

/** Exposes the two document-context actions that are not already present in the primary editor toolbar. */
export function InlineEditorAssist({
  activePath,
  brokenLinkCount = 0,
  citationCount = 0,
  onInsertCitation,
  onOpenExport,
}: InlineEditorAssistProps) {
  if (!activePath) return null

  return (
    <div className="format-group inline-editor-assist" aria-label="Document actions">
      <button type="button" className="toolbar-button" onClick={onInsertCitation} title="Insert citation">
        <Quote size={14} aria-hidden="true" />
        Cite{citationCount > 0 ? ` (${citationCount})` : ''}
      </button>
      <button type="button" className="toolbar-button" onClick={onOpenExport} title="Open export center">
        <FileOutput size={14} aria-hidden="true" />
        Export{brokenLinkCount > 0 ? ` · ${brokenLinkCount} issues` : ''}
      </button>
    </div>
  )
}
