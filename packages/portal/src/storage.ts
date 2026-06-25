import { createDefaultPortalStore, createDefaultQuickCaptureStore } from './defaults.ts'
import type { PortalStore, QuickCaptureStore, WorkspaceBundle } from './types.ts'

const GLOBAL_STORAGE_KEY = 'scriptor:workspace'

export function createWorkspaceBundle(): WorkspaceBundle {
  return {
    version: 1,
    portal: createDefaultPortalStore(),
    quickCapture: createDefaultQuickCaptureStore(),
  }
}

function mergePortalStore(parsed: Partial<PortalStore> | undefined): PortalStore {
  const defaults = createDefaultPortalStore()
  if (!parsed || parsed.version !== 1) return defaults
  return {
    version: 1,
    categories: parsed.categories?.length ? parsed.categories : defaults.categories,
    items: parsed.items ?? defaults.items,
  }
}

function mergeQuickCaptureStore(parsed: Partial<QuickCaptureStore> | undefined): QuickCaptureStore {
  const defaults = createDefaultQuickCaptureStore()
  if (!parsed || parsed.version !== 1) return defaults
  return {
    version: 1,
    stickies: parsed.stickies ?? defaults.stickies,
    todos: parsed.todos ?? defaults.todos,
    scratchpad: parsed.scratchpad ?? defaults.scratchpad,
  }
}

export function parseWorkspaceBundle(raw: string | null | undefined): WorkspaceBundle {
  if (!raw?.trim()) return createWorkspaceBundle()
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceBundle>
    if (parsed.version !== 1) return createWorkspaceBundle()
    return {
      version: 1,
      portal: mergePortalStore(parsed.portal),
      quickCapture: mergeQuickCaptureStore(parsed.quickCapture),
    }
  } catch {
    return createWorkspaceBundle()
  }
}

export function serializeWorkspaceBundle(bundle: WorkspaceBundle): string {
  return JSON.stringify(bundle, null, 2)
}

export function loadGlobalWorkspace(): WorkspaceBundle {
  if (typeof localStorage === 'undefined') return createWorkspaceBundle()
  return parseWorkspaceBundle(localStorage.getItem(GLOBAL_STORAGE_KEY))
}

export function saveGlobalWorkspace(bundle: WorkspaceBundle): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(GLOBAL_STORAGE_KEY, serializeWorkspaceBundle(bundle))
}

export const VAULT_WORKSPACE_PATH = '.scriptor/workspace.json'
