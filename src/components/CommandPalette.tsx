import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../lib/i18n'

export interface PaletteCommand {
  id: string
  label: string
  /** Search synonyms — matched alongside the label. */
  keywords?: string[]
  run: () => void
  group?: 'command' | 'note'
}

interface CommandPaletteProps {
  onClose: () => void
  commands: PaletteCommand[]
  searchNotes?: (query: string) => Promise<Array<{ path: string; title: string }>>
  onOpenNote?: (path: string) => void
}

export function CommandPalette({ onClose, commands, searchNotes, onOpenNote }: CommandPaletteProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [noteSearch, setNoteSearch] = useState<{
    query: string
    hits: Array<{ path: string; title: string }>
  }>({ query: '', hits: [] })
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<number | null>(null)

  const normalizedQuery = query.trim()
  const isSearchingNotes = searchingQuery === normalizedQuery

  const noteCommands = useMemo<PaletteCommand[]>(
    () =>
      (noteSearch.query === normalizedQuery ? noteSearch.hits : []).map((hit) => ({
        id: `note:${hit.path}`,
        label: hit.title,
        group: 'note' as const,
        run: () => {
          onOpenNote?.(hit.path)
        },
      })),
    [normalizedQuery, noteSearch, onOpenNote],
  )

  const mergedCommands = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filteredCommands = needle
      ? commands.filter(
          (command) =>
            command.label.toLowerCase().includes(needle) ||
            (command.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(needle)),
        )
      : commands
    if (!searchNotes || needle.length < 2) {
      return filteredCommands.map((command) => ({ ...command, group: 'command' as const }))
    }
    return [
      ...filteredCommands.map((command) => ({ ...command, group: 'command' as const })),
      ...noteCommands,
    ]
  }, [commands, noteCommands, query, searchNotes])

  useEffect(() => {
    if (!searchNotes || normalizedQuery.length < 2) return
    const requestQuery = normalizedQuery
    searchTimer.current = window.setTimeout(() => {
      setSearchingQuery(requestQuery)
      void searchNotes(requestQuery)
        .then((hits) => setNoteSearch({ query: requestQuery, hits: hits.slice(0, 12) }))
        .catch(() => setNoteSearch({ query: requestQuery, hits: [] }))
        .finally(() => {
          setSearchingQuery((current) => (current === requestQuery ? null : current))
        })
    }, 200)
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
    }
  }, [normalizedQuery, searchNotes])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, mergedCommands.length])

  useEscapeToClose(true, onClose)
  useFocusTrap(containerRef, { active: true })

  const runSelected = (command: PaletteCommand) => {
    command.run()
    onClose()
  }


  return (
    <div
      className="command-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('commandPalette.ariaLabel')}
    >
      <div className="command-palette" ref={containerRef}>
        <div className="command-palette-header">
          <Search className="command-palette-search-icon" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((current) => Math.min(current + 1, Math.max(mergedCommands.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter' && mergedCommands[selectedIndex]) {
                event.preventDefault()
                runSelected(mergedCommands[selectedIndex])
              }
            }}
            placeholder={t('commandPalette.placeholder')}
            aria-label={t('commandPalette.ariaLabel')}
            aria-controls="command-palette-list"
            aria-activedescendant={
              mergedCommands[selectedIndex] ? `command-palette-item-${mergedCommands[selectedIndex].id}` : undefined
            }
            autoFocus
          />
        </div>
        {isSearchingNotes ? <p className="command-palette-hint">{t('commandPalette.searchingNotes')}</p> : null}
        <ul id="command-palette-list" ref={listRef} role="listbox">
          {mergedCommands.map((command, index) => (
            <li key={command.id} role="presentation">
              <button
                type="button"
                id={`command-palette-item-${command.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === selectedIndex ? 'true' : undefined}
                className={command.group === 'note' ? 'command-palette-note-hit' : undefined}
                onClick={() => runSelected(command)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {command.group === 'note' ? (
                  <>
                    <strong>{command.label}</strong>
                    <small>{command.id.replace(/^note:/, '')}</small>
                  </>
                ) : (
                  command.label
                )}
              </button>
            </li>
          ))}
        </ul>
        {mergedCommands.length === 0 ? <p className="command-palette-hint">{t('commandPalette.noResults')}</p> : null}
      </div>
    </div>
  )
}
