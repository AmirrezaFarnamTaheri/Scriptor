import { useEffect, useState } from 'react'
import { MarkdownPreview } from '@scriptor/renderer'
import { vaultReadNote } from '../../bridge/commands/vault'
import { useI18n } from '../../lib/i18n'
import { workspaceCopy } from '../../lib/workspaceCopy'

export function WorkspaceNotePreview({ path, vaultId, onOpen }: { path: string; vaultId: string; onOpen: () => void }) {
  const { locale } = useI18n()
  const copy = workspaceCopy(locale)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let current = true
    void vaultReadNote(path).then(note => {
      if (!current) return
      if (note.metadata.vault_id !== vaultId || note.metadata.path !== path) { setError(true); return }
      setContent(note.markdown)
    }, () => { if (current) setError(true) })
    return () => { current = false }
  }, [path, vaultId])
  return <section aria-label={`${copy.preview}: ${path}`} className="workspace-note-preview"><header><h2>{path}</h2><button type="button" onClick={onOpen}>{copy.edit}</button></header>
    {error ? <p role="alert">{copy.failed}</p> : content === null ? <p role="status">…</p> : <MarkdownPreview markdown={content} />}
  </section>
}
