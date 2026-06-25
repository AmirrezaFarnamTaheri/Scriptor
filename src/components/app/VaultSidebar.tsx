import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Folder,
  Inbox,
  LayoutTemplate,
  Plus,
  Search,
  Settings,
  Tags,
} from 'lucide-react'

import { InboxPanel } from '../inbox/InboxPanel'
import { VirtualNoteList } from './VirtualNoteList'
import { IconButton, PanelHeader } from '../chrome/WorkspaceChrome'
import type { NoteIndexSummary, VaultDescriptor, VaultSection } from '../../types/vault'
import type { NoteTypeDefinition } from '../../lib/knowledge/noteTypes'
import type { TemplateDefinition } from '../../lib/knowledge/templates'

interface VaultSidebarProps {
  vault: VaultDescriptor | null
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
  onCreateNoteFromTemplate: (templatePath: string) => void
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
  recentNotes?: Array<{ path: string; title: string }>
}

export function VaultSidebar({
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
  onCreateNoteFromTemplate,
  onRebuildIndex,
  onOpenTags,
  onOpenFilters,
  onOpenSavedViews,
  onOpenSnippets,
  onOpenSettings,
  onCreateDailyNote,
  onCreateDailyNoteOffset,
  dailyNoteLabel,
  onOrganizeNote,
  onSearchQueryChange,
  onOpenNote,
  onRenameNote,
  onDeleteNote,
  recentNotes = [],
}: VaultSidebarProps) {
  return (
    <aside className="vault-panel" aria-label="Vault">
      <PanelHeader
        title="Vault"
        icon={<Folder />}
        menuItems={[
          { label: 'Open vault folder', run: onChooseVault },
          { label: 'New note', run: onCreateNote },
          { label: 'Rebuild index', run: onRebuildIndex },
          { label: 'Browse tags', run: onOpenTags },
          { label: 'Knowledge filters', run: onOpenFilters },
          ...(onOpenSavedViews ? [{ label: 'Saved views', run: onOpenSavedViews }] : []),
          ...(onOpenSnippets ? [{ label: 'Manage snippets', run: onOpenSnippets }] : []),
        ]}
      />

      <div className="vault-nav-tabs">
        <button
          type="button"
          className={sidebarView === 'vault' ? 'toolbar-button active' : 'toolbar-button'}
          onClick={() => onSidebarViewChange('vault')}
        >
          <Folder size={14} />
          All notes
        </button>
        <button
          type="button"
          className={sidebarView === 'inbox' ? 'toolbar-button active' : 'toolbar-button'}
          onClick={() => onSidebarViewChange('inbox')}
        >
          <Inbox size={14} />
          Inbox
          {inboxNotes.length > 0 ? <span className="inbox-badge">{inboxNotes.length}</span> : null}
        </button>
      </div>

      {recentNotes.length > 0 && sidebarView === 'vault' ? (
        <section className="vault-recent-notes" aria-label="Recent notes">
          <h3>Recent</h3>
          <ul>
            {recentNotes.slice(0, 8).map((note) => (
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
          placeholder="Search notes"
          aria-label="Search notes"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <span className="shortcut">{isSearching ? '...' : 'F'}</span>
      </label>

      {searchQuery.trim() ? (
        <p className="search-hint" role="status">
          {isSearching
            ? 'Searching index...'
            : `${searchResultsCount} result${searchResultsCount === 1 ? '' : 's'}`}
        </p>
      ) : null}

      <button type="button" className="filter-button" onClick={onOpenFilters}>
        <Filter />
        Knowledge filters
      </button>

      {noteTypes.length > 0 ? (
        <div className="note-type-menu">
          <span className="note-type-label">New by type</span>
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

      {templatePaths.length > 0 ? (
        <div className="template-picker" aria-label="Create note from template">
          <span className="note-type-label">
            <LayoutTemplate size={12} aria-hidden />
            New from template
          </span>
          <ul className="template-picker-list">
            {templatePaths.map((template) => (
              <li key={template.path}>
                <button
                  type="button"
                  className="template-picker-item"
                  title={template.path}
                  onClick={() => onCreateNoteFromTemplate(template.path)}
                >
                  <FileText size={14} aria-hidden />
                  <span>{template.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="daily-note-nav">
        <button type="button" className="toolbar-button" onClick={() => onCreateDailyNoteOffset(-1)} title="Previous day">
          <ChevronLeft size={14} />
        </button>
        <button type="button" className="toolbar-button daily-note-button" onClick={onCreateDailyNote}>
          <CalendarDays size={14} />
          {dailyNoteLabel ? `Today · ${dailyNoteLabel}` : 'Today'}
        </button>
        <button type="button" className="toolbar-button" onClick={() => onCreateDailyNoteOffset(1)} title="Next day">
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
        ) : sections.length === 0 ? (
          <p className="empty-state">Open a vault to browse notes.</p>
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
                  />
                ) : null}
              </section>
            )
          })
        )}
      </div>

      <footer className="vault-sidebar-footer">
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings />
        </IconButton>
        <IconButton label="Tags" onClick={onOpenTags}>
          <Tags />
        </IconButton>
        <IconButton label="Archive views" onClick={onOpenSavedViews ?? onOpenFilters}>
          <Archive />
        </IconButton>
        <IconButton label="New note" onClick={onCreateNote}>
          <Plus />
        </IconButton>
      </footer>
    </aside>
  )
}
