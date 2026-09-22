import {
  Children,
  cloneElement,
  isValidElement,
  memo,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Settings2, SlidersHorizontal } from 'lucide-react'
import { ToolbarPopover } from '../ToolbarPopover'
import { useI18n } from '../../lib/i18n'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

export interface ToolbarTool {
  id: string
  label: string
  node: ReactNode
}

type Tool = ToolbarTool
interface Preference {
  id: string
  pinned: boolean
  width: number
  hasCustomWidth?: boolean
}
interface StoredToolbarV2 {
  version: 2
  tools: Array<{ id: string; pinned: boolean; width?: number }>
}

const STORAGE_KEY = 'scriptor:editor-toolbar'
const STORAGE_VERSION = 2
const DEFAULT_WIDTH = 32
const MIN_WIDTH = 32
const MAX_WIDTH = 240

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function normalizeStoredItems(value: unknown): Preference[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'version' in value && value.version === STORAGE_VERSION && 'tools' in value && Array.isArray(value.tools)
      ? value.tools
      : []
  const legacy = Array.isArray(value)
  const seen = new Set<string>()
  return raw.slice(0, 200).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || seen.has(item.id)) return []
    seen.add(item.id)
    const hasStoredWidth = 'width' in item && typeof item.width === 'number' && Number.isFinite(item.width)
    const candidate = hasStoredWidth ? clampWidth(item.width as number) : DEFAULT_WIDTH
    // Legacy records always serialized width=32, even when users never customized
    // a tool. For version-2 records the presence of width is itself intentional,
    // including an explicit minimum width of 32px.
    const hasCustomWidth = hasStoredWidth && (!legacy || candidate !== DEFAULT_WIDTH)
    return [{
      id: item.id,
      pinned: !('pinned' in item) || item.pinned !== false,
      width: candidate,
      hasCustomWidth,
    }]
  })
}

