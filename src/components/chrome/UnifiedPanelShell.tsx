import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { X } from 'lucide-react'

import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { FOCUSABLE_SELECTORS, useFocusTrap } from '../../hooks/useFocusTrap'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'
import { IconButton } from './WorkspaceChrome'
import { useI18n } from '../../lib/i18n'

export interface PanelTab {
  id: string
  label: string
}

interface UnifiedPanelShellProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  ariaLabel: string
  modalAriaLabel?: string
  onClose: () => void
  tabs?: PanelTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  headerActions?: ReactNode
  headerMeta?: ReactNode
  showClose?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  initialFocusKey?: unknown
  children: ReactNode
  className?: string
  wide?: boolean
  presentation?: PanelPresentation
  footer?: ReactNode
}

const DOCK_MEDIA_QUERY = '(min-width: 1321px)'

/** Returns whether the current viewport and reflow mode can safely host a right dock. */
function dockFitsViewport(media: MediaQueryList): boolean {
  if (!media.matches) return false
  const reflow = document.documentElement.dataset.uiReflow
  return reflow === undefined || reflow === 'desktop'
}

/** Tracks whether the shared panel shell may render as a dock instead of a modal. */
function useDockViewport(enabled: boolean): boolean {
  const [canDock, setCanDock] = useState(() => {
    if (!enabled || typeof window === 'undefined') return false
    return dockFitsViewport(window.matchMedia(DOCK_MEDIA_QUERY))
  })

  useEffect(() => {
    if (!enabled) return
    const media = window.matchMedia(DOCK_MEDIA_QUERY)
    const update = () => setCanDock(dockFitsViewport(media))
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-ui-reflow'],
    })
    update()
    media.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [enabled])

  return enabled ? canDock : false
}

/** Provides shared modal/dock semantics, focus policy, tabs, and accessible labeling. */
function UnifiedPanelShellImpl({
  title,
  subtitle,
  icon,
  ariaLabel,
  modalAriaLabel,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  headerMeta,
  showClose = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  initialFocusKey,
  children,
  className = 'knowledge-filters-panel',
  wide = false,
  presentation = 'modal',
  footer,
}: UnifiedPanelShellProps) {
  const { t } = useI18n()
  const shellRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const canDock = useDockViewport(presentation === 'dock-right')
  const docked = presentation === 'dock-right' && canDock

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [activeTab])
  // `dock-right` is a preference, not permission to destroy the workspace.
  // Below the desktop docking threshold — including app-zoom reflow that media
  // queries cannot see — the same surface becomes a normal modal, restoring a
  // focus trap/backdrop and keeping still-focusable workspace controls visible.
  // Wide docks start below the live app chrome via --topbar-bottom.

  const resolveInitialFocus = useCallback(() => {
    if (initialFocusRef?.current) return initialFocusRef.current
    if (tabs && tabs.length > 0 && activeTab) {
      const activeTabEl = shellRef.current?.querySelector<HTMLElement>(
        `#${CSS.escape(`${titleId}-tab-${activeTab}`)}`,
      )
      if (activeTabEl) return activeTabEl
    }
    const bodyEl = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
    if (bodyEl) return bodyEl
    return shellRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS) ?? null
  }, [activeTab, initialFocusRef, tabs, titleId])

  useEscapeToClose(!docked && closeOnEscape, onClose)
  useFocusTrap(shellRef, {
    active: !docked,
    initialFocus: resolveInitialFocus,
    initialFocusKey,
  })

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!tabs || !onTabChange) return
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (direction === 0 && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + direction + tabs.length) % tabs.length
    onTabChange(tabs[nextIndex].id)
    shellRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${titleId}-tab-${tabs[nextIndex].id}`)}`)
      ?.focus()
  }, [onTabChange, tabs, titleId])

  return (
    <div
      className={docked ? 'dock-backdrop' : 'modal-backdrop'}
      role="presentation"
      onMouseDown={docked || !closeOnBackdrop ? undefined : (event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={shellRef}
        className={`unified-panel-shell ${className}${wide ? ' unified-panel-wide' : ''}${docked ? ' unified-panel-docked' : ''}`}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : true}
        aria-label={docked ? ariaLabel : modalAriaLabel}
        aria-labelledby={!docked && !modalAriaLabel ? titleId : undefined}
        aria-describedby={!docked && subtitle ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="unified-panel-header">
          <div>
            {headerMeta}
            <h2 id={titleId}>
              {icon}
              {title}
            </h2>
            {subtitle ? <p id={descriptionId} className="health-subtitle">{subtitle}</p> : null}
          </div>
          {headerActions || showClose ? (
            <div className="unified-panel-header-actions">
              {headerActions}
              {showClose ? (
                <IconButton label={`${t('actions.close')} ${title}`} onClick={onClose}>
                  <X aria-hidden="true" />
                </IconButton>
              ) : null}
            </div>
          ) : null}
        </header>

        {tabs && tabs.length > 0 && activeTab && onTabChange ? (
          <div className="unified-panel-tabs" role="tablist" aria-label={`${title} sections`}>
            {tabs.map((tab, index) => {
              const selected = activeTab === tab.id
              const tabId = `${titleId}-tab-${tab.id}`
              const panelId = `${titleId}-panel-${tab.id}`
              return (
                <button
                  id={tabId}
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  className={selected ? 'active' : undefined}
                  onClick={() => onTabChange(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        ) : null}

        <div
          ref={bodyRef}
          id={activeTab ? `${titleId}-panel-${activeTab}` : undefined}
          className="unified-panel-body"
          role={activeTab ? 'tabpanel' : undefined}
          aria-labelledby={activeTab ? `${titleId}-tab-${activeTab}` : undefined}
        >
          {children}
        </div>

        {footer ? <footer className="unified-panel-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}

export const UnifiedPanelShell = memo(UnifiedPanelShellImpl)
