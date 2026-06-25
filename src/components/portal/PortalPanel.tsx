import { useMemo, useState } from 'react'
import { ClipboardCopy, Layers, Pin, Plus, Search, Trash2, Zap } from 'lucide-react'

import { formatShortcutLabel, type PortalAction, type PortalCategory, type PortalItem } from '@scriptor/portal'

import { writeClipboardText } from '../../lib/clipboardText'
import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'

interface PortalPanelProps {
  categories: PortalCategory[]
  itemsByCategory: Map<string, PortalItem[]>
  presentation?: PanelPresentation
  onClose: () => void
  onSaveItem: (item: PortalItem) => void
  onDeleteItem: (id: string) => void
  onInsert?: (body: string) => void
  onOpenNote?: (path: string) => void
}

const ACTIONS: PortalAction[] = ['copy', 'insert', 'open-note']

function matchesQuery(item: PortalItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    item.title.toLowerCase().includes(needle) ||
    item.body.toLowerCase().includes(needle) ||
    (item.shortcut?.toLowerCase().includes(needle) ?? false)
  )
}

export function PortalPanel({
  categories,
  itemsByCategory,
  presentation = 'dock-right',
  onClose,
  onSaveItem,
  onDeleteItem,
  onInsert,
  onOpenNote,
}: PortalPanelProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? 'custom')
  const [searchQuery, setSearchQuery] = useState('')
  const [draft, setDraft] = useState<Partial<PortalItem>>({
    categoryId: activeCategory,
    action: 'copy',
    shortcut: '',
  })

  const allItems = useMemo(() => {
    const items: PortalItem[] = []
    for (const category of categories) {
      items.push(...(itemsByCategory.get(category.id) ?? []))
    }
    return items
  }, [categories, itemsByCategory])

  const pinnedItems = useMemo(
    () => allItems.filter((item) => item.pinned && matchesQuery(item, searchQuery)),
    [allItems, searchQuery],
  )

  const visibleItems = useMemo(() => {
    const categoryItems = itemsByCategory.get(activeCategory) ?? []
    return categoryItems.filter((item) => matchesQuery(item, searchQuery))
  }, [activeCategory, itemsByCategory, searchQuery])

  const invokeItem = async (item: PortalItem) => {
    if (item.action === 'copy') await writeClipboardText(item.body)
    if (item.action === 'insert') onInsert?.(item.body)
    if (item.action === 'open-note') onOpenNote?.(item.body.trim())
  }

  const invokePinned = async () => {
    for (const item of pinnedItems) {
      await invokeItem(item)
    }
  }

  const saveDraft = () => {
    if (!draft.title?.trim() || !draft.body?.trim()) return
    const now = new Date().toISOString()
    onSaveItem({
      id: draft.id ?? crypto.randomUUID(),
      categoryId: draft.categoryId ?? activeCategory,
      title: draft.title.trim(),
      body: draft.body,
      action: draft.action ?? 'copy',
      shortcut: draft.shortcut?.trim() || null,
      pinned: draft.pinned ?? false,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    })
    setDraft({ categoryId: activeCategory, action: 'copy', shortcut: '' })
  }

  return (
    <UnifiedPanelShell
      title="Portal"
      subtitle="Categorized clipboard — copy, insert, or open with optional shortcuts"
      icon={<Layers size={18} />}
      ariaLabel="Portal"
      onClose={onClose}
      presentation={presentation}
      className="portal-panel knowledge-filters-panel"
      wide
      tabs={categories.map((category) => ({ id: category.id, label: category.label }))}
      activeTab={activeCategory}
      onTabChange={setActiveCategory}
    >
      <div className="portal-body knowledge-filter-body">
        <div className="portal-toolbar">
          <label className="portal-search">
            <Search size={14} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter portal items…"
              aria-label="Filter portal items"
            />
          </label>
          {pinnedItems.length > 0 ? (
            <button type="button" className="toolbar-button" onClick={() => void invokePinned()}>
              <Zap size={14} />
              Invoke pinned ({pinnedItems.length})
            </button>
          ) : null}
        </div>

        {pinnedItems.length > 0 ? (
          <section className="portal-pinned-section" aria-label="Pinned portal items">
            <h3>
              <Pin size={14} />
              Pinned
            </h3>
            <ul className="portal-item-list portal-pinned-list">
              {pinnedItems.map((item) => (
                <li key={`pinned-${item.id}`} className="portal-item-row is-pinned">
                  <div>
                    <strong>{item.title}</strong>
                    {item.shortcut ? <small>{formatShortcutLabel(item.shortcut)}</small> : null}
                  </div>
                  <button type="button" onClick={() => void invokeItem(item)} title="Invoke pinned item">
                    <ClipboardCopy size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ul className="portal-item-list">
          {visibleItems.length === 0 ? (
            <li className="empty-state">
              {searchQuery.trim() ? 'No items match your filter.' : 'No items in this category yet.'}
            </li>
          ) : (
            visibleItems.map((item) => (
              <li key={item.id} className={`portal-item-row${item.pinned ? ' is-pinned' : ''}`}>
                <div>
                  <strong>
                    {item.pinned ? <Pin size={12} /> : null}
                    {item.title}
                  </strong>
                  {item.shortcut ? <small>{formatShortcutLabel(item.shortcut)}</small> : null}
                  <p>
                    {item.body.slice(0, 120)}
                    {item.body.length > 120 ? '…' : ''}
                  </p>
                </div>
                <div className="portal-item-actions">
                  <button type="button" onClick={() => void invokeItem(item)} title="Invoke">
                    <ClipboardCopy size={14} />
                  </button>
                  <button type="button" onClick={() => setDraft(item)} title="Edit">
                    Edit
                  </button>
                  <button type="button" onClick={() => onDeleteItem(item.id)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <form
          className="portal-form saved-views-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveDraft()
          }}
        >
          <h3>{draft.id ? 'Edit item' : 'New item'}</h3>
          <label>
            Title
            <input value={draft.title ?? ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label>
            Body
            <textarea rows={4} value={draft.body ?? ''} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          </label>
          <label>
            Action
            <select
              value={draft.action ?? 'copy'}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value as PortalAction }))}
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shortcut (e.g. mod+shift+1)
            <input
              value={draft.shortcut ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, shortcut: e.target.value }))}
              placeholder="mod+shift+1"
            />
          </label>
          <label className="diagnostics-opt-in">
            <input
              type="checkbox"
              checked={draft.pinned ?? false}
              onChange={(event) => setDraft((d) => ({ ...d, pinned: event.target.checked }))}
            />
            <span>Pin for quick invoke bar and shortcut palette</span>
          </label>
          <button type="submit" className="primary-button">
            <Plus size={14} />
            {draft.id ? 'Update item' : 'Add item'}
          </button>
        </form>
      </div>
    </UnifiedPanelShell>
  )
}
