import { useState, useCallback } from 'react'
import { readInspectorPreset, writeInspectorPreset, type InspectorPreset } from '../lib/inspectorPresets'
import { usePersistedMobilePane } from '../hooks/useWorkspaceMode'

export interface WorkspaceNavigationControllerOptions {
  initialGraphDepth?: number
}

export function useWorkspaceNavigationController(options: WorkspaceNavigationControllerOptions = {}) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [graphDepth, setGraphDepth] = useState(options.initialGraphDepth ?? 2)
  const [graphFullVault, setGraphFullVault] = useState(false)
  const { mobilePane, setMobilePane } = usePersistedMobilePane('editor')
  const [inspectorPreset, setInspectorPresetState] = useState<InspectorPreset>(() => readInspectorPreset())
  const [readerFilePath, setReaderFilePath] = useState<string | null>(null)
  const [pluginManagerOpen, setPluginManagerOpen] = useState(false)
  const [perfHudOpen, setPerfHudOpen] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('scriptor:perf-hud') === 'true',
  )

  const setInspectorPreset = useCallback((preset: InspectorPreset) => {
    setInspectorPresetState(preset)
    writeInspectorPreset(preset)
  }, [])

  const toggleFolder = useCallback((folderPath: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }))
  }, [])

  return {
    collapsedFolders,
    setCollapsedFolders,
    toggleFolder,
    graphDepth,
    setGraphDepth,
    graphFullVault,
    setGraphFullVault,
    mobilePane,
    setMobilePane,
    inspectorPreset,
    setInspectorPreset,
    readerFilePath,
    setReaderFilePath,
    pluginManagerOpen,
    setPluginManagerOpen,
    perfHudOpen,
    setPerfHudOpen,
  }
}
