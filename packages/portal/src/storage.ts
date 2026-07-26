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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPortalCategory(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.sort === 'number'
  )
}

function isPortalItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    typeof value.action === 'string'
  )
}

function isSticky(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.body === 'string'
  )
}

function isTodo(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.text === 'string'
}

/** Optional array field: absent is fine, present-but-malformed is corrupt. */
function checkOptionalArray(value: unknown, isElement: (entry: unknown) => boolean): boolean {
  if (value === undefined) return true
  return Array.isArray(value) && value.every(isElement)
}

function isValidPortalStore(parsed: Partial<PortalStore> | undefined): boolean {
  if (parsed === undefined) return true
  if (!isRecord(parsed) || parsed.version !== 1) return false
  return (
    checkOptionalArray(parsed.categories, isPortalCategory) &&
    checkOptionalArray(parsed.items, isPortalItem)
  )
}

function isValidQuickCaptureStore(parsed: Partial<QuickCaptureStore> | undefined): boolean {
  if (parsed === undefined) return true
  if (!isRecord(parsed) || parsed.version !== 1) return false
  if (!checkOptionalArray(parsed.stickies, isSticky)) return false
  if (!checkOptionalArray(parsed.todos, isTodo)) return false
  if (parsed.scratchpad !== undefined) {
    if (!isRecord(parsed.scratchpad) || typeof parsed.scratchpad.body !== 'string') return false
  }
  return true
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

export interface ParseWorkspaceBundleOptions {
  /** Called with the raw payload when it fails to parse or validate. */
  onCorrupt?: (raw: string) => void
}

export function parseWorkspaceBundle(
  raw: string | null | undefined,
  options: ParseWorkspaceBundleOptions = {},
): WorkspaceBundle {
  if (!raw?.trim()) return createWorkspaceBundle()
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceBundle>
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isValidPortalStore(parsed.portal) ||
      !isValidQuickCaptureStore(parsed.quickCapture)
    ) {
      options.onCorrupt?.(raw)
      return createWorkspaceBundle()
    }
    return {
      version: 1,
      portal: mergePortalStore(parsed.portal),
      quickCapture: mergeQuickCaptureStore(parsed.quickCapture),
    }
  } catch {
    options.onCorrupt?.(raw)
    return createWorkspaceBundle()
  }
}

export function serializeWorkspaceBundle(bundle: WorkspaceBundle): string {
  return JSON.stringify(bundle, null, 2)
}

export function loadGlobalWorkspace(): WorkspaceBundle {
  if (typeof localStorage === 'undefined') return createWorkspaceBundle()
  return parseWorkspaceBundle(localStorage.getItem(GLOBAL_STORAGE_KEY), {
    onCorrupt: (raw) => {
      // Preserve the unreadable payload instead of silently discarding user
      // state, so it can be recovered or inspected later.
      try {
        localStorage.setItem(`${GLOBAL_STORAGE_KEY}:corrupt`, raw)
      } catch {
        // Best effort: quota or storage errors must not block loading defaults.
      }
    },
  })
}

export function saveGlobalWorkspace(bundle: WorkspaceBundle): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(GLOBAL_STORAGE_KEY, serializeWorkspaceBundle(bundle))
}

export const VAULT_WORKSPACE_PATH = '.scriptor/workspace.json'
