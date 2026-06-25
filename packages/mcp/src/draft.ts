export type DraftPatchStatus = 'pending' | 'approved' | 'rejected'
export type DraftOperation = 'patch' | 'create' | 'move' | 'delete'

export interface DraftPatch {
  id: string
  notePath: string
  sourcePath?: string
  operation: DraftOperation
  baseContentHash?: string
  proposedMarkdown: string
  summary: string
  createdAt: string
  status: DraftPatchStatus
}

export interface DraftPatchQueue {
  patches: DraftPatch[]
}

export function createDraftPatch(input: {
  notePath: string
  proposedMarkdown: string
  summary: string
  baseContentHash?: string
  operation?: DraftOperation
  sourcePath?: string
}): DraftPatch {
  return {
    id: `draft-${crypto.randomUUID()}`,
    notePath: input.notePath,
    sourcePath: input.sourcePath,
    operation: input.operation ?? 'patch',
    baseContentHash: input.baseContentHash,
    proposedMarkdown: input.proposedMarkdown,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
}

export function approveDraftPatch(patch: DraftPatch): DraftPatch {
  return { ...patch, status: 'approved' }
}

export function rejectDraftPatch(patch: DraftPatch): DraftPatch {
  return { ...patch, status: 'rejected' }
}

export function runDraftTests(): string[] {
  const failures: string[] = []
  const patch = createDraftPatch({
    notePath: 'note.md',
    proposedMarkdown: '# Updated',
    summary: 'Title tweak',
  })

  if (patch.status !== 'pending') failures.push('draft starts pending')
  if (patch.operation !== 'patch') failures.push('default operation is patch')
  if (approveDraftPatch(patch).status !== 'approved') failures.push('draft approve')
  if (rejectDraftPatch(patch).status !== 'rejected') failures.push('draft reject')

  const createDraft = createDraftPatch({
    notePath: 'new.md',
    proposedMarkdown: '# New',
    summary: 'Create note',
    operation: 'create',
  })
  if (createDraft.operation !== 'create') failures.push('create operation')

  const moveDraft = createDraftPatch({
    notePath: 'to.md',
    sourcePath: 'from.md',
    proposedMarkdown: '# Moved',
    summary: 'Move note',
    operation: 'move',
    baseContentHash: 'abc',
  })
  if (moveDraft.operation !== 'move' || moveDraft.sourcePath !== 'from.md') failures.push('move operation')

  const deleteDraft = createDraftPatch({
    notePath: 'gone.md',
    proposedMarkdown: '',
    summary: 'Delete note',
    operation: 'delete',
  })
  if (deleteDraft.operation !== 'delete') failures.push('delete operation')

  return failures
}
