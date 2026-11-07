import { createContext, type ReactNode } from 'react'

/** Workspace navigation is placed beside note tabs when the writing leaf is visible. */
export const WorkspaceHeaderActionsContext = createContext<ReactNode>(null)
