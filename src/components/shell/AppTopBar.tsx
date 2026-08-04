import {
  BookOpenText,
  Box,
  ChevronDown,
  ChevronRight,
  Command,
  Contrast,
  FolderOpen,
  GitBranch,
  Globe,
  Heart,
  LayoutDashboard,
  Lock,
  Moon,
  Network,
  PanelLeft,
  PanelRight,
  Settings,
  Sun,
  Zap,
} from 'lucide-react'

import { BrandMark, BrandWordmark } from '../../brand/BrandMark'
import { IconButton } from '../chrome/WorkspaceChrome'
import { WorkspaceSwitcher } from '../app/WorkspaceSwitcher'
import type { AppTheme } from '../../hooks/useAppTheme'
import type { VaultDescriptor } from '../../types/vault'
import { useI18n } from '../../lib/i18n'
import { WORKSPACE_MODE_LABELS, type WorkspaceMode } from '../../hooks/useWorkspaceMode'

interface AppTopBarProps {
  vault: VaultDescriptor | null
  workspaceMode: WorkspaceMode
  onWorkspaceModeChange: (mode: WorkspaceMode) => void
  onOpenKnowledgeWorkbench: () => void
  onOpenPublishCenter: () => void
  canNavigateBack: boolean
  canNavigateForward: boolean
  onNavigateBack: () => void
  onNavigateForward: () => void
  onChooseVault: () => void
  recentVaults: string[]
  activeVaultPath: string | null
  onOpenVault: (path: string) => void
  onOpenCommandPalette: () => void
  onOpenPortal: () => void
  onOpenQuickCapture: () => void
  onOpenGraph: () => void
  onOpenCanvas: () => void
  gitTitle: string
  gitSuccess: boolean
  gitNeutral?: boolean
  onOpenGit: () => void
  mcpLabel: string
  onOpenMcp: () => void
  onOpenSupport: () => void
  onOpenSettings: () => void
  theme: AppTheme
  onToggleTheme: () => void
  vaultSidebarCollapsed: boolean
  onToggleVaultSidebar: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
}

const MODE_LABEL_KEYS: Record<WorkspaceMode, string> = {
  writing: 'workspaceModes.writing',
  knowledge: 'workspaceModes.knowledge',
  publish: 'workspaceModes.publish',
  review: 'workspaceModes.review',
  automation: 'workspaceModes.automation',
}

