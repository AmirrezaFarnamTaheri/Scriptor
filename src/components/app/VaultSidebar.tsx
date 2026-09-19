import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Folder,
  Inbox,
  LayoutTemplate,
  Plus,
  Search,
  Tags,
} from 'lucide-react'
import { useState, memo, useMemo } from 'react'

import { InboxPanel } from '../inbox/InboxPanel'
import { VaultTreeSkeleton } from './VaultTreeSkeleton'
import { VirtualNoteList } from './VirtualNoteList'
import { IconButton, PanelHeader } from '../chrome/WorkspaceChrome'
import type { NoteIndexSummary, VaultDescriptor, VaultSection } from '../../types/vault'
import type { NoteTypeDefinition } from '../../lib/knowledge/noteTypes'
import type { TemplateDefinition } from '../../lib/knowledge/templates'
import { useI18n } from '../../lib/i18n'

interface VaultSidebarProps {
  vault: VaultDescriptor | null
  vaultStatus?: 'idle' | 'opening' | 'indexing' | 'ready' | 'error'
  sections: VaultSection[]
  activePath: string | null
  searchQuery: string
  isSearching: boolean
  searchResultsCount: number
  collapsedFolders: Record<string, boolean>
  sidebarView: 'vault' | 'inbox'
  inboxNotes: NoteIndexSummary[]
  noteTypes: NoteTypeDefinition[]
  templatePaths: TemplateDefinition[]
  onSidebarViewChange: (view: 'vault' | 'inbox') => void
  onCollapsedFoldersChange: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void
  onChooseVault: () => void
  onCreateNote: () => void
  onCreateNoteOfType: (typeName: string) => void
  onOpenTemplatePicker?: () => void
  onOpenObsidianImport?: () => void
  onRebuildIndex: () => void
  onOpenTags: () => void
  onOpenFilters: () => void
  onOpenSavedViews?: () => void
  onOpenSnippets?: () => void
  onOpenSettings: () => void
  onCreateDailyNote: () => void
  onCreateDailyNoteOffset: (offset: number) => void
  dailyNoteLabel?: string
  onOrganizeNote: (path: string) => void
  onSearchQueryChange: (query: string) => void
  onOpenNote: (path: string) => void
  onRenameNote: (path: string) => void
  onDeleteNote?: (path: string) => void
  onImportFiles?: (files: FileList) => Promise<string[]>
  recentNotes?: Array<{ path: string; title: string }>
  readerDocumentPaths?: Set<string>
}

