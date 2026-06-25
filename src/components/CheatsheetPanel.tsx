import { BookOpen, X } from 'lucide-react'

import { MERMAID_SNIPPETS, MATH_SNIPPETS } from '@scriptor/editor'
import { useEscapeToClose } from '../hooks/useEscapeToClose'

interface CheatsheetPanelProps {
  onClose: () => void
}

const MARKDOWN_REFERENCE = [
  { label: 'Bold / italic', value: '**bold** / *italic*' },
  { label: 'Wikilink', value: '[[Note Title]]' },
  { label: 'Embed note', value: '![[Note Title#Section]]' },
  { label: 'Citation', value: '[@citekey]' },
  { label: 'Tag', value: '#tag' },
  { label: 'Alert', value: '> [!NOTE]\n> Callout text' },
  { label: 'DQL block', value: '```dql\npath has #tag\n```' },
  { label: 'Find / replace', value: 'Ctrl+F / Ctrl+H' },
]

export function CheatsheetPanel({ onClose }: CheatsheetPanelProps) {
  useEscapeToClose(true, onClose)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="cheatsheet-panel knowledge-filters-panel"
        role="dialog"
        aria-label="Markdown cheatsheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>
              <BookOpen size={18} />
              Cheatsheet
            </h2>
            <p className="health-subtitle">Markdown, wikilinks, DQL, and insert templates</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close cheatsheet">
            <X />
          </button>
        </header>

        <div className="cheatsheet-body knowledge-filter-body">
          <section>
            <h3>Syntax</h3>
            <dl className="cheatsheet-list">
              {MARKDOWN_REFERENCE.map((entry) => (
                <div key={entry.label}>
                  <dt>{entry.label}</dt>
                  <dd>
                    <code>{entry.value}</code>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3>Mermaid templates</h3>
            <ul className="cheatsheet-snippet-list">
              {MERMAID_SNIPPETS.map((snippet) => (
                <li key={snippet.name}>
                  <strong>{snippet.description}</strong>
                  <pre>{snippet.content.trim()}</pre>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Math templates</h3>
            <ul className="cheatsheet-snippet-list">
              {MATH_SNIPPETS.map((snippet) => (
                <li key={snippet.name}>
                  <strong>{snippet.description}</strong>
                  <pre>{snippet.content.trim()}</pre>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  )
}
