import { useEffect, useState } from 'react'
import { MarkdownPreview } from '@scriptor/renderer'
import { vaultReadNote } from '../../bridge/commands/vault'
import { useI18n } from '../../lib/i18n'
import { workspaceCopy } from '../../lib/workspaceCopy'

interface PreviewSnapshot {
  identity: string
  markdown: string | null
  failed: boolean
}

/**
 * A side preview must not display the previous vault's or path's Markdown
 * while its replacement read is in flight. Key the loaded snapshot to the
 * requested identity rather than resetting state after the first paint.
 */
export function WorkspaceNotePreview({ path, vaultId, onOpen, liveMarkdown }: { path: string; vaultId: string; onOpen: () => void; liveMarkdown?: string }) {
  const { locale } = useI18n()
  const copy = workspaceCopy(locale)
  const identity = JSON.stringify([vaultId, path])
  const isLive = liveMarkdown !== undefined
  const [snapshot, setSnapshot] = useState<PreviewSnapshot>({
    identity,
    markdown: null,
    failed: false,
  })

  useEffect(() => {
    if (isLive) {
      // A live editor draft takes precedence over an older disk snapshot.
      // Invalidate the snapshot so switching away triggers a fresh read.
      setSnapshot({ identity: '', markdown: null, failed: false })
      return
    }
    let current = true
    void vaultReadNote(path).then(note => {
      if (!current) return
      if (note.metadata.vault_id !== vaultId || note.metadata.path !== path) {
        setSnapshot({ identity, markdown: null, failed: true })
        return
      }
      setSnapshot({ identity, markdown: note.markdown, failed: false })
    }, () => {
      if (current) setSnapshot({ identity, markdown: null, failed: true })
    })
    return () => { current = false }
  }, [path, vaultId, identity, isLive])

  const active = isLive
    ? { identity, markdown: liveMarkdown, failed: false }
    : snapshot.identity === identity ? snapshot : null
  return (
    <section aria-label={`${copy.preview}: ${path}`} className="workspace-note-preview">
      <header><h2>{path}</h2><button type="button" onClick={onOpen}>{copy.edit}</button></header>
      {active?.failed
        ? <p role="alert">{copy.failed}</p>
        : active?.markdown == null
          ? <p role="status">…</p>
          : <MarkdownPreview markdown={active.markdown} />}
    </section>
  )
}
