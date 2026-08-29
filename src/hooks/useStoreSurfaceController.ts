import { useCallback, useMemo } from 'react'

import type { FeatureFlagEntry } from '../components/StorePanel'
import type { WorkspaceLayout } from './useWorkspaceLayout'
import type { WorkspaceMode } from './useWorkspaceMode'
import { LAYOUT_PRESETS, type LayoutPreset } from '../lib/workspace/layoutPresets'
import type { McpAuditRecord, McpMode, McpToolDescriptor } from '@scriptor/core/contracts/mcp'

interface StoreSurfaceControllerOptions {
  workspaceMode: WorkspaceMode
  currentLayout: WorkspaceLayout
  applyLayout: (mode: WorkspaceMode, layout: Partial<WorkspaceLayout>) => void
  setSplitPreview: (updater: (current: boolean) => boolean) => void
  setStickiesVisible: (visible: boolean) => void
  setGraphDepth: (depth: number) => void
  setDistractionFree: (enabled: boolean) => void
  hibernation: Record<'graph' | 'mcp' | 'watcher' | 'git' | 'spellcheck', boolean>
  setHibernation: Record<'graph' | 'mcp' | 'watcher' | 'git' | 'spellcheck', (value: boolean) => void>
  mcp: { mode: McpMode; tools: McpToolDescriptor[]; audit: McpAuditRecord[]; setMode: (mode: McpMode) => void }
}

type RuntimeFeatureKey = keyof StoreSurfaceControllerOptions['hibernation']
type RuntimeFeatureCopy = Pick<FeatureFlagEntry, 'label' | 'description'> & { key: RuntimeFeatureKey }

const FEATURE_COPY: RuntimeFeatureCopy[] = [
  { key: 'graph', label: 'Graph background services', description: 'Maintain graph indexing and layout services while the workspace is open.' },
  { key: 'mcp', label: 'MCP runtime', description: 'Keep local automation tools available for approved requests.' },
  { key: 'watcher', label: 'Vault file watcher', description: 'Watch the open vault for external filesystem changes.' },
  { key: 'git', label: 'Git status polling', description: 'Refresh repository status in the background.' },
  { key: 'spellcheck', label: 'Writing assistance', description: 'Run spellcheck and configured language assistance while editing.' },
]

export function useStoreSurfaceController(options: StoreSurfaceControllerOptions) {
  const {
    currentLayout, hibernation, setHibernation, applyLayout, workspaceMode,
    setSplitPreview, setStickiesVisible, setGraphDepth, setDistractionFree,
  } = options
  const { splitPreview, showStickies, graphDepth, distractionFree } = currentLayout
  const { graph, mcp, watcher, git, spellcheck } = hibernation
  const {
    graph: setGraphHibernation, mcp: setMcpHibernation, watcher: setWatcherHibernation,
    git: setGitHibernation, spellcheck: setSpellcheckHibernation,
  } = setHibernation
  const hibernationValues = useMemo(
    () => ({ graph, mcp, watcher, git, spellcheck }),
    [git, graph, mcp, spellcheck, watcher],
  )
  const featureFlags = useMemo<FeatureFlagEntry[]>(
    () => FEATURE_COPY.map((feature) => ({
      ...feature,
      enabled: !hibernationValues[feature.key],
    })),
    [hibernationValues],
  )

  const toggleFeature = useCallback(
    (key: string, enabled: boolean) => {
      if (key === 'graph') setGraphHibernation(!enabled)
      else if (key === 'mcp') setMcpHibernation(!enabled)
      else if (key === 'watcher') setWatcherHibernation(!enabled)
      else if (key === 'git') setGitHibernation(!enabled)
      else if (key === 'spellcheck') setSpellcheckHibernation(!enabled)
    },
    [setGitHibernation, setGraphHibernation, setMcpHibernation, setSpellcheckHibernation, setWatcherHibernation],
  )

  const activeLayoutPresetId = useMemo(
    () => LAYOUT_PRESETS.find((preset) =>
      preset.layout.splitPreview === splitPreview &&
      preset.layout.showStickies === showStickies &&
      preset.layout.graphDepth === graphDepth &&
      preset.layout.distractionFree === distractionFree,
    )?.id ?? null,
    [distractionFree, graphDepth, showStickies, splitPreview],
  )

  const applyLayoutPreset = useCallback(
    (preset: LayoutPreset) => {
      applyLayout(workspaceMode, preset.layout)
      setSplitPreview(() => preset.layout.splitPreview)
      setStickiesVisible(preset.layout.showStickies)
      setGraphDepth(preset.layout.graphDepth)
      setDistractionFree(preset.layout.distractionFree)
    },
    [applyLayout, setDistractionFree, setGraphDepth, setSplitPreview, setStickiesVisible, workspaceMode],
  )
  const inspectorProps = useMemo(() => ({
    mcpMode: options.mcp.mode,
    mcpTools: options.mcp.tools,
    mcpAuditLog: options.mcp.audit,
    onSetMcpMode: options.mcp.setMode,
    featureFlags,
    onToggleFeature: toggleFeature,
    activeLayoutPresetId,
    onApplyLayoutPreset: applyLayoutPreset,
  }), [activeLayoutPresetId, applyLayoutPreset, featureFlags, options.mcp.audit, options.mcp.mode, options.mcp.setMode, options.mcp.tools, toggleFeature])

  return {
    featureFlags,
    toggleFeature,
    activeLayoutPresetId,
    applyLayoutPreset,
    inspectorProps,
  }
}
