import { useState, useRef } from 'react'
import { FileText, FilePlus2 } from 'lucide-react'
import type { TemplateDefinition } from '../lib/knowledge/templates'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import '../styles/components/template-picker.css'

interface TemplatePickerProps {
  templates: TemplateDefinition[]
  onSelect: (template: TemplateDefinition | null) => void
  onClose: () => void
}

/**
 * Modal for choosing a note template before creation.
 * Selecting "Blank" returns null; selecting a template returns the definition.
 * Keyboard: ArrowUp/Down navigate, Enter confirms, Escape closes.
 */
export function TemplatePicker({ templates, onSelect, onClose }: TemplatePickerProps) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [prevQuery, setPrevQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, { active: true })
  useEscapeToClose(true, onClose)

  const allOptions: Array<{ label: string; value: TemplateDefinition | null }> = [
    { label: 'Blank note', value: null },
    ...templates.map((t) => ({ label: t.name, value: t })),
  ]

  const filtered = query.trim()
    ? allOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOptions

  // Clamp active index when the filter query changes (adjust-state-during-render pattern).
  if (query !== prevQuery) {
    setPrevQuery(query)
    setActiveIdx(0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = filtered[activeIdx]
      if (chosen !== undefined) onSelect(chosen.value)
    }
  }

  /** Stable DOM id per option so the search box can point at the active one. */
  const optionId = (index: number) => `template-picker-option-${index}`
  const activeOptionId =
    filtered.length > 0 && activeIdx < filtered.length ? optionId(activeIdx) : undefined

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Choose template">
      <div ref={containerRef} className="template-picker-modal" onKeyDown={handleKeyDown}>
        <header className="template-picker__header">
          <h2 className="template-picker__title">New note from template</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <input
          className="template-picker__search"
          type="search"
          placeholder="Filter templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          aria-label="Filter templates"
          role="combobox"
          aria-expanded
          aria-controls="template-picker-listbox"
          aria-activedescendant={activeOptionId}
        />

        <ol
          id="template-picker-listbox"
          className="template-picker__list"
          role="listbox"
          aria-label="Templates"
        >
          {filtered.length === 0 ? (
            <li className="template-picker__empty">No templates match.</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value?.path ?? '__blank-note__'}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIdx}
                className={[
                  'template-picker__item',
                  i === activeIdx ? 'template-picker__item--active' : '',
                ]
                  .join(' ')
                  .trim()}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => onSelect(opt.value)}
              >
                <span className="template-picker__icon" aria-hidden="true">
                  {opt.value ? <FileText size={16} /> : <FilePlus2 size={16} />}
                </span>
                {opt.label}
              </li>
            ))
          )}
        </ol>

        <footer className="template-picker__footer">
          <kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> cancel
        </footer>
      </div>
    </div>
  )
}
