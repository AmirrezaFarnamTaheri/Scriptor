import type { TocEntry } from '@scriptor/editor'

interface TocSidebarProps {
  entries: TocEntry[]
  activeLine?: number
  onSelect: (line: number) => void
  onClose: () => void
}

export function TocSidebar({ entries, activeLine, onSelect, onClose }: TocSidebarProps) {
  return (
    <aside className="toc-sidebar" aria-label="Table of contents">
      <header>
        <h3>Outline</h3>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close outline">
          ×
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="empty-state">No headings in this note.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={`${entry.line}-${entry.id}`} data-level={entry.level}>
              <button
                type="button"
                className={activeLine === entry.line ? 'active' : undefined}
                onClick={() => onSelect(entry.line)}
                title={entry.id}
              >
                <span className="toc-level">{entry.renderedLevel}</span>
                {entry.text.replace(/\{#([^}]+)\}/, '').trim()}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