export function AppTopBar({
  vault,
  workspaceMode,
  onWorkspaceModeChange,
  onOpenKnowledgeWorkbench,
  onOpenPublishCenter,
  canNavigateBack,
  canNavigateForward,
  onNavigateBack,
  onNavigateForward,
  onChooseVault,
  recentVaults,
  activeVaultPath,
  onOpenVault,
  onOpenCommandPalette,
  onOpenPortal,
  onOpenQuickCapture,
  onOpenGraph,
  onOpenCanvas,
  gitTitle,
  gitSuccess,
  gitNeutral = false,
  onOpenGit,
  mcpLabel,
  onOpenMcp,
  onOpenSupport,
  onOpenSettings,
  theme,
  onToggleTheme,
  vaultSidebarCollapsed,
  onToggleVaultSidebar,
  inspectorCollapsed,
  onToggleInspector,
}: AppTopBarProps) {
  const { t } = useI18n()
  return (
    <header className="topbar surface-glass">
      <div className="brand">
        <IconButton
          label={vaultSidebarCollapsed ? t('actions.expand') ?? 'Expand sidebar' : t('actions.collapse') ?? 'Collapse sidebar'}
          shortcut="⌘\"
          onClick={onToggleVaultSidebar}
        >
          <PanelLeft />
        </IconButton>
        <BrandMark />
        <BrandWordmark />
        {vault ? <small className="vault-badge">{vault.name}</small> : null}
      </div>

      <div className="history-controls" aria-label="History controls">
        <IconButton label={t('actions.back')} disabled={!canNavigateBack} onClick={onNavigateBack}>
          <ChevronRight className="flip" />
        </IconButton>
        <IconButton label={t('actions.forward')} disabled={!canNavigateForward} onClick={onNavigateForward}>
          <ChevronRight />
        </IconButton>
        <button type="button" className="action-button" onClick={onChooseVault}>
          <FolderOpen />
          {t('topBar.openVault')}
        </button>
        <WorkspaceSwitcher
          recentVaults={recentVaults}
          activeVaultPath={activeVaultPath}
          onOpenVault={onOpenVault}
          onChooseVault={onChooseVault}
        />
      </div>

      <div className="workspace-mode-strip" aria-label="Workspace mode">
        {(Object.keys(WORKSPACE_MODE_LABELS) as WorkspaceMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={workspaceMode === mode ? 'workspace-mode active' : 'workspace-mode'}
            aria-pressed={workspaceMode === mode}
            onClick={() => onWorkspaceModeChange(mode)}
          >
            {t(MODE_LABEL_KEYS[mode])}
          </button>
        ))}
      </div>

      <label className="command-search" onClick={onOpenCommandPalette}>
        <Command />
        <span className="kbd">⌘K</span>
        <input
          type="search"
          placeholder={t('topBar.typeCommandOrSearch')}
          aria-label={t('topBar.typeCommandOrSearch')}
          readOnly
          onFocus={onOpenCommandPalette}
        />
      </label>

      <div className="top-actions" data-workspace-mode={workspaceMode}>
        <IconButton
          label={t('topBar.workbench')}
          onClick={onOpenKnowledgeWorkbench}
          className={workspaceMode === 'knowledge' ? 'emphasized' : undefined}
        >
          <BookOpenText />
        </IconButton>
        <IconButton
          label={t('topBar.publish')}
          onClick={onOpenPublishCenter}
          className={workspaceMode === 'publish' ? 'emphasized' : undefined}
        >
          <Globe />
        </IconButton>
        <IconButton label={t('topBar.portal')} onClick={onOpenPortal}>
          <LayoutDashboard />
        </IconButton>
        <IconButton label={t('topBar.capture')} onClick={onOpenQuickCapture}>
          <Zap />
        </IconButton>
        <IconButton label={t('topBar.graph')} onClick={onOpenGraph}>
          <Network />
        </IconButton>
        <IconButton label={t('topBar.canvas')} onClick={onOpenCanvas}>
          <Box />
        </IconButton>
        
        <button
          type="button"
          className={`status-button has-custom-tooltip ${gitSuccess ? 'success' : ''} ${gitNeutral ? 'neutral' : ''}`}
          aria-label={gitTitle}
          onClick={onOpenGit}
        >
          <GitBranch />
          <span className="custom-tooltip" role="tooltip">
            {gitTitle}
            <kbd className="shortcut-badge">⌘G</kbd>
          </span>
        </button>
        <button
          type="button"
          className={`status-button has-custom-tooltip${workspaceMode === 'automation' ? ' emphasized' : ''}`}
          onClick={onOpenMcp}
          aria-label={mcpLabel}
        >
          <Lock />
          <span className="sr-only">{mcpLabel}</span>
          <ChevronDown />
          <span className="custom-tooltip" role="tooltip">
            {mcpLabel}
          </span>
        </button>
        
        <IconButton
          label={
            theme === 'high-contrast'
              ? t('topBar.switchToLight')
              : theme === 'dark'
                ? t('topBar.switchToHighContrast')
                : t('topBar.switchToDark')
          }
          onClick={onToggleTheme}
        >
          {theme === 'high-contrast' ? <Contrast /> : theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton
          label={inspectorCollapsed ? 'Expand inspector' : 'Collapse inspector'}
          shortcut="⌘I"
          onClick={onToggleInspector}
        >
          <PanelRight />
        </IconButton>
        <IconButton label={t('topBar.supportScriptor')} onClick={onOpenSupport}>
          <Heart />
        </IconButton>
        <IconButton label={t('topBar.settings')} onClick={onOpenSettings}>
          <Settings />
        </IconButton>
      </div>
    </header>
  )
}
