import { createDraftPatch, type DraftPatch } from './draft.ts'

export interface McpCreateNoteInput {
  path: string
  markdown: string
  summary: string
}

export interface McpMoveNoteInput {
  from: string
  to: string
  updateLinks?: boolean
  summary: string
}

export interface McpDeleteNoteInput {
  path: string
  summary: string
}

export function createNoteDraft(input: McpCreateNoteInput): DraftPatch {
  return createDraftPatch({
    notePath: input.path,
    proposedMarkdown: input.markdown,
    summary: input.summary,
    operation: 'create',
  })
}

export function moveNoteDraft(input: McpMoveNoteInput, markdown: string, contentHash: string): DraftPatch {
  return createDraftPatch({
    notePath: input.to,
    sourcePath: input.from,
    proposedMarkdown: markdown,
    summary: `${input.summary} (move ${input.from} → ${input.to})`,
    baseContentHash: contentHash,
    operation: 'move',
  })
}

export function deleteNoteDraft(input: McpDeleteNoteInput): DraftPatch {
  return createDraftPatch({
    notePath: input.path,
    proposedMarkdown: '',
    summary: `${input.summary} (delete ${input.path})`,
    operation: 'delete',
  })
}

export function runNoteWriteDraftTests(): string[] {
  const failures: string[] = []
  const create = createNoteDraft({ path: 'a.md', markdown: '# A', summary: 'create' })
  if (create.operation !== 'create') failures.push('createNoteDraft operation')
  const del = deleteNoteDraft({ path: 'b.md', summary: 'delete' })
  if (del.operation !== 'delete') failures.push('deleteNoteDraft operation')
  return failures
}
