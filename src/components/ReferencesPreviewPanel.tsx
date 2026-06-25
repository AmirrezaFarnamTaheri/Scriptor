import { useMemo } from 'react'
import { BookMarked } from 'lucide-react'

import { buildReferencesBlock } from '../lib/citationFormat'
import { useCiteprocPreview } from '../hooks/useCiteprocPreview'
import type { BibliographyEntry } from '../types/vault'

interface ReferencesPreviewPanelProps {
  citationKeys: string[]
  bibliography: BibliographyEntry[]
  onInsertBlock: (markdown: string) => void
}

export function ReferencesPreviewPanel({
  citationKeys,
  bibliography,
  onInsertBlock,
}: ReferencesPreviewPanelProps) {
  const entries = useMemo(() => {
    const byKey = new Map(bibliography.map((entry) => [entry.key, entry]))
    return citationKeys
      .map((key) => byKey.get(key))
      .filter((entry): entry is BibliographyEntry => Boolean(entry))
  }, [bibliography, citationKeys])

  const block = useMemo(() => buildReferencesBlock(entries), [entries])
  const { formatInline, formatBibliography, usingCiteproc } = useCiteprocPreview(bibliography, citationKeys)

  return (
    <section className="references-preview-panel" aria-label="References in note">
      <header>
        <h3>
          <BookMarked size={16} />
          References in note
        </h3>
        <p className="health-subtitle">
          {entries.length === 0
            ? 'Cite keys with [@key] to preview formatted references.'
            : `${entries.length} resolved citation${entries.length === 1 ? '' : 's'}${usingCiteproc ? ' · CSL preview' : ''}`}
        </p>
      </header>

      {entries.length > 0 ? (
        <>
          <ol className="references-preview-list">
            {entries.map((entry) => (
              <li key={entry.key}>
                <strong>{entry.key}</strong>
                <span>{formatInline(entry)}</span>
                <small>{formatBibliography(entry)}</small>
              </li>
            ))}
          </ol>
          {block ? (
            <button type="button" className="toolbar-button" onClick={() => onInsertBlock(block)}>
              Insert references section
            </button>
          ) : null}
        </>
      ) : (
        <p className="empty-state">No resolved citations in this note.</p>
      )}
    </section>
  )
}
