import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { savePluginState, loadPluginState } from '../bridge/plugin.ts'
import { DEFAULT_ENABLED_PLUGINS } from './plugin-defaults.ts'
export { DEFAULT_ENABLED_PLUGINS }

export interface PluginStateContextType {
  enabledPluginIds: Set<string>
  enablePlugin: (id: string) => void
  disablePlugin: (id: string) => void
  isPluginEnabled: (id: string) => boolean
}

export const PluginStateContext = createContext<PluginStateContextType | undefined>(undefined)

export interface PluginStateProviderProps {
  children?: React.ReactNode
  initialEnabledPluginIds?: Set<string>
}

export function PluginStateProvider({ children, initialEnabledPluginIds }: PluginStateProviderProps) {
  const [enabledPluginIds, setEnabledPluginIds] = useState<Set<string>>(
    () => new Set(initialEnabledPluginIds ?? DEFAULT_ENABLED_PLUGINS)
  )

  useEffect(() => {
    if (!initialEnabledPluginIds) {
      loadPluginState().then((loaded) => {
        if (loaded && loaded.size > 0) {
          setEnabledPluginIds(loaded)
        }
      }).catch(() => {})
    }
  }, [initialEnabledPluginIds])

  const enablePlugin = useCallback((id: string) => {
    setEnabledPluginIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      savePluginState(next).catch(() => {})
      return next
    })
  }, [])

  const disablePlugin = useCallback((id: string) => {
    setEnabledPluginIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      savePluginState(next).catch(() => {})
      return next
    })
  }, [])

  const isPluginEnabled = useCallback(
    (id: string) => enabledPluginIds.has(id),
    [enabledPluginIds]
  )

  const value = useMemo(
    () => ({
      enabledPluginIds,
      enablePlugin,
      disablePlugin,
      isPluginEnabled,
    }),
    [enabledPluginIds, enablePlugin, disablePlugin, isPluginEnabled]
  )

  return React.createElement(PluginStateContext.Provider, { value }, children)
}

export function usePluginState(): PluginStateContextType {
  const context = useContext(PluginStateContext)
  if (!context) {
    throw new Error('usePluginState must be used within a PluginStateProvider')
  }
  return context
}
