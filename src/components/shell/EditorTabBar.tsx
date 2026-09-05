import { RotateCcw, FileText, Pin, X } from 'lucide-react'

import { useI18n } from '../../lib/i18n'

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
  const { t } = useI18n()

  return (
    <div
      className="tabs-row"
      role={openTabs.length > 0 ? 'tablist' : 'group'}
      aria-label={openTabs.length > 0 ? t('editor.tabBar.openNotes') : t('editor.tabBar.editorTabs')}
    >
      {canReopenClosedTab && onReopenClosedTab ? (
        <span role="presentation">
          <button
            type="button"
            className="tab-reopen"
            onClick={onReopenClosedTab}
            aria-label={t('editor.tabBar.reopen')}
            title={t('editor.tabBar.reopen')}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        </span>
      ) : null}
      {openTabs.length === 0 ? (
        <span className="empty-tab" role="presentation">{t('editor.tabBar.noNote')}</span>
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
                <span className="tab-lifecycle inbox" title={t('editor.tabBar.inbox')}>
                  {t('editor.tabBar.inboxShort')}
                </span>
              ) : null}
              {tab.path === activePath && isNoteDirty ? (
                <span className="tab-dirty-dot" aria-label={t('editor.tabBar.unsaved')} title={t('editor.tabBar.unsaved')} />
              ) : null}
            </button>
            {onTogglePinTab ? (
              <button
                type="button"
                className={`tab-icon-button tab-pin${tab.pinned ? ' active' : ''}`}
                aria-label={tab.pinned ? t('editor.tabBar.unpin', { title: tab.title }) : t('editor.tabBar.pin', { title: tab.title })}
                title={tab.pinned ? t('editor.tabBar.unpinTab') : t('editor.tabBar.pinTab')}
                onClick={() => onTogglePinTab(tab.path)}
              >
                <Pin aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="tab-icon-button tab-close"
              aria-label={t('editor.tabBar.close', { title: tab.title })}
              title={t('editor.tabBar.closeTab')}
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
