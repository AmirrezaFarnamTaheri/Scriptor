import { Children, cloneElement, isValidElement, memo, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Settings2, SlidersHorizontal } from 'lucide-react'
import { ToolbarPopover } from '../ToolbarPopover'
import { useI18n } from '../../lib/i18n'

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
const STORAGE_KEY = 'scriptor:editor-toolbar'
const DEFAULT_WIDTH = 32
const MIN_WIDTH = 32
const MAX_WIDTH = 240

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function readPreferences(): Preference[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value.slice(0, 200).flatMap((item: unknown) => {
      if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || seen.has(item.id)) return []
      seen.add(item.id)
      const hasCustomWidth = 'width' in item && typeof item.width === 'number' && Number.isFinite(item.width)
      return [{
        id: item.id,
        pinned: !('pinned' in item) || item.pinned !== false,
        width: hasCustomWidth ? clampWidth((item as { width: number }).width) : DEFAULT_WIDTH,
        hasCustomWidth,
      }]
    })
  } catch { return [] }
}

interface PinnedToolItemProps {
  id: string
  width: number
  node: ReactNode
  hasCustomWidth?: boolean
}

const PinnedToolItem = memo(function PinnedToolItem({ id, width, node, hasCustomWidth }: PinnedToolItemProps) {
  const style: CSSProperties = hasCustomWidth || width !== DEFAULT_WIDTH
    ? { minWidth: width, width }
    : { minWidth: width }
  return (
    <div
      className="toolbar-tool"
      data-tool-id={id}
      style={style}
    >
      {node}
    </div>
  )
})

const DEFAULT_PINNED_IDS = new Set([
  'bold',
  'italic',
  'link',
  'typography',
  'insert',
])

function isDefaultPinned(id: string): boolean {
  return DEFAULT_PINNED_IDS.has(id)
}

export interface CustomizableToolbarProps {
  children: ReactNode
  extras?: Tool[]
  hostRef?: RefObject<HTMLElement | null>
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
  const { t } = useI18n()
  const [customizing, setCustomizing] = useState(false)
  const [open, setOpen] = useState(false)
  const [submenu, setSubmenu] = useState<'insert' | 'typography' | null>(null)
  const [storageError, setStorageError] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const triggerId = useId()

  const ordered = useMemo(() => {
    const byId = new Map(tools.map((tool) => [tool.id, tool]))
    return [
      ...preferences.flatMap((pref) => { const tool = byId.get(pref.id); return tool ? [{ ...tool, ...pref }] : [] }),
      ...tools.filter((tool) => !preferences.some((pref) => pref.id === tool.id)).map((tool) => ({
        ...tool,
        pinned: isDefaultPinned(tool.id),
        width: DEFAULT_WIDTH,
        hasCustomWidth: false,
      })),
    ]
  }, [preferences, tools])

  const pinnedTools = useMemo(() => ordered.filter((tool) => tool.pinned), [ordered])
  const menuTools = useMemo(() => ordered.filter((tool) => submenu
    ? tool.id.startsWith(`extra:${submenu}:`)
    : !tool.pinned && !tool.id.startsWith('extra:')), [ordered, submenu])

  const closeMenu = () => {
    setOpen(false)
    setSubmenu(null)
  }
  const showSubmenu = (name: 'insert' | 'typography' | null) => {
    setSubmenu(name)
    requestAnimationFrame(() => document.getElementById(menuId)?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
  }
  const save = (next: typeof ordered) => {
    const prefs = next.map(({ id, pinned, width, hasCustomWidth }) => ({
      id,
      pinned,
      width,
      ...(hasCustomWidth ? { hasCustomWidth } : {}),
    }))
    setPreferences(prefs)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs.map(({ id, pinned, width }) => ({ id, pinned, width }))))
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
  const reset = () => {
    setPreferences([])
    try {
      localStorage.removeItem(STORAGE_KEY)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }
  const updateTool = (id: string, change: Partial<Preference>) => {
    save(ordered.map((tool) => tool.id === id ? { ...tool, ...change, ...(change.width !== undefined ? { hasCustomWidth: true } : {}) } : tool))
  }
  const moveTool = (index: number, direction: -1 | 1) => {
    const next = [...ordered]
    const destination = index + direction
    ;[next[index], next[destination]] = [next[destination]!, next[index]!]
    save(next)
  }

  return (
    <>
      <div
        className="format-group editor-primary-formatting toolbar-pinned"
        aria-label={t('editor.toolbar.styleAndInsert')}
      >
        {pinnedTools.map((tool) => (
          <PinnedToolItem
            key={tool.id}
            id={tool.id}
            width={tool.width}
            node={tool.node}
            hasCustomWidth={tool.hasCustomWidth}
          />
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
          aria-expanded={customizing}
          onClick={() => setCustomizing(!customizing)}
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
          <button type="button" role="menuitem" onClick={() => { closeMenu(); setCustomizing(true) }}>
            {t('customizableToolbar.customize')}
          </button>
        </li>
        {submenu && (
          <li role="none">
            <button type="button" role="menuitem" onClick={() => showSubmenu(null)}>{t('customizableToolbar.backToTools')}</button>
          </li>
        )}
        {menuTools.map((tool) => (
          <li role="none" key={tool.id} className="toolbar-unpinned">
            {tool.id === 'insert' || tool.id === 'typography' ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => showSubmenu(tool.id as 'insert' | 'typography')}
              >
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
        ))}
      </ToolbarPopover>
      {customizing && typeof document !== 'undefined' && createPortal(
        <section className="toolbar-customizer" aria-label={t('customizableToolbar.customize')}>
          <p>{t('customizableToolbar.helperText')}</p>
          {storageError && <p role="status">{t('customizableToolbar.storageWarning')}</p>}
          <button type="button" onClick={reset}>{t('customizableToolbar.reset')}</button>
          <button type="button" onClick={() => setCustomizing(false)}>{t('customizableToolbar.done')}</button>
          {ordered.map((tool, index) => (
            <div className="toolbar-customize-row" key={tool.id}>
              <label>
                <input
                  type="checkbox"
                  checked={tool.pinned}
                  onChange={(event) => updateTool(tool.id, { pinned: event.target.checked })}
                />
                {tool.label}
              </label>
              <button
                type="button"
                aria-label={t('customizableToolbar.moveEarlier', { label: tool.label })}
                disabled={index === 0}
                onClick={() => moveTool(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={t('customizableToolbar.moveLater', { label: tool.label })}
                disabled={index === ordered.length - 1}
                onClick={() => moveTool(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <input
                type="number"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={4}
                aria-label={t('customizableToolbar.width', { label: tool.label })}
                value={tool.width}
                onChange={(event) => {
                  const width = event.target.valueAsNumber
                  if (Number.isFinite(width)) updateTool(tool.id, { width: clampWidth(width) })
                }}
              />
            </div>
          ))}
        </section>,
        document.querySelector('.editor-toolbar-wrapper') ?? document.body,
      )}
    </>
  )
}

export const CustomizableToolbar = memo(CustomizableToolbarImpl)
