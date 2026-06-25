import { BookOpen, FileOutput, Link2, Quote } from 'lucide-react'

interface InlineEditorAssistProps {
  activePath: string | null
  hasFrontmatter: boolean
  brokenLinkCount?: number
  citationCount?: number
  onInsertWikilink: () => void
  onInsertCitation: () => void
  onOpenFrontmatter: () => void
  onOpenExport: () => void
}

export function InlineEditorAssist({
  activePath,
  hasFrontmatter,
  brokenLinkCount = 0,
  citationCount = 0,
  onInsertWikilink,
  onInsertCitation,
  onOpenFrontmatter,
  onOpenExport,
}: InlineEditorAssistProps) {
  if (!activePath) return null

  return (
    <div className="format-group inline-editor-assist" aria-label="Editor assistants">
      <button type="button" className="toolbar-button" onClick={onInsertWikilink} title="Insert wikilink">
        <Link2 size={14} />
        Link
      </button>
      <button type="button" className="toolbar-button" onClick={onInsertCitation} title="Insert citation">
        <Quote size={14} />
        Cite{citationCount > 0 ? ` (${citationCount})` : ''}
      </button>
      <button
        type="button"
        className={`toolbar-button${hasFrontmatter ? '' : ' emphasized'}`}
        onClick={onOpenFrontmatter}
        title="Edit YAML frontmatter"
      >
        <BookOpen size={14} />
        {hasFrontmatter ? 'Frontmatter' : 'Add frontmatter'}
      </button>
      <button type="button" className="toolbar-button" onClick={onOpenExport} title="Export readiness">
        <FileOutput size={14} />
        Export{brokenLinkCount > 0 ? ` · ${brokenLinkCount} issues` : ''}
      </button>
    </div>
  )
}
