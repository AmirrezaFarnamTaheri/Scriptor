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


/** A source-bound subset of local/provider task metadata, without credentials. */
export interface SourceOwnedLocalNote {
  readonly tasks: readonly { readonly id: string; readonly text: string }[]
}
export interface SourceOwnedRemoteTask {
  readonly title: string
  readonly notes: string | null
}

/**
 * An exact provider marker identifies a source task, but a note move/rename
 * can change its generated ID. If an orphaned owned provider record shares a
 * title with a currently unbound local task, silently completing the former
 * while creating the latter could mutate the same task twice. Ask for review.
 */
export function assertNoAmbiguousTaskRebindings(
  vaultId: string,
  notes: readonly SourceOwnedLocalNote[],
  remotes: readonly SourceOwnedRemoteTask[],
): void {
  const localTasks = notes.flatMap(note => note.tasks)
  const localIds = new Set(localTasks.map(task => task.id))
  const matchedIds = new Set<string>()
  const staleOwnedTitles = new Set<string>()
  const scopedPrefix = 'Scriptor source: vault:' + encodeURIComponent(vaultId) + ':'
  const legacyPrefix = 'Scriptor source: '
  // A stale source marker is review-only evidence, not a key lookup. Case or
  // Unicode-normalization changes after a move must not silently create and
  // complete different provider tasks for the same human-readable title.
  const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ').toLowerCase().normalize('NFC')
  for (const remote of remotes) {
    let staleOwned = false
    for (const marker of (remote.notes ?? '').split('\n')) {
      if (marker.startsWith(scopedPrefix)) {
        const id = marker.slice(scopedPrefix.length)
        if (localIds.has(id)) matchedIds.add(id)
        else staleOwned = true
      } else if (marker.startsWith(legacyPrefix)) {
        const id = marker.slice(legacyPrefix.length)
        if (localIds.has(id)) matchedIds.add(id)
      }
    }
    if (staleOwned) staleOwnedTitles.add(normalize(remote.title))
  }
  for (const task of localTasks) {
    if (!matchedIds.has(task.id) && staleOwnedTitles.has(normalize(task.text))) {
      throw new Error('Ambiguous moved or renamed task ownership. Review the original Google Task before creating or completing its source identity.')
    }
  }
}