function readPreferences(): Preference[] {
  try {
    return normalizeStoredItems(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function serializePreferences(preferences: Preference[]): StoredToolbarV2 {
  return {
    version: STORAGE_VERSION,
    tools: preferences.map(({ id, pinned, width, hasCustomWidth }) => ({
      id,
      pinned,
      ...(hasCustomWidth ? { width: clampWidth(width) } : {}),
    })),
  }
}

interface PinnedToolItemProps {
  id: string
  width: number
  node: ReactNode
  hasCustomWidth?: boolean
}

const PinnedToolItem = memo(function PinnedToolItem({ id, width, node, hasCustomWidth }: PinnedToolItemProps) {
  const style: CSSProperties | undefined = hasCustomWidth
    ? { minWidth: clampWidth(width), width: clampWidth(width) }
    : undefined
  return (
    <div className="toolbar-tool" data-tool-id={id} style={style}>
      {node}
    </div>
  )
})

const DEFAULT_PINNED_IDS = new Set(['bold', 'italic', 'link', 'typography', 'insert'])

function isDefaultPinned(id: string): boolean {
  return DEFAULT_PINNED_IDS.has(id)
}

function toolGroup(id: string): 'formatting' | 'insert' | 'review' | 'view' | 'advanced' {
  if (id === 'insert' || id.startsWith('extra:insert:')) return 'insert'
  if (id === 'typography' || id.startsWith('extra:typography:') || id.startsWith('heading-') || id.startsWith('table') || ['bold', 'italic', 'link', 'outline', 'frontmatter', 'move-section-up', 'move-section-down', 'horizontal-rule'].includes(id)) return 'formatting'
  if (['organize-note', 'writing-targets', 'cheatsheet', 'rename-note', 'ai-summary'].includes(id)) return 'review'
  if (['stickies', 'typewriter', 'focus', 'split-preview'].includes(id)) return 'view'
  return 'advanced'
}

const GROUP_ORDER = ['formatting', 'insert', 'review', 'view', 'advanced'] as const

export interface CustomizableToolbarProps {
  children: ReactNode
  extras?: Tool[]
}

/** Controls declare semantic React keys so layout and translations cannot move preferences. */
function CustomizableToolbarImpl({ children, extras = [] }: CustomizableToolbarProps) {
  const tools = useMemo(() => {
    const list: Tool[] = []
    Children.forEach(children, (group) => {
      if (!isValidElement<{ children?: ReactNode }>(group)) return
      Children.forEach(group.props.children, (node) => {
        if (!isValidElement<{ title?: string; 'aria-label'?: string; children?: ReactNode }>(node) || node.key == null) return
        const label = node.props['aria-label'] ?? node.props.title ?? (typeof node.props.children === 'string' ? node.props.children : null)
          ?? (node.key === 'typography' ? 'Typography' : 'Insert')
        list.push({ id: String(node.key), label, node })
      })
    })
    list.push(...extras)
    return list
  }, [children, extras])

  const [preferences, setPreferences] = useState(readPreferences)
  const [draftPreferences, setDraftPreferences] = useState<Preference[] | null>(null)
  const { t } = useI18n()
  const [customizing, setCustomizing] = useState(false)
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<'insert' | 'typography' | null>(null)
  const [storageError, setStorageError] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const customizerRef = useRef<HTMLElement>(null)
  const menuId = useId()
  const triggerId = useId()
  const customizerId = useId()

  const mergePreferences = (source: Preference[]) => {
    const byId = new Map(tools.map((tool) => [tool.id, tool]))
    return [
      ...source.flatMap((pref) => { const tool = byId.get(pref.id); return tool ? [{ ...tool, ...pref }] : [] }),
      ...tools.filter((tool) => !source.some((pref) => pref.id === tool.id)).map((tool) => ({
        ...tool,
        pinned: isDefaultPinned(tool.id),
        width: DEFAULT_WIDTH,
        hasCustomWidth: false,
      })),
    ]
  }

  const ordered = mergePreferences(preferences)
  const draftOrdered = mergePreferences(draftPreferences ?? preferences)
  const pinnedTools = ordered.filter((tool) => tool.pinned)
  const menuTools = ordered.filter((tool) => submenu
    ? !tool.pinned && tool.id.startsWith(`extra:${submenu}:`)
    : !tool.pinned && !tool.id.startsWith('extra:'))

  const closeMenu = () => {
    setOpen(false)
    setSubmenu(null)
  }
  const showSubmenu = (name: 'insert' | 'typography' | null) => {
    setSubmenu(name)
    requestAnimationFrame(() => document.getElementById(menuId)?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
  }
  const persist = (next: Preference[]) => {
    setPreferences(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePreferences(next)))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }
  const activateMenuTool = (node: ReactNode, event: MouseEvent<HTMLButtonElement>) => {
    if (isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(node)) node.props.onClick?.(event)
    closeMenu()
    document.getElementById(triggerId)?.focus()
  }
  const openCustomizer = () => {
    closeMenu()
    setDraftPreferences(ordered.map(({ id, pinned, width, hasCustomWidth }) => ({ id, pinned, width, hasCustomWidth })))
    setCustomizing(true)
  }
  const closeCustomizer = () => {
    setCustomizing(false)
    setDraftPreferences(null)
  }
  const applyCustomizer = () => {
    const next = draftOrdered.map(({ id, pinned, width, hasCustomWidth }) => ({ id, pinned, width, hasCustomWidth }))
    persist(next)
    setCustomizing(false)
    setDraftPreferences(null)
  }
  const resetDraft = () => {
    setDraftPreferences(tools.map((tool) => ({
      id: tool.id,
      pinned: isDefaultPinned(tool.id),
      width: DEFAULT_WIDTH,
      hasCustomWidth: false,
    })))
  }
  const updateDraftTool = (id: string, change: Partial<Preference>) => {
    setDraftPreferences(draftOrdered.map((tool) => tool.id === id ? { ...tool, ...change } : tool))
  }
  const moveDraftTool = (index: number, direction: -1 | 1) => {
    const next = draftOrdered.map(({ id, pinned, width, hasCustomWidth }) => ({ id, pinned, width, hasCustomWidth }))
    const destination = index + direction
    if (destination < 0 || destination >= next.length) return
    ;[next[index], next[destination]] = [next[destination]!, next[index]!]
    setDraftPreferences(next)
  }

  useEscapeToClose(customizing, closeCustomizer)
  useFocusTrap(customizerRef, { active: customizing })

  const renderMenuTools = () => {
    if (submenu) {
      return menuTools.map((tool) => (
        <li role="none" key={tool.id} className="toolbar-unpinned">
          {isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(tool.node) && tool.node.type === 'button' ? cloneElement(tool.node, {
            role: 'menuitem',
            children: tool.label,
            onClick: (event) => activateMenuTool(tool.node, event),
          }) : null}
        </li>
      ))
    }
    return GROUP_ORDER.flatMap((group) => {
      const items = menuTools.filter((tool) => toolGroup(tool.id) === group)
      if (items.length === 0) return []
      return [
        <li role="presentation" className="toolbar-menu-section-label" key={`${group}:label`}>
          {t(`customizableToolbar.group.${group}`)}
        </li>,
        ...items.map((tool) => (
          <li role="none" key={tool.id} className="toolbar-unpinned">
            {tool.id === 'insert' || tool.id === 'typography' ? (
              <button type="button" role="menuitem" onClick={() => showSubmenu(tool.id as 'insert' | 'typography')}>
                {tool.label}
              </button>
            ) : isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(tool.node) && tool.node.type === 'button' ? (
              cloneElement(tool.node, {
                role: 'menuitem',
                children: tool.label,
                onClick: (event) => activateMenuTool(tool.node, event),
              })
            ) : null}
          </li>
        )),
      ]
    })
  }

  return (
    <>
      <div className="format-group editor-primary-formatting toolbar-pinned" aria-label={t('editor.toolbar.styleAndInsert')}>
        {pinnedTools.map((tool) => (
          <PinnedToolItem key={tool.id} id={tool.id} width={tool.width} node={tool.node} hasCustomWidth={tool.hasCustomWidth} />
        ))}
        <button
          type="button"
          ref={triggerRef}
          id={triggerId}
          className="toolbar-button tools-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label={t('customizableToolbar.tools')}
          title={t('customizableToolbar.tools')}
          onClick={() => { setOpen(!open); setSubmenu(null) }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown') return
            event.preventDefault()
            setOpen(true)
          }}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="toolbar-menu-trigger-label">{t('customizableToolbar.tools')}</span>
        </button>
        <button
          type="button"
          className="toolbar-button customize-trigger"
          aria-label={t('customizableToolbar.customize')}
          title={t('customizableToolbar.customize')}
          aria-haspopup="dialog"
          aria-expanded={customizing}
          aria-controls={customizing ? customizerId : undefined}
          onClick={() => customizing ? closeCustomizer() : openCustomizer()}
        >
          <Settings2 size={16} aria-hidden="true" />
        </button>
      </div>
      <ToolbarPopover
        className="toolbar-tools-menu"
        open={open}
        id={menuId}
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={closeMenu}
      >
        <li role="none">
          <button type="button" role="menuitem" onClick={openCustomizer}>{t('customizableToolbar.customize')}</button>
        </li>
        {submenu && (
          <li role="none">
            <button type="button" role="menuitem" onClick={() => showSubmenu(null)}>{t('customizableToolbar.backToTools')}</button>
          </li>
        )}
        {renderMenuTools()}
      </ToolbarPopover>
      {customizing && typeof document !== 'undefined' && createPortal(
        <div className="toolbar-customizer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closeCustomizer()
        }}>
          <section
            id={customizerId}
            ref={customizerRef}
            className="toolbar-customizer"
            data-help-topic="toolbar-customize"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${customizerId}-title`}
          >
            <header className="toolbar-customizer-header">
              <div>
                <h2 id={`${customizerId}-title`}>{t('customizableToolbar.customize')}</h2>
                <p>{t('customizableToolbar.helperText')}</p>
              </div>
              <button type="button" className="toolbar-customizer-close" onClick={closeCustomizer} aria-label={t('customizableToolbar.cancel')}>×</button>
            </header>
            {storageError && <p className="toolbar-customizer-warning" role="status">{t('customizableToolbar.storageWarning')}</p>}
            <div className="toolbar-customizer-list">
              {draftOrdered.map((tool, index) => (
                <div className="toolbar-customize-row" key={tool.id}>
                  <label className="toolbar-customize-pin">
                    <input
                      type="checkbox"
                      checked={tool.pinned}
                      onChange={(event) => updateDraftTool(tool.id, { pinned: event.target.checked })}
                    />
                    <span>{tool.label}</span>
                  </label>
                  <div className="toolbar-customize-order" aria-label={t('customizableToolbar.order', { label: tool.label })}>
                    <button type="button" aria-label={t('customizableToolbar.moveEarlier', { label: tool.label })} disabled={index === 0} onClick={() => moveDraftTool(index, -1)}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={t('customizableToolbar.moveLater', { label: tool.label })} disabled={index === draftOrdered.length - 1} onClick={() => moveDraftTool(index, 1)}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <label className="toolbar-customize-width">
                    <span>{t('customizableToolbar.widthLabel')}</span>
                    <input
                      type="number"
                      min={MIN_WIDTH}
                      max={MAX_WIDTH}
                      step={4}
                      aria-label={t('customizableToolbar.width', { label: tool.label })}
                      value={tool.hasCustomWidth ? tool.width : ''}
                      placeholder={t('customizableToolbar.auto')}
                      onChange={(event) => {
                        if (event.target.value === '') {
                          updateDraftTool(tool.id, { width: DEFAULT_WIDTH, hasCustomWidth: false })
                          return
                        }
                        const width = event.target.valueAsNumber
                        if (Number.isFinite(width)) updateDraftTool(tool.id, { width: clampWidth(width), hasCustomWidth: true })
                      }}
                    />
                    {tool.hasCustomWidth && (
                      <button type="button" onClick={() => updateDraftTool(tool.id, { width: DEFAULT_WIDTH, hasCustomWidth: false })}>
                        {t('customizableToolbar.auto')}
                      </button>
                    )}
                  </label>
                </div>
              ))}
            </div>
            <footer className="toolbar-customizer-actions">
              <button type="button" onClick={resetDraft}>{t('customizableToolbar.reset')}</button>
              <span className="toolbar-customizer-action-spacer" />
              <button type="button" onClick={closeCustomizer}>{t('customizableToolbar.cancel')}</button>
              <button type="button" className="primary" onClick={applyCustomizer}>{t('customizableToolbar.apply')}</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}

export const CustomizableToolbar = memo(CustomizableToolbarImpl)
