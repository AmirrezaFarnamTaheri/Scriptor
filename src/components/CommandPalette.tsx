import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../lib/i18n'
import { scoreCommand } from '../lib/paletteScore'
import { requestHelp } from '../lib/help/request'
import { helpLabels } from '../lib/help/labels'

export interface PaletteCommand {
  id: string
  label: string
  /** Search synonyms — matched alongside the label. */
  keywords?: string[]
  shortcut?: string
  category?: string
  tone?: 'default' | 'maintenance' | 'danger'
  run: () => void
  group?: 'command' | 'note'
}

interface CommandPaletteProps {
  onClose: () => void
  commands: PaletteCommand[]
  searchNotes?: (query: string) => Promise<Array<{ path: string; title: string }>>
  onOpenNote?: (path: string) => void
}

export const CommandPalette = memo(function CommandPalette({ onClose, commands, searchNotes, onOpenNote }: CommandPaletteProps) {
  const { t, locale } = useI18n()
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
  const searchGeneration = useRef(0)
  const isKeyboardNav = useRef(false)

  const normalizedQuery = query.trim()
  const isSearchingNotes = searchingQuery === normalizedQuery
  const helpCommand = useMemo<PaletteCommand>(() => ({
    id: 'open-help-guides', label: helpLabels(locale).title,
    keywords: ['help', 'guide', 'tour', 'tutorial', 'faq', 'questions', 'answers', 'hilfe', 'راهنما', 'آموزش'],
    category: 'Help', shortcut: 'F1',
    run: () => { window.requestAnimationFrame(() => requestHelp('workspace')) },
  }), [locale])

  const noteCommands = useMemo<PaletteCommand[]>(
    () =>
      (noteSearch.query === normalizedQuery ? noteSearch.hits : []).map((hit) => ({
        id: `note:${hit.path}`,
        label: hit.title,
        category: t('commandPalette.noteCategory'),
        group: 'note' as const,
        tone: 'default' as const,
        run: () => { onOpenNote?.(hit.path) },
      })),
    [deferredQuery, noteSearch, onOpenNote, t],
  )

  const mergedCommands = useMemo(() => {
    const scored = [...commands, helpCommand]
      .map((cmd) => ({ cmd, score: scoreCommand(normalizedQuery, cmd) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => ({ ...cmd, group: 'command' as const }))
    if (!searchNotes || deferredQuery.length < 2) return scored
    return [...scored, ...noteCommands]
  }, [commands, helpCommand, noteCommands, normalizedQuery, searchNotes])

  useEffect(() => {
    if (!searchNotes || normalizedQuery.length < 2) return
    const requestQuery = normalizedQuery
    const generation = searchGeneration.current + 1
    searchGeneration.current = generation
    searchTimer.current = window.setTimeout(() => {
      setSearchingQuery(requestQuery)
      void searchNotes(requestQuery)
        .then((hits) => {
          if (searchGeneration.current !== generation) return
          setNoteSearch({ query: requestQuery, hits: hits.slice(0, 12) })
        })
        .catch(() => {
          if (searchGeneration.current !== generation) return
          setNoteSearch({ query: requestQuery, hits: [] })
        })
        .finally(() => {
          if (searchGeneration.current !== generation) return
          setSearchingQuery(null)
        })
    }, 200)
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
        searchTimer.current = null
      }
      if (searchGeneration.current === generation) searchGeneration.current += 1
    }
  }, [normalizedQuery, searchNotes])

  useEffect(() => {
    if (!isKeyboardNav.current) return
    const active = listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, mergedCommands.length])

  useEscapeToClose(true, onClose)
  useFocusTrap(containerRef, { active: true })

  const runSelected = (command: PaletteCommand) => { command.run(); onClose() }
  const hasNoteResults = mergedCommands.some((command) => command.group === 'note')

  return (
    <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label={t('commandPalette.ariaLabel')}>
      <div className="command-palette" ref={containerRef} data-help-topic="commands">
        <div className="command-palette-header">
          <Search className="command-palette-search-icon" aria-hidden="true" />
          <input
            type="search" value={query}
            onChange={(event) => { isKeyboardNav.current = false; setQuery(event.target.value); setSelectedIndex(0) }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                isKeyboardNav.current = true
                setSelectedIndex((current) => Math.min(current + 1, Math.max(mergedCommands.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                isKeyboardNav.current = true
                setSelectedIndex((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter' && mergedCommands[selectedIndex]) {
                event.preventDefault()
                runSelected(mergedCommands[selectedIndex])
              }
            }}
            placeholder={t('commandPalette.placeholder')} aria-label={t('commandPalette.ariaLabel')}
            aria-controls="command-palette-list"
            aria-activedescendant={mergedCommands[selectedIndex] ? `command-palette-item-${mergedCommands[selectedIndex].id}` : undefined}
            autoFocus
          />
        </div>
        <p className="command-palette-scope-hint">
          <span>{t('commandPalette.scopeHint')}</span>
          <span
            className="command-palette-search-status"
            aria-live="polite"
            aria-atomic="true"
            data-active={isSearchingNotes ? 'true' : 'false'}
          >
            {isSearchingNotes ? t('commandPalette.searchingNotes') : '\u00A0'}
          </span>
        </p>
        <ul id="command-palette-list" ref={listRef} role="listbox">
          {mergedCommands.map((command, index) => {
            const previousGroup = mergedCommands[index - 1]?.group
            const showHeading = hasNoteResults && (index === 0 || previousGroup !== command.group)
            return (
              <Fragment key={command.id}>
                {showHeading ? <li role="presentation" className="command-palette-group-label">{command.group === 'note' ? t('commandPalette.notesHeading') : t('commandPalette.commandsHeading')}</li> : null}
                <li role="presentation">
                  <button
                    type="button" id={`command-palette-item-${command.id}`} role="option" aria-selected={index === selectedIndex}
                    data-active={index === selectedIndex ? 'true' : undefined} data-tone={command.tone ?? 'default'}
                    className={command.group === 'note' ? 'command-palette-note-hit' : undefined}
                    onClick={() => runSelected(command)}
                    onMouseEnter={() => { isKeyboardNav.current = false; setSelectedIndex(index) }}
                  >
                    <span className="command-palette-item-copy">
                      <strong>{command.label}</strong>
                      <small>{command.group === 'note' ? command.id.replace(/^note:/, '') : command.category ?? t('commandPalette.commandCategory')}</small>
                    </span>
                    {command.shortcut ? <kbd className="command-palette-shortcut">{command.shortcut}</kbd> : null}
                  </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
        {mergedCommands.length === 0 ? <p className="command-palette-hint">{t('commandPalette.noResults')}</p> : null}
      </div>
    </div>
  )
})
