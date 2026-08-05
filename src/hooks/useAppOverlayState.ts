import { useState } from 'react'

import type { KnowledgeWorkbenchTab } from '../components/KnowledgeWorkbench'
import type { StatusDockTab } from '../components/StatusDockPanel'

export interface RenameTarget {
  path: string
  label: string
}

export function useAppOverlayState(initialStickiesVisible = true) {
  const [activeMode, setActiveMode] = useState<'inspector' | 'preview' | 'plugins'>('inspector')
  const [graphOpen, setGraphOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null)
  const [gitPanelOpen, setGitPanelOpen] = useState(false)
  const [healthDashboardOpen, setHealthDashboardOpen] = useState(false)
  const [statusDockTab, setStatusDockTab] = useState<StatusDockTab>('output')
  const [mcpPanelOpen, setMcpPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [knowledgeWorkbenchOpen, setKnowledgeWorkbenchOpen] = useState(false)
  const [knowledgeWorkbenchTab, setKnowledgeWorkbenchTab] = useState<KnowledgeWorkbenchTab>('repair')
  const [publishCenterOpen, setPublishCenterOpen] = useState(false)
  const [tagRenameTag, setTagRenameTag] = useState<string | null>(null)
  const [sectionRenameTarget, setSectionRenameTarget] = useState<RenameTarget | null>(null)
  const [blockRenameTarget, setBlockRenameTarget] = useState<RenameTarget | null>(null)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [noteHistoryOpen, setNoteHistoryOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const [stickiesVisible, setStickiesVisible] = useState(initialStickiesVisible)
  const [bibliographyOpen, setBibliographyOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [writingTargetsOpen, setWritingTargetsOpen] = useState(false)
  const [conflictPath, setConflictPath] = useState<string | null>(null)
  const [conflictSource, setConflictSource] = useState('')
  const [conflictBasePreview, setConflictBasePreview] = useState<string | null>(null)
  const [frontmatterOpen, setFrontmatterOpen] = useState(false)

  return {
    activeMode,
    bibliographyOpen,
    blockRenameTarget,
    canvasOpen,
    cheatsheetOpen,
    conflictBasePreview,
    conflictPath,
    conflictSource,
    frontmatterOpen,
    gitPanelOpen,
    graphOpen,
    healthDashboardOpen,
    knowledgeWorkbenchOpen,
    knowledgeWorkbenchTab,
    mcpPanelOpen,
    noteHistoryOpen,
    portalOpen,
    publishCenterOpen,
    quickCaptureOpen,
    renameOpen,
    renameTargetPath,
    sectionRenameTarget,
    setActiveMode,
    setBibliographyOpen,
    setBlockRenameTarget,
    setCanvasOpen,
    setCheatsheetOpen,
    setConflictBasePreview,
    setConflictPath,
    setConflictSource,
    setFrontmatterOpen,
    setGitPanelOpen,
    setGraphOpen,
    setHealthDashboardOpen,
    setKnowledgeWorkbenchOpen,
    setKnowledgeWorkbenchTab,
    setMcpPanelOpen,
    setNoteHistoryOpen,
    setPortalOpen,
    setPublishCenterOpen,
    setQuickCaptureOpen,
    setRenameOpen,
    setRenameTargetPath,
    setSectionRenameTarget,
    setSettingsOpen,
    setSnippetsOpen,
    setStatusDockTab,
    setStickiesVisible,
    setSupportOpen,
    setTagRenameTag,
    setTocOpen,
    setWritingTargetsOpen,
    settingsOpen,
    snippetsOpen,
    statusDockTab,
    stickiesVisible,
    supportOpen,
    tagRenameTag,
    tocOpen,
    writingTargetsOpen,
  }
}
