import { BookOpen, Command, FileOutput, LayoutGrid, PenLine, Sparkles } from 'lucide-react'

import { WORKSPACE_MODE_LABELS, type WorkspaceMode } from '../../hooks/useWorkspaceMode'

export type MobilePane = 'vault' | 'editor' | 'inspector' | 'command'

interface MobileWorkspaceNavProps {
  activePane: MobilePane
  workspaceMode: WorkspaceMode
  onSelectPane: (pane: MobilePane) => void
  onOpenCommand: () => void
  onOpenKnowledgeWorkbench?: () => void
  onOpenPublishCenter?: () => void
  onOpenHealth?: () => void
  onOpenMcp?: () => void
}

const ITEMS: { id: MobilePane; label: string; icon: typeof BookOpen }[] = [
  { id: 'vault', label: 'Vault', icon: LayoutGrid },
  { id: 'editor', label: 'Write', icon: PenLine },
  { id: 'inspector', label: 'Lens', icon: BookOpen },
  { id: 'command', label: 'Command', icon: Command },
]

export function MobileWorkspaceNav({
  activePane,
  workspaceMode,
  onSelectPane,
  onOpenCommand,
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
            className={`mobile-nav-item pressable ${activePane === id ? 'is-active' : ''}`}
            aria-current={activePane === id ? 'page' : undefined}
            onClick={() => {
              if (id === 'command') {
                onOpenCommand()
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
