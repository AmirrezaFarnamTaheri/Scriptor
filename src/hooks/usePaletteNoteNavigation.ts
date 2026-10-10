import { useCallback, useMemo } from 'react'
import { indexerSearch } from '../bridge/commands'

/** Palette search and navigation follow the current vault and note opener. */
export function usePaletteNoteNavigation(vaultOpen: boolean, openNote: (path: string) => Promise<unknown>, close: (open: boolean) => void) {
  const handleCloseCommandPalette = useCallback(() => close(false), [close])
  const handleSearchNotes = useMemo(() => vaultOpen ? (query: string) => indexerSearch(query, 12) : undefined, [vaultOpen])
  const handleOpenNoteFromPalette = useCallback((path: string) => { void openNote(path) }, [openNote])
  return { handleCloseCommandPalette, handleSearchNotes, handleOpenNoteFromPalette }
}