function VaultSidebarImpl({
  vault,
  vaultStatus = 'idle',
  sections,
  activePath,
  searchQuery,
  isSearching,
  searchResultsCount,
  collapsedFolders,
  sidebarView,
  inboxNotes,
  noteTypes,
  templatePaths,
  onSidebarViewChange,
  onCollapsedFoldersChange,
  onChooseVault,
  onCreateNote,
  onCreateNoteOfType,
  onOpenTemplatePicker,
  onOpenObsidianImport,
  onRebuildIndex,
  onOpenTags,
  onOpenFilters,
  onOpenSavedViews,
  onOpenSnippets,
  onCreateDailyNote,
  onCreateDailyNoteOffset,
  dailyNoteLabel,
  onOrganizeNote,
  onSearchQueryChange,
  onOpenNote,
  onRenameNote,
  onDeleteNote,
  onImportFiles,
  recentNotes = [],
  readerDocumentPaths,
}: VaultSidebarProps) {
  const { t } = useI18n()
  const [dropActive, setDropActive] = useState(false)
  const visibleRecentNotes = useMemo(
    () => recentNotes.filter((note) => note.path !== activePath).slice(0, 4),
    [recentNotes, activePath],
  )

  const menuItems = useMemo(
    () => [
      { label: t('vaultSidebar.openVaultFolder'), run: onChooseVault, group: t('vaultSidebar.menu.files') },
      { label: t('vaultSidebar.newNote'), run: onCreateNote, group: t('vaultSidebar.menu.files') },
      ...(onOpenObsidianImport ? [{ label: t('vaultSidebar.importObsidian'), run: onOpenObsidianImport, group: t('vaultSidebar.menu.files') }] : []),
      { label: t('vaultSidebar.browseTags'), run: onOpenTags, group: t('vaultSidebar.menu.knowledge') },
      { label: t('vaultSidebar.knowledgeFilters'), run: onOpenFilters, group: t('vaultSidebar.menu.knowledge') },
      ...(onOpenSavedViews ? [{ label: t('vaultSidebar.savedViews'), run: onOpenSavedViews, group: t('vaultSidebar.menu.knowledge') }] : []),
      ...(onOpenSnippets ? [{ label: t('vaultSidebar.manageSnippets'), run: onOpenSnippets, group: t('vaultSidebar.menu.knowledge') }] : []),
      { label: t('vaultSidebar.rebuildIndex'), run: onRebuildIndex, group: t('vaultSidebar.menu.maintenance') },
    ],
    [
      onChooseVault,
      onCreateNote,
      onRebuildIndex,
      onOpenTags,
      onOpenFilters,
      onOpenSavedViews,
      onOpenSnippets,
      onOpenObsidianImport,
      t,
    ],
  )

  return (
    <aside
      className={`vault-panel${dropActive ? ' is-drop-target' : ''}`}
      data-help-topic="vault"
      aria-label={t('vaultSidebar.ariaLabel')}
      onDragOver={(event) => {
        if (!onImportFiles) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        if (!onImportFiles || !event.dataTransfer.files.length) return
        event.preventDefault()
        setDropActive(false)
        void onImportFiles(event.dataTransfer.files)
      }}
    >
      <PanelHeader
        title={vault?.name ?? t('vaultSidebar.vault')}
        icon={<Folder />}
        menuItems={menuItems}
        menuLabel={t('vaultSidebar.options', { title: vault?.name ?? t('vaultSidebar.vault') })}
      />

      <div className="vault-nav-tabs">
        <button
          type="button"
          className={sidebarView === 'vault' ? 'toolbar-button active' : 'toolbar-button'}
          onClick={() => onSidebarViewChange('vault')}
        >
          <Folder size={14} />
          {t('vaultSidebar.allNotes')}
        </button>
        <button
          type="button"
          className={sidebarView === 'inbox' ? 'toolbar-button active' : 'toolbar-button'}
          onClick={() => onSidebarViewChange('inbox')}
        >
          <Inbox size={14} />
          {t('vaultSidebar.inbox')}
          {inboxNotes.length > 0 ? <span className="inbox-badge">{inboxNotes.length}</span> : null}
        </button>
      </div>

      {visibleRecentNotes.length > 0 && sidebarView === 'vault' ? (
        <section className="vault-recent-notes" aria-label={t('vaultSidebar.recentNotes')}>
          <h3>{t('vaultSidebar.recentNotes')}</h3>
          <ul>
            {visibleRecentNotes.map((note) => (
              <li key={note.path}>
                <button type="button" onClick={() => onOpenNote(note.path)}>
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <label className="note-search vault-search">
        <Search />
        <input
          type="search"
          placeholder={t('vaultSidebar.searchNotes')}
          aria-label={t('vaultSidebar.searchNotes')}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <kbd className="shortcut" aria-label={t('vaultSidebar.shortcutF')} title={t('vaultSidebar.focusSearchHint')}>
          {isSearching ? '…' : 'F'}
        </kbd>
      </label>

      {searchQuery.trim() ? (
        <p className="search-hint" role="status">
          {isSearching
            ? t('vaultSidebar.searchingIndex')
            : t('vaultSidebar.searchResults', { count: searchResultsCount })}
        </p>
      ) : null}

      <button type="button" className="filter-button" onClick={onOpenFilters}>
        <Filter />
        {t('vaultSidebar.knowledgeFilters')}
      </button>

      {noteTypes.length > 0 ? (
        <div className="note-type-menu">
          <span className="note-type-label">{t('vaultSidebar.newByType')}</span>
          <div className="note-type-buttons">
            {noteTypes.map((type) => (
              <button
                key={type.path}
                type="button"
                className="toolbar-button"
                onClick={() => onCreateNoteOfType(type.name)}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onOpenTemplatePicker ? (
        <button type="button" className="filter-button" onClick={onOpenTemplatePicker}>
          <LayoutTemplate aria-hidden />
          {templatePaths.length > 0
            ? t('vaultSidebar.newFromTemplateCount', { count: templatePaths.length })
            : t('vaultSidebar.newFromTemplate')}
        </button>
      ) : null}

      <div className="daily-note-nav">
        <button type="button" className="toolbar-button" onClick={() => onCreateDailyNoteOffset(-1)} title={t('vaultSidebar.previousDay')}>
          <ChevronLeft size={14} />
        </button>
        <button type="button" className="toolbar-button daily-note-button" onClick={onCreateDailyNote}>
          <CalendarDays size={14} />
          {dailyNoteLabel ? t('vaultSidebar.todayWithLabel', { label: dailyNoteLabel }) : t('vaultSidebar.today')}
        </button>
        <button type="button" className="toolbar-button" onClick={() => onCreateDailyNoteOffset(1)} title={t('vaultSidebar.nextDay')}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="vault-tree">
        {sidebarView === 'inbox' ? (
          <InboxPanel
            notes={inboxNotes}
            activePath={activePath}
            onOpenNote={onOpenNote}
            onOrganize={onOrganizeNote}
          />
        ) : vaultStatus === 'opening' || (vaultStatus === 'indexing' && sections.length === 0) ? (
          <VaultTreeSkeleton />
        ) : sections.length === 0 ? (
          <p className="empty-state">{t('vaultSidebar.openVaultToBrowse')}</p>
        ) : (
          sections.map((section) => {
            const collapsed = collapsedFolders[section.name] ?? false
            return (
              <section className="folder-node" key={section.name}>
                <button
                  type="button"
                  className="folder-row"
                  onClick={() =>
                    onCollapsedFoldersChange((current) => ({
                      ...current,
                      [section.name]: !collapsed,
                    }))
                  }
                >
                  {collapsed ? <ChevronRight /> : <ChevronDown />}
                  <Folder />
                  <span>{section.name}</span>
                  <small>{section.count}</small>
                </button>
                {!collapsed ? (
                  <VirtualNoteList
                    paths={section.notes}
                    activePath={activePath}
                    onOpenNote={onOpenNote}
                    onRenameNote={onRenameNote}
                    onDeleteNote={onDeleteNote}
                    readerDocumentPaths={readerDocumentPaths}
                  />
                ) : null}
              </section>
            )
          })
        )}
      </div>

      <footer className="vault-sidebar-footer" aria-label={t('vaultSidebar.utilities')}>
        <IconButton label={t('vaultSidebar.tags')} onClick={onOpenTags}>
          <Tags />
        </IconButton>
        <IconButton label={t('vaultSidebar.archiveViews')} onClick={onOpenSavedViews ?? onOpenFilters}>
          <Archive />
        </IconButton>
        <IconButton label={t('vaultSidebar.newNote')} onClick={onCreateNote}>
          <Plus />
        </IconButton>
      </footer>
    </aside>
  )
}

/**
 * Memoized: this subtree re-renders on every App-level render (including every
 * keystroke in the editor draft) even though its own props rarely change.
 */
export const VaultSidebar = memo(VaultSidebarImpl)