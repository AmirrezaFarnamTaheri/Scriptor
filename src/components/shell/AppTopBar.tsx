import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  SlidersHorizontal,
  Store,
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
import type { TopBarGroupId, WorkspaceChromePrefs } from '../../hooks/useWorkspaceChrome'

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

const DEFAULT_TOP_BAR_GROUP_ORDER: TopBarGroupId[] = ['history', 'modes', 'command', 'actions']

const TOP_BAR_GROUP_LABEL_KEYS: Record<TopBarGroupId, string> = {
  history: 'topBar.groupVaultAndHistory',
  modes: 'topBar.groupWorkspaceModes',
  command: 'topBar.groupCommandSearch',
  actions: 'topBar.groupActionButtons',
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
    [chrome],
  )
  const hiddenTopBarGroups = useMemo(
    () => new Set<TopBarGroupId>(chrome?.topBarHiddenGroups ?? []),
    [chrome],
  )
  const topBarGroupOrder = useMemo(
    () => chrome?.topBarGroupOrder ?? DEFAULT_TOP_BAR_GROUP_ORDER,
    [chrome?.topBarGroupOrder],
  )
  const groupOrder = (id: TopBarGroupId) => Math.max(0, topBarGroupOrder.indexOf(id)) + 1
  const groupWidth = (id: TopBarGroupId) => chrome?.topBarGroupWidths?.[id] ?? 'auto'
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [customizePos, setCustomizePos] = useState<{ x: number; y: number } | null>(null)
  const customizeAnchorRef = useRef<HTMLButtonElement | null>(null)
  const customizePopupRef = useRef<HTMLDivElement | null>(null)

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
    ...(onOpenPluginManager
      ? [{ id: 'paletteStore', label: t('topBar.paletteStore'), icon: <Store />, onClick: onOpenPluginManager }]
      : []),
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

  const toggleHiddenGroup = useCallback((id: TopBarGroupId) => {
    const next = new Set(hiddenTopBarGroups)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onPatchChrome?.({ topBarHiddenGroups: Array.from(next) })
  }, [hiddenTopBarGroups, onPatchChrome])

  const moveGroup = useCallback((id: TopBarGroupId, direction: -1 | 1) => {
    const current = [...topBarGroupOrder]
    const index = current.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    const [group] = current.splice(index, 1)
    if (!group) return
    current.splice(target, 0, group)
    onPatchChrome?.({ topBarGroupOrder: current })
  }, [onPatchChrome, topBarGroupOrder])

  const positionCustomize = useCallback(() => {
    const rect = customizeAnchorRef.current?.getBoundingClientRect()
    const popup = customizePopupRef.current?.getBoundingClientRect()
    const width = popup?.width ?? 264
    const height = popup?.height ?? Math.min(420, window.innerHeight * 0.7)
    const anchorRight = rect?.right ?? 272
    const anchorBottom = rect?.bottom ?? 58
    setCustomizePos({
      x: Math.max(8, Math.min(anchorRight - width, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(anchorBottom + 6, window.innerHeight - height - 8)),
    })
  }, [])

  const openCustomize = useCallback(() => {
    positionCustomize()
    setCustomizeOpen((open) => !open)
  }, [positionCustomize])

  useLayoutEffect(() => {
    if (customizeOpen) positionCustomize()
  }, [customizeOpen, positionCustomize])

  useEffect(() => {
    if (!customizeOpen) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('.topbar-customize')) return
      if (target?.closest?.('.topbar')) return
      setCustomizeOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setCustomizeOpen(false)
      customizeAnchorRef.current?.focus()
    }
    const onViewportChange = () => positionCustomize()
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [customizeOpen, positionCustomize])

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

  const showHistory = chrome?.showHistoryControls !== false && !hiddenTopBarGroups.has('history')
  const showModeStrip = chrome?.showModeStrip !== false && !hiddenTopBarGroups.has('modes')
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
          <div className={`history-controls toolbar-group width-${groupWidth('history')}`} style={{ order: groupOrder('history') }} aria-label="History controls">
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
          <div className={`workspace-mode-strip toolbar-group width-${groupWidth('modes')}`} style={{ order: groupOrder('modes') }} aria-label="Workspace mode">
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
        {!hiddenTopBarGroups.has('command') ? <button
          type="button"
          className={`command-search toolbar-group width-${groupWidth('command')}`}
          style={{ order: groupOrder('command') }}
          onClick={onOpenCommandPalette}
          aria-label={`Open command palette (${commandShortcut})`}
        >
          <Command aria-hidden="true" />
          <span className="command-search-placeholder">{t('topBar.typeCommandOrSearch')}</span>
          <kbd className="kbd" aria-hidden="true">{commandShortcut}</kbd>
        </button> : null}

        {!hiddenTopBarGroups.has('actions') ? <div className={`top-actions toolbar-group width-${groupWidth('actions')} rows-${chrome?.topBarActionRows ?? 1}`} style={{ order: groupOrder('actions') }} data-workspace-mode={workspaceMode}>
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
            <IconButton className="support-heart-action" label={t('topBar.supportScriptor')} onClick={onOpenSupport}>
              <Heart fill="currentColor" />
            </IconButton>
          ) : null}
          {onOpenPluginManager && !hiddenTopBarActions.has('paletteStore') ? (
            <IconButton label={t('topBar.paletteStore')} onClick={onOpenPluginManager}>
              <Store />
            </IconButton>
          ) : null}
          <IconButton label={t('topBar.settings')} onClick={onOpenSettings}>
            <Settings />
          </IconButton>
          <button
            type="button"
            ref={customizeAnchorRef}
            className={`status-button${customizeOpen ? ' emphasized' : ''}`}
            aria-label={t('topBar.customizeAria')}
            aria-expanded={customizeOpen}
            onClick={openCustomize}
          >
            <SlidersHorizontal />
          </button>
        </div> : null}
      </header>
      {customizeOpen && customizePos ? (
        <div
          className="topbar-customize"
          ref={customizePopupRef}
          role="dialog"
          aria-label={t('topBar.customizeAria')}
          style={{ left: customizePos.x, top: customizePos.y }}
        >
          <strong>{t('topBar.customizeToolbar')}</strong>
          {(['history', 'modes', 'command', 'actions'] as const).map((group) => (
            <div className="toolbar-group-settings" key={group}>
              <label>
                <input type="checkbox" checked={!hiddenTopBarGroups.has(group)} onChange={() => toggleHiddenGroup(group)} />
                <span>{t(TOP_BAR_GROUP_LABEL_KEYS[group])}</span>
              </label>
              <select aria-label={t('topBar.groupWidthAria', { group: t(TOP_BAR_GROUP_LABEL_KEYS[group]) })} value={groupWidth(group)} onChange={(event) => onPatchChrome?.({ topBarGroupWidths: { ...chrome?.topBarGroupWidths, [group]: event.target.value as 'compact' | 'auto' | 'wide' } })}>
                <option value="compact">{t('topBar.widthCompact')}</option><option value="auto">{t('topBar.widthAuto')}</option><option value="wide">{t('topBar.widthWide')}</option>
              </select>
              <button type="button" onClick={() => moveGroup(group, -1)} aria-label={t('topBar.moveGroupLeftAria', { group: t(TOP_BAR_GROUP_LABEL_KEYS[group]) })}>←</button>
              <button type="button" onClick={() => moveGroup(group, 1)} aria-label={t('topBar.moveGroupRightAria', { group: t(TOP_BAR_GROUP_LABEL_KEYS[group]) })}>→</button>
            </div>
          ))}
          <label>
            <span>{t('topBar.actionRows')}</span>
            <select aria-label={t('topBar.actionRows')} value={chrome?.topBarActionRows ?? 1} onChange={(event) => onPatchChrome?.({ topBarActionRows: Number(event.target.value) as 1 | 2 })}>
              <option value={1}>{t('topBar.actionRowsOne')}</option><option value={2}>{t('topBar.actionRowsTwo')}</option>
            </select>
          </label>
          <strong>{t('topBar.itemsInActionGroup')}</strong>
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
            onClick={() => onPatchChrome?.({ topBarHiddenActions: [], topBarHiddenGroups: [], topBarGroupOrder: DEFAULT_TOP_BAR_GROUP_ORDER, topBarGroupWidths: {}, topBarActionRows: 1 })}
          >
            {t('topBar.customizeShowAll')}
          </button>
        </div>
      ) : null}
    </>
  )
}
