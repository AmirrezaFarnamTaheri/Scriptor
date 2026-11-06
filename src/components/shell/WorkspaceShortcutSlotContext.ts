import { createContext, type ReactNode } from 'react'

/** Workspace navigation lives beside the note tabs in Writing, not in a third
 * global row. The surrounding dock owns the actions; the editor only renders
 * this slot and keeps the usual note-tab semantics. */
export const WorkspaceShortcutSlotContext = createContext<ReactNode>(null)
