import { useCallback, useMemo } from 'react'

import { isMarkdownFile } from '../lib/importVaultFiles'
import { isReaderDocumentPath } from './vault/helpers'

interface UseVaultSidebarActionsOptions {
  nativeReady: boolean
  chooseVaultFolder: () => Promise<unknown> | unknown
  createNote: () => Promise<unknown> | unknown
  createNoteOfType: (typeName: string) => Promise<unknown> | unknown
  createNoteFromTemplate: (templatePath: string) => Promise<unknown> | unknown
  rebuildIndex: () => Promise<unknown> | unknown
  createDailyNote: () => Promise<unknown> | unknown
  createDailyNoteForOffset: (offset: number) => Promise<unknown> | unknown
  organizeNote: (path: string) => Promise<unknown> | unknown
  openNote: (path: string) => Promise<unknown> | unknown
  openReaderDocument: (path: string) => void
  refreshVault: () => Promise<unknown> | unknown
  importDroppedFiles: (
    files: FileList,
    options: { filter: (file: File) => boolean },
  ) => Promise<string[]>
  deleteNote: (path: string) => Promise<unknown> | unknown
  openKnowledgeWorkbench: (tab: 'tags' | 'repair' | 'views') => void
  openSnippets: () => void
  openSettings: () => void
  openRename: (path: string) => void
  showToast: (message: string) => void
}

/** Provides stable callbacks for the memoized vault sidebar surface. */
export function useVaultSidebarActions({
  nativeReady,
  chooseVaultFolder,
  createNote,
  createNoteOfType,
  createNoteFromTemplate,
  rebuildIndex,
  createDailyNote,
  createDailyNoteForOffset,
  organizeNote,
  openNote,
  openReaderDocument,
  refreshVault,
  importDroppedFiles,
  deleteNote,
  openKnowledgeWorkbench,
  openSnippets,
  openSettings,
  openRename,
  showToast,
}: UseVaultSidebarActionsOptions) {
  const handleChooseVault = useCallback(() => void chooseVaultFolder(), [chooseVaultFolder])
  const handleCreateNote = useCallback(() => void createNote(), [createNote])
  const handleCreateNoteOfType = useCallback(
    (typeName: string) => void createNoteOfType(typeName),
    [createNoteOfType],
  )
  const handleCreateNoteFromTemplate = useCallback(
    (templatePath: string) => void createNoteFromTemplate(templatePath),
    [createNoteFromTemplate],
  )
  const handleRebuildIndex = useCallback(() => void rebuildIndex(), [rebuildIndex])
  const handleOpenTags = useCallback(() => openKnowledgeWorkbench('tags'), [openKnowledgeWorkbench])
  const handleOpenFilters = useCallback(
    () => openKnowledgeWorkbench('repair'),
    [openKnowledgeWorkbench],
  )
  const handleOpenSavedViews = useCallback(
    () => openKnowledgeWorkbench('views'),
    [openKnowledgeWorkbench],
  )
  const handleOpenSnippets = useCallback(() => openSnippets(), [openSnippets])
  const handleOpenSettings = useCallback(() => openSettings(), [openSettings])
  const handleCreateDailyNote = useCallback(() => void createDailyNote(), [createDailyNote])
  const handleCreateDailyNoteOffset = useCallback(
    (offset: number) => void createDailyNoteForOffset(offset),
    [createDailyNoteForOffset],
  )
  const handleOrganizeNote = useCallback((path: string) => void organizeNote(path), [organizeNote])
  const handleOpenNote = useCallback((path: string) => {
    if (isReaderDocumentPath(path)) {
      openReaderDocument(path)
      return
    }
    void openNote(path)
  }, [openNote, openReaderDocument])
  const handleRenameNote = useCallback((path: string) => openRename(path), [openRename])
  const handleDeleteNote = useCallback((path: string) => void deleteNote(path), [deleteNote])
  const handleImportFiles = useCallback(
    async (files: FileList) => {
      const paths = await importDroppedFiles(files, { filter: isMarkdownFile })
      if (paths.length > 0) {
        showToast(`Imported ${paths.length} note${paths.length === 1 ? '' : 's'}`)
        void refreshVault()
      }
      return paths
    },
    [importDroppedFiles, refreshVault, showToast],
  )

  return useMemo(
    () => ({
      handleChooseVault,
      handleCreateNote,
      handleCreateNoteOfType,
      handleCreateNoteFromTemplate,
      handleRebuildIndex,
      handleOpenTags,
      handleOpenFilters,
      handleOpenSavedViews,
      handleOpenSnippets,
      handleOpenSettings,
      handleCreateDailyNote,
      handleCreateDailyNoteOffset,
      handleOrganizeNote,
      handleOpenNote,
      handleRenameNote,
      handleDeleteNote: nativeReady ? handleDeleteNote : undefined,
      handleImportFiles: nativeReady ? handleImportFiles : undefined,
    }),
    [
      handleChooseVault,
      handleCreateDailyNote,
      handleCreateDailyNoteOffset,
      handleCreateNote,
      handleCreateNoteFromTemplate,
      handleCreateNoteOfType,
      handleDeleteNote,
      handleImportFiles,
      handleOpenFilters,
      handleOpenNote,
      handleOpenSavedViews,
      handleOpenSettings,
      handleOpenSnippets,
      handleOpenTags,
      handleOrganizeNote,
      handleRebuildIndex,
      handleRenameNote,
      nativeReady,
    ],
  )
}
