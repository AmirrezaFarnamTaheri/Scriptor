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
  onImportZotero?: (apiKey: string) => Promise<void>
}

export function BibliographyPanel({
  entries,
  bibliographyPath = 'references.bib',
  onClose,
  onInsertCitation,
  onImportBibliography,
  onImportZotero,
}: BibliographyPanelProps) {
  const [query, setQuery] = useState('')
  const [dropActive, setDropActive] = useState(false)
  const [zoteroOpen, setZoteroOpen] = useState(false)
  const [zoteroKey, setZoteroKey] = useState('')
  const [zoteroLoading, setZoteroLoading] = useState(false)
  const [zoteroError, setZoteroError] = useState<string | null>(null)
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

  const handleZoteroSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!zoteroKey.trim() || !onImportZotero) return
    setZoteroLoading(true)
    setZoteroError(null)
    try {
      await onImportZotero(zoteroKey.trim())
      setZoteroOpen(false)
      setZoteroKey('')
    } catch (err) {
      setZoteroError(err instanceof Error ? err.message : String(err))
    } finally {
      setZoteroLoading(false)
    }
  }

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

        {onImportZotero && (
          <div className="bibliography-actions" style={{ marginBottom: '8px' }}>
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setZoteroOpen((prev) => !prev)}
              disabled={zoteroLoading}
            >
              {zoteroOpen ? 'Cancel Import' : 'Import from Zotero'}
            </button>
          </div>
        )}

        {zoteroOpen && onImportZotero && (
          <form onSubmit={handleZoteroSubmit} className="zotero-import-form" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <label className="settings-field">
              Zotero Read API Key
              <input
                type="password"
                value={zoteroKey}
                onChange={(e) => setZoteroKey(e.target.value)}
                placeholder="Paste API key"
                required
                disabled={zoteroLoading}
              />
            </label>
            <div>
              <button type="submit" className="action-button" disabled={zoteroLoading || !zoteroKey.trim()}>
                {zoteroLoading ? 'Importing...' : 'Fetch & Save to .bib'}
              </button>
            </div>
            {zoteroError && <p className="preview-error" style={{ color: 'var(--color-error, #e53e3e)' }}>{zoteroError}</p>}
          </form>
        )}

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
