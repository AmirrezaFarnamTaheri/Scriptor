import { useMemo, useState } from 'react'
import { BookOpen, X } from 'lucide-react'

import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useCiteprocPreview } from '../hooks/useCiteprocPreview'
import { isBibliographyFile } from '../lib/importVaultFiles'
import type { BibliographyEntry } from '../types/vault'

interface BibliographyPanelProps {
  entries: BibliographyEntry[]
  bibliographyPath?: string
  onClose: () => void
  onInsertCitation: (key: string) => void
  onImportBibliography?: (files: FileList) => Promise<void>
}

export function BibliographyPanel({
  entries,
  bibliographyPath = 'references.bib',
  onClose,
  onInsertCitation,
  onImportBibliography,
}: BibliographyPanelProps) {
  const [query, setQuery] = useState('')
  const [dropActive, setDropActive] = useState(false)
  useEscapeToClose(true, onClose)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter(
      (entry) =>
        entry.key.toLowerCase().includes(needle) ||
        entry.title.toLowerCase().includes(needle) ||
        entry.author?.toLowerCase().includes(needle) ||
        entry.year?.toLowerCase().includes(needle) ||
        entry.source_path.toLowerCase().includes(needle),
    )
  }, [entries, query])

  const { formatBibliography, usingCiteproc } = useCiteprocPreview(filtered)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`bibliography-panel${dropActive ? ' is-drop-target' : ''}`}
        role="dialog"
        aria-label="Bibliography"
        onClick={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          if (!onImportBibliography) return
          event.preventDefault()
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          if (!onImportBibliography) return
          event.preventDefault()
          setDropActive(false)
          const files = Array.from(event.dataTransfer.files).filter(isBibliographyFile)
          if (files.length > 0) {
            const list = new DataTransfer()
            files.forEach((file) => list.items.add(file))
            void onImportBibliography(list.files)
          }
        }}
      >
        <header>
          <div>
            <h2>
              <BookOpen size={18} />
              Bibliography
            </h2>
            <p className="health-subtitle">
              {entries.length === 0
                ? `Drop a .bib file here or add one at ${bibliographyPath}.`
                : `${filtered.length} of ${entries.length} entries${usingCiteproc ? ' · CSL preview' : ''}`}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close bibliography">
            <X />
          </button>
        </header>

        <label className="settings-field bibliography-search">
          Filter entries
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by key, title, or file"
          />
        </label>

        <ul className="bibliography-list">
          {filtered.length === 0 ? (
            <li className="empty-state">No bibliography entries match.</li>
          ) : (
            filtered.map((entry) => (
              <li key={`${entry.source_path}:${entry.key}`}>
                <button type="button" onClick={() => onInsertCitation(entry.key)}>
                  <strong>{entry.key}</strong>
                  <span>{formatBibliography(entry)}</span>
                  <small>{entry.source_path}</small>
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
