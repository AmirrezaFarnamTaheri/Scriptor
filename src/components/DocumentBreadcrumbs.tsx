import type { TocEntry } from '@scriptor/editor'

interface DocumentBreadcrumbsProps {
  /** Flat TOC entries from the active note. */
  entries: TocEntry[]
  /** Current editor line (used to derive the active heading path). */
  activeLine?: number
  /** Scroll editor to the given line. */
  onNavigate: (line: number) => void
}

/**
 * Displays an always-visible H1 > H2 > H3 breadcrumb path for the heading
 * that contains the current cursor position.
 *
 * Clicking any crumb scrolls the editor to that heading.
 */
export function DocumentBreadcrumbs({ entries, activeLine, onNavigate }: DocumentBreadcrumbsProps) {
  if (entries.length === 0) return null

  // Find the deepest heading whose line <= activeLine (i.e. the heading that
  // "contains" the cursor), then walk back up to build the ancestor chain.
  const effectiveLine = activeLine ?? 0
  let activeEntry: TocEntry | undefined
  for (const entry of entries) {
    if (entry.line <= effectiveLine) activeEntry = entry
    else break
  }

  if (!activeEntry) return null

  // Build ancestor chain: find the nearest ancestor at each level above.
  const path: TocEntry[] = []
  let targetLevel = activeEntry.level
  let remaining = entries.slice(0, entries.indexOf(activeEntry) + 1)
  while (targetLevel > 0 && remaining.length > 0) {
    // Walk backwards to find the closest entry at targetLevel
    for (let i = remaining.length - 1; i >= 0; i--) {
      const e = remaining[i]!
      if (e.level === targetLevel) {
        path.unshift(e)
        remaining = remaining.slice(0, i)
        break
      }
    }
    targetLevel--
  }

  if (path.length === 0) return null

  return (
    <nav className="doc-breadcrumbs" aria-label="Document outline breadcrumb">
      {path.map((entry, idx) => (
        <span key={`${entry.line}-${idx}`} className="doc-breadcrumbs__item">
          {idx > 0 && <span className="doc-breadcrumbs__sep" aria-hidden="true">›</span>}
          <button
            type="button"
            className="doc-breadcrumbs__crumb"
            onClick={() => onNavigate(entry.line)}
            title={`Go to heading: ${entry.text}`}
          >
            {entry.text.replace(/\{#[^}]+\}/, '').trim()}
          </button>
        </span>
      ))}
    </nav>
  )
}
