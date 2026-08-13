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
  Palette,
  Settings,
  Sun,
  Zap,
} from 'lucide-react'

import { BrandMark, BrandWordmark } from '../../brand/BrandMark'
import { IconButton } from '../chrome/WorkspaceChrome'
import { getDefaultShortcut } from '../../lib/commandShortcutRegistry'
import { formatShortcut } from '../../lib/keyboardShortcuts'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { WorkspaceSwitcher } from '../app/WorkspaceSwitcher'
import type { AppTheme } from '../../hooks/useAppTheme'
import { getNextTheme, THEME_DISPLAY_NAMES } from '../../hooks/useAppTheme'
import type { VaultDescriptor } from '../../types/vault'
import { useI18n } from '../../lib/i18n'
import { WORKSPACE_MODE_LABELS, type WorkspaceMode } from '../../hooks/useWorkspaceMode'
import type { WorkspaceChromePrefs } from '../../hooks/useWorkspaceChrome'

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
  onOpenPluginManager?: () => void
  theme: AppTheme
  onToggleTheme: () => void
  vaultSidebarCollapsed: boolean
  onToggleVaultSidebar: () => void
  inspectorCollapsed: boolean
  onToggleInspector: () => void
  chrome?: WorkspaceChromePrefs
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
  onOpenPluginManager,
  theme,
  onToggleTheme,
  vaultSidebarCollapsed,
  onToggleVaultSidebar,
  inspectorCollapsed,
  onToggleInspector,
  chrome,
}: AppTopBarProps) {
  const { t } = useI18n()
  const { getShortcut } = useKeyboardShortcuts()
  const sidebarShortcut = formatShortcut(
    getShortcut('toggle-vault-sidebar', getDefaultShortcut('toggle-vault-sidebar')),
  )
  const commandShortcut = formatShortcut('Mod+K') ?? 'Ctrl+K'
  const gitShortcut = formatShortcut(getShortcut('open-git', getDefaultShortcut('open-git')))
  const inspectorShortcut = formatShortcut(
    getShortcut('toggle-inspector', getDefaultShortcut('toggle-inspector')),
  )

  // The theme control advertises the theme its next click will apply, so the
  // accessible name has to be derived from the real cycle rather than a fixed
  // light/dark/high-contrast ternary.
  const nextTheme = getNextTheme(theme)
  const themeToggleLabel =
    nextTheme === 'light'
      ? t('topBar.switchToLight')
      : nextTheme === 'dark'
        ? t('topBar.switchToDark')
        : nextTheme === 'high-contrast'
          ? t('topBar.switchToHighContrast')
          : t('topBar.switchToTheme', { theme: THEME_DISPLAY_NAMES[nextTheme] ?? nextTheme })

  if (chrome?.showTopBar === false) return null

  const showHistory = chrome?.showHistoryControls !== false
  const showModeStrip = chrome?.showModeStrip !== false
  const showActions = chrome?.showQuickActions !== false

  return (
    <header className="topbar surface-glass">
      <div className="brand">
        <IconButton
          label={vaultSidebarCollapsed ? t('topBar.expandSidebar') : t('topBar.collapseSidebar')}
          shortcut={sidebarShortcut}
          onClick={onToggleVaultSidebar}
        >
          <PanelLeft />
        </IconButton>
        <BrandMark />
        <BrandWordmark />
        {vault ? <small className="vault-badge">{vault.name}</small> : null}
      </div>

      {showHistory ? (
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
      ) : null}

      {showModeStrip ? (
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
      ) : null}

      {/* P0 fix: was a <label> wrapping a readOnly <input> (semantically broken).
           Now a proper <button> styled to look like a search field. */}
      <button
        type="button"
        className="command-search"
        onClick={onOpenCommandPalette}
        aria-label={`Open command palette (${commandShortcut})`}
      >
        <Command aria-hidden="true" />
        <span className="command-search-placeholder">Type a command or search…</span>
        <kbd className="kbd" aria-hidden="true">{commandShortcut}</kbd>
      </button>

      <div className="top-actions" data-workspace-mode={workspaceMode}>
        {showActions ? (
          <>
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
          </>
        ) : null}

        <button
          type="button"
          className={`status-button has-custom-tooltip ${gitSuccess ? 'success' : ''} ${gitNeutral ? 'neutral' : ''}`}
          aria-label={gitShortcut ? `${gitTitle} (${gitShortcut})` : gitTitle}
          onClick={onOpenGit}
        >
          <GitBranch />
          <span className="custom-tooltip" aria-hidden="true">
            {gitTitle}
            {gitShortcut ? <kbd className="shortcut-badge">{gitShortcut}</kbd> : null}
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
          <span className="custom-tooltip" aria-hidden="true">
            {mcpLabel}
          </span>
        </button>

        <IconButton label={themeToggleLabel} onClick={onToggleTheme}>
          {theme === 'high-contrast' ? <Contrast /> : theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        <IconButton
          label={inspectorCollapsed ? t('topBar.expandInspector') : t('topBar.collapseInspector')}
          shortcut={inspectorShortcut}
          onClick={onToggleInspector}
        >
          <PanelRight />
        </IconButton>
        <IconButton label={t('topBar.supportScriptor')} onClick={onOpenSupport}>
          <Heart />
        </IconButton>
        {onOpenPluginManager ? (
          <IconButton label="Extension &amp; Color Palette Store" onClick={onOpenPluginManager}>
            <Palette />
          </IconButton>
        ) : null}
        <IconButton label={t('topBar.settings')} onClick={onOpenSettings}>
          <Settings />
        </IconButton>
      </div>
    </header>
  )
}
