import type { DurableCollaborationSession } from './liveCollaborationDurableSession.ts'
import type { CollaborativeEditorSurface } from '@scriptor/editor/collaboration-port'

export interface CollaborationTextEdit {
  from: number
  to: number
  insert: string
}

/**
 * Identify one incremental UTF-16 edit. Editors must never replace the whole
 * document on a remote transaction: doing so destroys local history/selection.
 */
export function singleTextEdit(before: string, after: string): CollaborationTextEdit | null {
  if (before === after) return null
  let from = 0
  const max = Math.min(before.length, after.length)
  while (from < max && before.charCodeAt(from) === after.charCodeAt(from)) from++
  let to = before.length
  let afterTo = after.length
  while (to > from && afterTo > from &&
    before.charCodeAt(to - 1) === after.charCodeAt(afterTo - 1)) {
    to--
    afterTo--
  }
  return { from, to, insert: after.slice(from, afterTo) }
}

/** The renderer adapter owns cursor/history mapping; the coordinator owns text. */
export type CollaborationEditorSurface = CollaborativeEditorSurface

export class CollaborationEditorController {
  private readonly releaseOwner: () => void
  private readonly unsubscribe: () => void
  private busy = false
  private failed = false
  private disposed = false

  constructor(
    private readonly session: DurableCollaborationSession,
    private readonly surface: CollaborationEditorSurface,
  ) {
    if (!session.ready) throw new Error('Collaboration must be recovered before attaching an editor')
    if (surface.getValue() !== session.value) {
      throw new Error('Unreviewed editor draft does not match authenticated canonical text')
    }
    this.releaseOwner = session.claimEditorOwner()
    this.unsubscribe = session.subscribe(value => {
      if (!this.busy && !this.disposed) this.reconcile(value)
    })
  }

  private reconcile(canonical: string): void {
    const edit = singleTextEdit(this.surface.getValue(), canonical)
    if (edit) this.surface.applyRemoteEdit(edit)
  }

  /**
   * The view already contains the optimistic local keystroke. Freeze further
   * edits until the native journal commits that exact Yjs operation. On a
   * failure retain the visible draft AND the same pending native message; only
   * retry or explicit close may follow, never overwrite the draft with replay.
   */
  async localChange(): Promise<void> {
    if (this.disposed) throw new Error('Collaboration editor is detached')
    if (this.busy || this.failed) throw new Error('Pending native write must finish or retry')
    const change = singleTextEdit(this.session.value, this.surface.getValue())
    if (!change) return
    this.busy = true
    this.surface.setReadOnly(true)
    try {
      await this.session.edit(change.from, change.to, change.insert)
      this.reconcile(this.session.value)
    } catch (error) {
      this.failed = true
      throw error
    } finally {
      this.busy = false
      if (!this.failed && !this.disposed) this.surface.setReadOnly(false)
    }
  }

  async retry(): Promise<void> {
    if (this.disposed || !this.failed || this.busy) {
      throw new Error('There is no failed native collaboration write to retry')
    }
    this.busy = true
    try {
      await this.session.retry()
      this.failed = false
      this.reconcile(this.session.value)
      this.surface.setReadOnly(false)
    } finally {
      this.busy = false
    }
  }

  get blocked(): boolean {
    return this.busy || this.failed || this.disposed
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
    this.releaseOwner()
    // Closing the editor does not destroy a recoverable native outbox.
    this.surface.setReadOnly(true)
  }
}
