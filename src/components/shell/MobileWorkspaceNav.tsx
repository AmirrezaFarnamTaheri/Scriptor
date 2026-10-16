import { memo } from 'react'
import { BookOpen, Command, FileOutput, LayoutGrid, PenLine, Puzzle, Sparkles } from 'lucide-react'

import { WORKSPACE_MODE_LABELS, type WorkspaceMode } from '../../hooks/useWorkspaceMode'

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

const ITEMS: { id: MobilePane | 'plugins'; label: string; icon: typeof BookOpen }[] = [
  { id: 'vault', label: 'Vault', icon: LayoutGrid },
  { id: 'editor', label: 'Write', icon: PenLine },
  { id: 'inspector', label: 'Inspector', icon: BookOpen },
  { id: 'command', label: 'Command', icon: Command },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
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
  const modeAction =
    workspaceMode === 'knowledge' && onOpenKnowledgeWorkbench
      ? { label: 'Open workbench', run: onOpenKnowledgeWorkbench }
      : workspaceMode === 'publish' && onOpenPublishCenter
        ? { label: 'Open publish center', run: onOpenPublishCenter }
        : workspaceMode === 'review' && onOpenHealth
          ? { label: 'Open vault health', run: onOpenHealth }
          : workspaceMode === 'automation' && onOpenMcp
            ? { label: 'Open MCP panel', run: onOpenMcp }
            : null

  return (
    <div className="mobile-workspace-chrome">
      {modeAction ? (
        <div className="mobile-mode-actions" role="region" aria-label={`${WORKSPACE_MODE_LABELS[workspaceMode]} actions`}>
          <span className="mobile-mode-label">{WORKSPACE_MODE_LABELS[workspaceMode]} mode</span>
          <button type="button" className="mobile-mode-action" onClick={modeAction.run}>
            {workspaceMode === 'publish' ? <FileOutput size={14} /> : <Sparkles size={14} />}
            {modeAction.label}
          </button>
        </div>
      ) : null}

      <nav className="mobile-workspace-nav surface-glass" aria-label="Mobile workspace navigation">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`mobile-nav-item pressable ${(id === 'plugins' ? activePane === 'inspector' && pluginsActive : activePane === id && (id !== 'inspector' || !pluginsActive)) ? 'is-active' : ''}`}
            aria-label={label}
            title={label}
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
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export const MobileWorkspaceNav = memo(MobileWorkspaceNavImpl)
