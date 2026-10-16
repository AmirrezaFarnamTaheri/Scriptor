import { memo } from 'react'
import { BookOpen, Command, FileOutput, LayoutGrid, PenLine, Puzzle, Sparkles } from 'lucide-react'

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

const ITEMS: { id: MobilePane | 'plugins'; labelKey: string; icon: typeof BookOpen }[] = [
  { id: 'vault', labelKey: 'mobile.vault', icon: LayoutGrid },
  { id: 'editor', labelKey: 'mobile.write', icon: PenLine },
  { id: 'inspector', labelKey: 'mobile.inspector', icon: BookOpen },
  { id: 'command', labelKey: 'mobile.command', icon: Command },
  { id: 'plugins', labelKey: 'topBar.plugins', icon: Puzzle },
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
    <div className="mobile-workspace-chrome">
      {modeAction ? (
        <div className="mobile-mode-actions" role="region" aria-label={t('mobile.modeActions', { mode: t(`workspaceModes.${workspaceMode}`) })}>
          <span className="mobile-mode-label">{t('mobile.modeLabel', { mode: t(`workspaceModes.${workspaceMode}`) })}</span>
          <button type="button" className="mobile-mode-action" onClick={modeAction.run}>
            {workspaceMode === 'publish' ? <FileOutput size={14} /> : <Sparkles size={14} />}
            {modeAction.label}
          </button>
        </div>
      ) : null}

      <nav className="mobile-workspace-nav surface-glass" aria-label={t('mobile.navigation')}>
        {ITEMS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`mobile-nav-item pressable ${(id === 'plugins' ? activePane === 'inspector' && pluginsActive : activePane === id && (id !== 'inspector' || !pluginsActive)) ? 'is-active' : ''}`}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            aria-current={(id === 'plugins' ? activePane === 'inspector' && pluginsActive : activePane === id && (id !== 'inspector' || !pluginsActive)) ? 'page' : undefined}
            onClick={() => {
              if (id === 'command') {
                onOpenCommand()
                return
              }
              if (id === 'plugins') {
                onOpenPlugins()
                return
              }
              onSelectPane(id)
            }}
          >
            <Icon aria-hidden />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export const MobileWorkspaceNav = memo(MobileWorkspaceNavImpl)
