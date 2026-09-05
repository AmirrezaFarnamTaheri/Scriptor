import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'
import { IconButton } from './WorkspaceChrome'

export interface PanelTab {
  id: string
  label: string
}

interface UnifiedPanelShellProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  ariaLabel: string
  onClose: () => void
  tabs?: PanelTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
  headerActions?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
  presentation?: PanelPresentation
}

const DOCK_MEDIA_QUERY = '(min-width: 1321px)'

function useDockViewport(): boolean {
  const [canDock, setCanDock] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DOCK_MEDIA_QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(DOCK_MEDIA_QUERY)
    const update = () => setCanDock(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return canDock
}

export function UnifiedPanelShell({
  title,
  subtitle,
  icon,
  ariaLabel,
  onClose,
  tabs,
  activeTab,
  onTabChange,
  headerActions,
  children,
  className = 'knowledge-filters-panel',
  wide = false,
  presentation = 'modal',
}: UnifiedPanelShellProps) {
  const shellRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const canDock = useDockViewport()
  const docked = presentation === 'dock-right' && canDock
  // `dock-right` is a preference, not permission to destroy the workspace.
  // Below the desktop docking threshold the same surface becomes a normal
  // modal, restoring a focus trap/backdrop and preventing a nearly full-width
  // non-modal sheet from covering still-focusable workspace controls.
  // Wide docks start below the live app chrome via --topbar-bottom.

  useEscapeToClose(!docked, onClose)
  useFocusTrap(shellRef, { active: !docked })

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
      onMouseDown={docked ? undefined : (event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section
        ref={shellRef}
        className={`unified-panel-shell ${className}${wide ? ' unified-panel-wide' : ''}${docked ? ' unified-panel-docked' : ''}`}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : true}
        aria-label={docked ? ariaLabel : undefined}
        aria-labelledby={docked ? undefined : titleId}
        aria-describedby={!docked && subtitle ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="unified-panel-header">
          <div>
            <h2 id={titleId}>
              {icon}
              {title}
            </h2>
            {subtitle ? <p id={descriptionId} className="health-subtitle">{subtitle}</p> : null}
          </div>
          <div className="unified-panel-header-actions">
            {headerActions}
            <IconButton label={`Close ${title}`} onClick={onClose}>
              <X aria-hidden="true" />
            </IconButton>
          </div>
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
          id={activeTab ? `${titleId}-panel-${activeTab}` : undefined}
          className="unified-panel-body"
          role={activeTab ? 'tabpanel' : undefined}
          aria-labelledby={activeTab ? `${titleId}-tab-${activeTab}` : undefined}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
