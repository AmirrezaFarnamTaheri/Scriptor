import { RotateCcw, FileText, Pin, X } from 'lucide-react'

export interface OpenTab {
  path: string
  title: string
  contentHash: string
  pinned?: boolean
}

export interface EditorTabBarProps {
  activePath: string | null
  openTabs: OpenTab[]
  isNoteDirty?: boolean
  inboxPaths?: Set<string>
  canReopenClosedTab?: boolean
  onReopenClosedTab?: () => void
  onTogglePinTab?: (path: string) => void
  onOpenTab: (path: string) => void
  onCloseTab: (path: string) => void
}

export function EditorTabBar({
  activePath,
  openTabs,
  isNoteDirty,
  inboxPaths,
  canReopenClosedTab,
  onReopenClosedTab,
  onTogglePinTab,
  onOpenTab,
  onCloseTab,
}: EditorTabBarProps) {
  return (
    <div className="tabs-row" role="tablist" aria-label="Open notes">
      {canReopenClosedTab && onReopenClosedTab ? (
        <span role="presentation">
          <button
            type="button"
            className="tab-reopen"
            onClick={onReopenClosedTab}
            aria-label="Reopen closed tab"
            title="Reopen closed tab"
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </span>
      ) : null}
      {openTabs.length === 0 ? (
        <span className="empty-tab" role="presentation">No note open</span>
      ) : (
        openTabs.map((tab, tabIndex) => (
          <div
            className={`tab-item${tab.path === activePath ? ' active' : ''}${tab.path === activePath && isNoteDirty ? ' tab-dirty' : ''}${tab.pinned ? ' tab-pinned' : ''}`}
            key={tab.path}
            role="presentation"
          >
            <button
              type="button"
              className="tab tab-main"
              role="tab"
              aria-selected={tab.path === activePath}
              tabIndex={tab.path === activePath ? 0 : -1}
              onClick={() => onOpenTab(tab.path)}
              onKeyDown={(event) => {
                let targetIndex = tabIndex
                if (event.key === 'ArrowLeft') targetIndex = (tabIndex - 1 + openTabs.length) % openTabs.length
                else if (event.key === 'ArrowRight') targetIndex = (tabIndex + 1) % openTabs.length
                else if (event.key === 'Home') targetIndex = 0
                else if (event.key === 'End') targetIndex = openTabs.length - 1
                else return
                event.preventDefault()
                const target = openTabs[targetIndex]
                onOpenTab(target.path)
                requestAnimationFrame(() => {
                  const tabButtons = event.currentTarget
                    .closest('[role="tablist"]')
                    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  tabButtons?.[targetIndex]?.focus()
                })
              }}
            >
              <FileText aria-hidden="true" />
              <span className="tab-title">{tab.title}</span>
              {inboxPaths?.has(tab.path) ? (
                <span className="tab-lifecycle inbox" title="In inbox">
                  inbox
                </span>
              ) : null}
              {tab.path === activePath && isNoteDirty ? (
                <span className="tab-dirty-dot" aria-label="Unsaved changes" title="Unsaved changes" />
              ) : null}
            </button>
            {onTogglePinTab ? (
              <button
                type="button"
                className={`tab-icon-button tab-pin${tab.pinned ? ' active' : ''}`}
                aria-label={tab.pinned ? `Unpin ${tab.title}` : `Pin ${tab.title}`}
                title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                onClick={() => onTogglePinTab(tab.path)}
              >
                <Pin aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="tab-icon-button tab-close"
              aria-label={`Close ${tab.title}`}
              title="Close tab"
              onClick={() => onCloseTab(tab.path)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
