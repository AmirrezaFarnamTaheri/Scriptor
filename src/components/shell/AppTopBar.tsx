import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  SlidersHorizontal,
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
  /** Patches chrome preferences (used by the top-bar customize popover). */
  onPatchChrome?: (patch: Partial<WorkspaceChromePrefs>) => void
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
  onPatchChrome,
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

  const hiddenTopBarActions = useMemo(
    () =>
      new Set<string>(
        Array.isArray(chrome?.topBarHiddenActions)
          ? chrome.topBarHiddenActions.filter((id): id is string => typeof id === 'string')
          : [],
      ),
    [chrome?.topBarHiddenActions],
  )
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [customizePos, setCustomizePos] = useState<{ x: number; y: number } | null>(null)
  const customizeAnchorRef = useRef<HTMLButtonElement | null>(null)

  const quickActions = [
    { id: 'workbench', label: t('topBar.workbench'), icon: <BookOpenText />, onClick: onOpenKnowledgeWorkbench, emphasized: workspaceMode === 'knowledge' },
    { id: 'publish', label: t('topBar.publish'), icon: <Globe />, onClick: onOpenPublishCenter, emphasized: workspaceMode === 'publish' },
    { id: 'portal', label: t('topBar.portal'), icon: <LayoutDashboard />, onClick: onOpenPortal, emphasized: false },
    { id: 'capture', label: t('topBar.capture'), icon: <Zap />, onClick: onOpenQuickCapture, emphasized: false },
    { id: 'graph', label: t('topBar.graph'), icon: <Network />, onClick: onOpenGraph, emphasized: false },
    { id: 'canvas', label: t('topBar.canvas'), icon: <Box />, onClick: onOpenCanvas, emphasized: false },
  ]
  const statusActions = [
    { id: 'git', label: gitTitle, icon: <GitBranch />, onClick: onOpenGit },
    { id: 'mcp', label: mcpLabel, icon: <Lock />, onClick: onOpenMcp },
    { id: 'support', label: t('topBar.supportScriptor'), icon: <Heart />, onClick: onOpenSupport },
    { id: 'paletteStore', label: 'Extension & Color Palette Store', icon: <Palette />, onClick: onOpenPluginManager },
  ]

  const toggleHiddenAction = useCallback(
    (id: string) => {
      const next = new Set(hiddenTopBarActions)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onPatchChrome?.({ topBarHiddenActions: Array.from(next) })
    },
    [hiddenTopBarActions, onPatchChrome],
  )

  const openCustomize = useCallback(() => {
    const rect = customizeAnchorRef.current?.getBoundingClientRect()
    setCustomizePos(rect ? { x: rect.right, y: rect.bottom + 6 } : { x: 24, y: 64 })
    setCustomizeOpen((open) => !open)
  }, [])

  useEffect(() => {
    if (!customizeOpen) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.topbar-customize')) return
      if (target?.closest?.('.topbar')) return
      setCustomizeOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [customizeOpen])

  const onHeaderContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      const rect = customizeAnchorRef.current?.getBoundingClientRect()
      setCustomizePos(
        rect
          ? { x: Math.min(event.clientX, rect.right), y: rect.bottom + 6 }
          : { x: event.clientX, y: 64 },
      )
      setCustomizeOpen(true)
    },
    [],
  )

  if (chrome?.showTopBar === false) return null

  const showHistory = chrome?.showHistoryControls !== false
  const showModeStrip = chrome?.showModeStrip !== false
  const showActions = chrome?.showQuickActions !== false

  return (
    <>
      <header className="topbar surface-glass" onContextMenu={onHeaderContextMenu}>
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
          {showActions
            ? quickActions
                .filter((action) => !hiddenTopBarActions.has(action.id))
                .map((action) => (
                  <IconButton
                    key={action.id}
                    label={action.label}
                    onClick={action.onClick}
                    className={action.emphasized ? 'emphasized' : undefined}
                  >
                    {action.icon}
                  </IconButton>
                ))
            : null}

          {!hiddenTopBarActions.has('git') ? (
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
          ) : null}

          {!hiddenTopBarActions.has('mcp') ? (
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
          ) : null}

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
          {!hiddenTopBarActions.has('support') ? (
            <IconButton label={t('topBar.supportScriptor')} onClick={onOpenSupport}>
              <Heart />
            </IconButton>
          ) : null}
          {onOpenPluginManager && !hiddenTopBarActions.has('paletteStore') ? (
            <IconButton label="Extension &amp; Color Palette Store" onClick={onOpenPluginManager}>
              <Palette />
            </IconButton>
          ) : null}
          <IconButton label={t('topBar.settings')} onClick={onOpenSettings}>
            <Settings />
          </IconButton>
          <button
            type="button"
            ref={customizeAnchorRef}
            className={`status-button${customizeOpen ? ' emphasized' : ''}`}
            aria-label="Customize top bar actions"
            aria-expanded={customizeOpen}
            onClick={openCustomize}
          >
            <SlidersHorizontal />
          </button>
        </div>
      </header>
      {customizeOpen && customizePos ? (
        <div
          className="topbar-customize"
          role="dialog"
          aria-label="Customize top bar actions"
          style={{ left: Math.max(8, customizePos.x - 264), top: customizePos.y + 4 }}
        >
          <strong>Top bar actions</strong>
          {[...quickActions, ...statusActions].map((action) => (
            <label key={action.id}>
              <input
                type="checkbox"
                checked={!hiddenTopBarActions.has(action.id)}
                onChange={() => toggleHiddenAction(action.id)}
              />
              <span>{action.label}</span>
            </label>
          ))}
          <button
            type="button"
            className="customize-reset"
            onClick={() => onPatchChrome?.({ topBarHiddenActions: [] })}
          >
            Show all
          </button>
        </div>
      ) : null}
    </>
  )
}
