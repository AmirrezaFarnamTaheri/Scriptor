/** Portal item action when invoked via shortcut or click. */
export type PortalAction = 'copy' | 'insert' | 'open-note'

export interface PortalCategory {
  id: string
  label: string
  icon?: string
  sort: number
}

export interface PortalItem {
  id: string
  categoryId: string
  title: string
  body: string
  action: PortalAction
  /** e.g. `mod+shift+1` or `ctrl+alt+p` */
  shortcut?: string | null
  pinned?: boolean
  createdAt: string
  updatedAt: string
}

export interface PortalStore {
  version: 1
  categories: PortalCategory[]
  items: PortalItem[]
}

export type QuickNoteKind = 'sticky' | 'scratchpad' | 'todo'

export interface QuickStickyNote {
  id: string
  kind: 'sticky'
  title: string
  body: string
  color: string
  x: number
  y: number
  width: number
  height: number
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface QuickTodoItem {
  id: string
  kind: 'todo'
  text: string
  done: boolean
  notePath?: string | null
  createdAt: string
  updatedAt: string
}

export interface ScratchpadState {
  kind: 'scratchpad'
  body: string
  updatedAt: string
}

export interface QuickCaptureStore {
  version: 1
  stickies: QuickStickyNote[]
  todos: QuickTodoItem[]
  scratchpad: ScratchpadState
}

export interface WorkspaceBundle {
  version: 1
  portal: PortalStore
  quickCapture: QuickCaptureStore
}
