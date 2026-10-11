import { createContext, useContext, type ReactNode } from 'react'

const WorkspacePanelContext = createContext(false)
export function WorkspaceEmbeddedPanel({ children }: { children: ReactNode }) {
  return <WorkspacePanelContext.Provider value>{children}</WorkspacePanelContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components -- Consumer shares the private context.
export function useWorkspaceEmbeddedPanel() { return useContext(WorkspacePanelContext) }
export function WorkspaceNestedPanels({ children }: { children: ReactNode }) {
  return <WorkspacePanelContext.Provider value={false}>{children}</WorkspacePanelContext.Provider>
}
