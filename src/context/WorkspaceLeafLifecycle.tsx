import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import type { WorkspaceLeafCloseGuard, WorkspaceLeafLifecycle } from './leaf-lifecycle'
// eslint-disable-next-line react-refresh/only-export-components -- Shared lifecycle API belongs with its provider.
export { createWorkspaceLeafLifecycle } from './leaf-lifecycle'
export type { WorkspaceLeafCloseGuard, WorkspaceLeafLifecycle } from './leaf-lifecycle'

interface LeafContext {
  registerGuard: (guard: WorkspaceLeafCloseGuard) => () => void
  reveal: () => void
}
const WorkspaceLeafLifecycleContext = createContext<LeafContext | null>(null)
const noReveal = () => {}

export function WorkspaceLeafLifecycleProvider({ lifecycle, leafId, onReveal = noReveal, children }: {
  lifecycle: WorkspaceLeafLifecycle
  leafId: string
  onReveal?: () => void
  children: ReactNode
}) {
  const revealRef = useRef(onReveal)
  useLayoutEffect(() => { revealRef.current = onReveal }, [onReveal])
  const value = useMemo<LeafContext>(() => ({
    registerGuard: guard => lifecycle.registerGuard(leafId, guard),
    reveal: () => revealRef.current(),
  }), [lifecycle, leafId])
  return <WorkspaceLeafLifecycleContext.Provider value={value}>{children}</WorkspaceLeafLifecycleContext.Provider>
}

/** Stable registration reads the latest owner callback without losing pending decisions. */
// eslint-disable-next-line react-refresh/only-export-components -- Context consumer hook shares the private context.
export function useWorkspaceLeafCloseGuard(guard: WorkspaceLeafCloseGuard): void {
  const context = useContext(WorkspaceLeafLifecycleContext)
  const current = useRef(guard)
  useLayoutEffect(() => { current.current = guard }, [guard])
  useLayoutEffect(() => context?.registerGuard(() => current.current()), [context])
}

// eslint-disable-next-line react-refresh/only-export-components -- Context consumer hook shares the private context.
export function useWorkspaceLeafReveal(): () => void {
  return useContext(WorkspaceLeafLifecycleContext)?.reveal ?? noReveal
}
