import { useCallback, useMemo, useState } from 'react'
import type { PaletteCommand } from '../components/CommandPalette'

export function useSourceFileWorkspace(vaultId: string | null) {
  const [selection, setSelection] = useState<{ vaultId: string; path: string | null } | null>(null)
  const open = useCallback((path: string | null) => { if (vaultId) setSelection({ vaultId, path }) }, [vaultId])
  const close = useCallback(() => setSelection(null), [])
  const commands = useMemo<PaletteCommand[]>(() => vaultId ? [{
    id: 'open-source-file-editor', label: 'Source file editor', category: 'Workspace',
    keywords: ['latex', 'tex', 'python', 'code', 'file', 'Overleaf'], run: () => open(null),
  }] : [], [open, vaultId])
  return { selection: selection?.vaultId === vaultId ? selection : null, open, close, commands }
}
