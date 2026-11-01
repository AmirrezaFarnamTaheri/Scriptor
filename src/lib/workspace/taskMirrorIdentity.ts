/** A pure preflight; the native provider broker still owns authorization. */
export interface TaskIdentityNote {
  readonly path: string
  readonly tasks: readonly { readonly text: string }[]
}

/**
 * Same-title tasks are assigned stable IDs by occurrence order in the Rust
 * indexer. Reordering them makes ownership ambiguous even when the IDs remain
 * distinct, so do not submit Google Tasks mutations before explicit review.
 */
export function assertUnambiguousTaskTitles(notes: readonly TaskIdentityNote[]): void {
  const titlesByPath = new Map<string, Set<string>>()
  for (const note of notes) {
    if (typeof note.path !== 'string' || !note.path.trim() || !Array.isArray(note.tasks)) {
      throw new Error('Invalid local task source. Review the note before syncing Google Tasks.')
    }
    let titles = titlesByPath.get(note.path)
    if (!titles) {
      titles = new Set<string>()
      titlesByPath.set(note.path, titles)
    }
    for (const task of note.tasks) {
      if (typeof task.text !== 'string') {
        throw new Error('Invalid local task title. Review the note before syncing Google Tasks.')
      }
      // Match the indexer's whitespace-collapse identity, without folding case.
      const identity = task.text.trim().replace(/\s+/gu, ' ')
      if (titles.has(identity)) {
        throw new Error('Indistinguishable duplicate task titles in one note. Give these tasks distinct titles and review their Google Tasks ownership before syncing.')
      }
      titles.add(identity)
    }
  }
}
