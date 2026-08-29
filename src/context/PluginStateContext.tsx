import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { savePluginState, loadPluginState } from '../bridge/plugin.ts'
import { DEFAULT_ENABLED_PLUGINS } from './plugin-defaults.ts'
import { createPluginStatePersistenceQueue } from './plugin-state-persistence.ts'


export interface PluginStateContextType {
  enabledPluginIds: Set<string>
  enablePlugin: (id: string) => void
  disablePlugin: (id: string) => void
  replaceEnabledPlugins: (ids: ReadonlySet<string>) => void
  isPluginEnabled: (id: string) => boolean
  persistenceError: string | null
}

// eslint-disable-next-line react-refresh/only-export-components
export const PluginStateContext = createContext<PluginStateContextType | undefined>(undefined)

export interface PluginStateProviderProps {
  children?: React.ReactNode
  initialEnabledPluginIds?: Set<string>
}

export function PluginStateProvider({ children, initialEnabledPluginIds }: PluginStateProviderProps) {
  const [enabledPluginIds, setEnabledPluginIds] = useState<Set<string>>(
    () => new Set(initialEnabledPluginIds ?? DEFAULT_ENABLED_PLUGINS)
  )
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const enabledPluginIdsRef = useRef(enabledPluginIds)
  const localChangeVersionRef = useRef(0)
  const persistenceQueueRef = useRef(createPluginStatePersistenceQueue())

  useEffect(() => {
    enabledPluginIdsRef.current = enabledPluginIds
  }, [enabledPluginIds])

  useEffect(() => {
    if (!initialEnabledPluginIds) {
      const loadVersion = localChangeVersionRef.current
      let cancelled = false
      loadPluginState()
        .catch(() => {
          // The native bridge can briefly lag the first render; retry once
          // before surfacing an error to the user.
          window.setTimeout(() => {
            if (cancelled || localChangeVersionRef.current !== loadVersion) return
            loadPluginState()
              .then((loaded) => {
                if (cancelled || localChangeVersionRef.current !== loadVersion) return
                if (loaded && loaded.size > 0) {
                  enabledPluginIdsRef.current = loaded
                  setEnabledPluginIds(loaded)
                }
              })
              .catch((error: unknown) => {
                if (cancelled) return
                setPersistenceError(error instanceof Error ? error.message : 'Could not load plugin state.')
              })
          }, 2500)
        })
      return () => {
        cancelled = true
      }
    }
  }, [initialEnabledPluginIds])

  const setPluginEnabled = useCallback((id: string, enabled: boolean) => {
    const current = enabledPluginIdsRef.current
    if (current.has(id) === enabled) return

    const next = new Set(current)
    if (enabled) next.add(id)
    else next.delete(id)
    enabledPluginIdsRef.current = next
    localChangeVersionRef.current += 1
    setEnabledPluginIds(next)
    setPersistenceError(null)
    void persistenceQueueRef.current.enqueue(() => savePluginState(next, id)).catch((error: unknown) => {
      setPersistenceError(error instanceof Error ? error.message : 'Could not save plugin state.')
    })
  }, [])

  const enablePlugin = useCallback((id: string) => setPluginEnabled(id, true), [setPluginEnabled])
  const disablePlugin = useCallback((id: string) => setPluginEnabled(id, false), [setPluginEnabled])

  const replaceEnabledPlugins = useCallback((ids: ReadonlySet<string>) => {
    const current = enabledPluginIdsRef.current
    const next = new Set(ids)
    const changedIds = new Set<string>()
    for (const id of current) {
      if (!next.has(id)) changedIds.add(id)
    }
    for (const id of next) {
      if (!current.has(id)) changedIds.add(id)
    }
    if (changedIds.size === 0) return

    enabledPluginIdsRef.current = next
    localChangeVersionRef.current += 1
    setEnabledPluginIds(next)
    setPersistenceError(null)
    void persistenceQueueRef.current.enqueue(async () => {
      const failures: string[] = []
      for (const id of changedIds) {
        try {
          await savePluginState(next, id)
        } catch (error) {
          failures.push(error instanceof Error ? error.message : `Could not save ${id}.`)
        }
      }
      if (failures.length > 0) throw new Error(failures.join(' '))
    }).catch((error: unknown) => {
      setPersistenceError(error instanceof Error ? error.message : 'Could not save plugin profile.')
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
      replaceEnabledPlugins,
      isPluginEnabled,
      persistenceError,
    }),
    [enabledPluginIds, enablePlugin, disablePlugin, replaceEnabledPlugins, isPluginEnabled, persistenceError]
  )

  return React.createElement(PluginStateContext.Provider, { value }, children)
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePluginState(): PluginStateContextType {
  const context = useContext(PluginStateContext)
  if (!context) {
    throw new Error('usePluginState must be used within a PluginStateProvider')
  }
  return context
}
