import { memo, useRef, useState } from 'react'
import { BookOpen, Command, FileOutput, LayoutGrid, MoreHorizontal, PenLine, Puzzle, Sparkles } from 'lucide-react'

import { type WorkspaceMode } from '../../hooks/useWorkspaceMode'
import { useI18n } from '../../lib/i18n'

export type MobilePane = 'vault' | 'editor' | 'inspector' | 'command'

interface MobileWorkspaceNavProps {
  activePane: MobilePane
  workspaceMode: WorkspaceMode
  onSelectPane: (pane: MobilePane) => void
  onOpenCommand: () => void
  onOpenPlugins: () => void
  pluginsActive: boolean
  onOpenKnowledgeWorkbench?: () => void
  onOpenPublishCenter?: () => void
  onOpenHealth?: () => void
  onOpenMcp?: () => void
}

const PRIMARY_ITEMS: { id: 'vault' | 'editor'; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'vault', labelKey: 'mobile.vault', icon: LayoutGrid },
  { id: 'editor', labelKey: 'mobile.write', icon: PenLine },
]

function MobileWorkspaceNavImpl({
  activePane,
  workspaceMode,
  onSelectPane,
  onOpenCommand,
  onOpenPlugins,
  pluginsActive,
  onOpenKnowledgeWorkbench,
  onOpenPublishCenter,
  onOpenHealth,
  onOpenMcp,
}: MobileWorkspaceNavProps) {
  const { t } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButton = useRef<HTMLButtonElement>(null)
  const moreActive = activePane === 'inspector' || activePane === 'command' || pluginsActive
  const modeAction =
    workspaceMode === 'knowledge' && onOpenKnowledgeWorkbench
      ? { label: t('mobile.openWorkbench'), run: onOpenKnowledgeWorkbench }
      : workspaceMode === 'publish' && onOpenPublishCenter
        ? { label: t('mobile.openPublish'), run: onOpenPublishCenter }
        : workspaceMode === 'review' && onOpenHealth
          ? { label: t('mobile.openHealth'), run: onOpenHealth }
          : workspaceMode === 'automation' && onOpenMcp
            ? { label: t('mobile.openMcp'), run: onOpenMcp }
            : null

  return (
    <div className="mobile-workspace-chrome" onKeyDown={event => {
      if (event.key === 'Escape' && moreOpen) {
        event.preventDefault()
        event.stopPropagation()
        setMoreOpen(false)
        moreButton.current?.focus()
      }
    }}>
      {modeAction ? (
        <div className="mobile-mode-actions" role="region" aria-label={t('mobile.modeActions', { mode: t(`workspaceModes.${workspaceMode}`) })}>
          <span className="mobile-mode-label">{t('mobile.modeLabel', { mode: t(`workspaceModes.${workspaceMode}`) })}</span>
          <button type="button" className="mobile-mode-action" onClick={modeAction.run}>
            {workspaceMode === 'publish' ? <FileOutput size={14} /> : <Sparkles size={14} />}
            {modeAction.label}
          </button>
        </div>
      ) : null}

      {moreOpen ? (
        <div id="mobile-workspace-more" className="mobile-more-menu" role="group" aria-label={t('mobile.moreDestinations')}>
          <button type="button" onClick={() => { setMoreOpen(false); onSelectPane('inspector') }}>
            <BookOpen size={18} aria-hidden="true" />{t('mobile.inspector')}
          </button>
          <button type="button" onClick={() => { setMoreOpen(false); onOpenPlugins() }}>
            <Puzzle size={18} aria-hidden="true" />{t('topBar.plugins')}
          </button>
        </div>
      ) : null}
      <nav className="mobile-workspace-nav surface-glass" aria-label={t('mobile.navigation')}>
        {PRIMARY_ITEMS.map(({ id, labelKey, icon: Icon }) => (
          <button key={id} type="button"
            className={`mobile-nav-item pressable ${activePane === id ? 'is-active' : ''}`}
            aria-label={t(labelKey)} title={t(labelKey)}
            aria-current={activePane === id ? 'page' : undefined}
            onClick={() => { setMoreOpen(false); onSelectPane(id) }}>
            <Icon aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
        <button type="button"
          className="mobile-nav-item pressable"
          aria-label={t('mobile.command')}
          title={t('mobile.command')}
          onClick={() => { setMoreOpen(false); onOpenCommand() }}>
          <Command aria-hidden="true" />
          <span>{t('mobile.command')}</span>
        </button>
        <button ref={moreButton} type="button"
          className={`mobile-nav-item pressable ${moreActive ? 'is-active' : ''}`}
          aria-label={t('mobile.more')}
          aria-expanded={moreOpen}
          aria-current={moreActive ? 'page' : undefined}
          aria-controls={moreOpen ? 'mobile-workspace-more' : undefined}
          onClick={() => setMoreOpen(value => !value)}>
          <MoreHorizontal aria-hidden="true" />
          <span>{t('mobile.more')}</span>
        </button>
      </nav>
    </div>
  )
}

export const MobileWorkspaceNav = memo(MobileWorkspaceNavImpl)
