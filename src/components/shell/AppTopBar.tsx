import {
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  FolderOpen,
  Lock,
  Heart,
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
  return (
    <header className="topbar surface-glass">
      <div className="brand">
        <BrandMark />
        <BrandWordmark />
        {vault ? <small className="vault-badge">{vault.name}</small> : null}
      </div>

      <div className="history-controls" aria-label="History controls">
        <IconButton label="Back" disabled={!canNavigateBack} onClick={onNavigateBack}>
          <ChevronRight className="flip" />
        </IconButton>
        <IconButton label="Forward" disabled={!canNavigateForward} onClick={onNavigateForward}>
          <ChevronRight />
        </IconButton>
        <button type="button" className="action-button" onClick={onChooseVault}>
          <FolderOpen />
          Open Vault
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
            {WORKSPACE_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <label className="command-search" onClick={onOpenCommandPalette}>
        <Command />
        <span className="kbd">K</span>
        <input
          type="search"
          placeholder="Type a command or search..."
          aria-label="Command or search"
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
          Workbench
        </button>
        <button
          type="button"
          className={`toolbar-button mode-action${workspaceMode === 'publish' ? ' emphasized' : ''}`}
          onClick={onOpenPublishCenter}
        >
          Publish
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenPortal}>
          Portal
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenQuickCapture}>
          Capture
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenGraph}>
          <Network />
          Graph
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenCanvas}>
          <Box />
          Canvas
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
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton label="Support Scriptor" onClick={onOpenSupport}>
          <Heart />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings />
        </IconButton>
      </div>
    </header>
  )
}
