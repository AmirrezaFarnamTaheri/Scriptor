import { BookOpen, PenLine, Search, Network, Settings } from 'lucide-react'
import { useState } from 'react'

import { useI18n } from '../lib/i18n'

export type MobilePaneId = 'editor' | 'vault' | 'search' | 'graph' | 'settings'

interface MobileAppProps {
  onOpenSettings?: () => void
}

const NAV_ITEMS: { id: MobilePaneId; icon: typeof PenLine; labelKey: string }[] = [
  { id: 'editor', icon: PenLine, labelKey: 'mobile.write' },
  { id: 'vault', icon: BookOpen, labelKey: 'mobile.vault' },
  { id: 'search', icon: Search, labelKey: 'mobile.search' },
  { id: 'graph', icon: Network, labelKey: 'mobile.graph' },
  { id: 'settings', icon: Settings, labelKey: 'mobile.settings' },
]

export function MobileApp({ onOpenSettings }: MobileAppProps) {
  const { t } = useI18n()
  const [activePane, setActivePane] = useState<MobilePaneId>('editor')

  return (
    <div className="mobile-app">
      <p className="mobile-single-pane-hint">{t('mobile.singlePaneNote')}</p>

      <main className="mobile-content">
        {activePane === 'editor' && (
          <div className="mobile-pane mobile-editor-pane" aria-label="Editor">
            <div className="mobile-pane-placeholder">
              <PenLine size={32} />
              <p>{t('mobile.write')}</p>
            </div>
          </div>
        )}
        {activePane === 'vault' && (
          <div className="mobile-pane mobile-vault-pane" aria-label="Vault tree">
            <div className="mobile-pane-placeholder">
              <BookOpen size={32} />
              <p>{t('mobile.vault')}</p>
            </div>
          </div>
        )}
        {activePane === 'search' && (
          <div className="mobile-pane mobile-search-pane" aria-label="Search">
            <div className="mobile-pane-placeholder">
              <Search size={32} />
              <p>{t('mobile.search')}</p>
            </div>
          </div>
        )}
        {activePane === 'graph' && (
          <div className="mobile-pane mobile-graph-pane" aria-label="Graph">
            <div className="mobile-pane-placeholder">
              <Network size={32} />
              <p>{t('mobile.graph')}</p>
            </div>
          </div>
        )}
        {activePane === 'settings' && (
          <div className="mobile-pane mobile-settings-pane" aria-label="Settings">
            <div className="mobile-pane-placeholder">
              <Settings size={32} />
              <p>{t('mobile.settings')}</p>
            </div>
          </div>
        )}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            className={`mobile-nav-btn ${activePane === id ? 'is-active' : ''}`}
            aria-current={activePane === id ? 'page' : undefined}
            onClick={() => {
              if (id === 'settings' && onOpenSettings) {
                onOpenSettings()
                return
              }
              setActivePane(id)
            }}
          >
            <Icon aria-hidden size={20} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
