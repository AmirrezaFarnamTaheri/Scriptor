import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  FolderOpen,
  Lock,
  Heart,
  Contrast,
  Moon,
  Network,
  Settings,
  Sun,
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
  gitLabel: string
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
  gitLabel,
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
}: AppTopBarProps) {
  const { t } = useI18n()
  return (
    <header className="topbar surface-glass">
      <div className="brand">
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
        <span className="kbd">K</span>
        <input
          type="search"
          placeholder={t('topBar.typeCommandOrSearch')}
          aria-label={t('topBar.typeCommandOrSearch')}
          readOnly
          onFocus={onOpenCommandPalette}
        />
      </label>

      <div className="top-actions" data-workspace-mode={workspaceMode}>
        <button
          type="button"
          className={`toolbar-button mode-action${workspaceMode === 'knowledge' ? ' emphasized' : ''}`}
          onClick={onOpenKnowledgeWorkbench}
        >
          {t('topBar.workbench')}
        </button>
        <button
          type="button"
          className={`toolbar-button mode-action${workspaceMode === 'publish' ? ' emphasized' : ''}`}
          onClick={onOpenPublishCenter}
        >
          {t('topBar.publish')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenPortal}>
          {t('topBar.portal')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenQuickCapture}>
          {t('topBar.capture')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenGraph}>
          <Network />
          {t('topBar.graph')}
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenCanvas}>
          <Box />
          {t('topBar.canvas')}
        </button>
        <button
          type="button"
          className={`status-button ${gitSuccess ? 'success' : ''} ${gitNeutral ? 'neutral' : ''}`}
          title={gitTitle}
          onClick={onOpenGit}
        >
          <CheckCircle2 />
          {gitLabel}
        </button>
        <button
          type="button"
          className={`status-button${workspaceMode === 'automation' ? ' emphasized' : ''}`}
          onClick={onOpenMcp}
        >
          <Lock />
          {mcpLabel}
          <ChevronDown />
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
