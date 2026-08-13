import { createDraftPatch, type DraftPatch } from './draft.ts'

// ── I-3 sealed-content interlock ─────────────────────────────────────────────
// Mirrors the Rust sentinel in `crates/export-runner/src/sealed.rs`.
// The check must use the same prefix so both layers agree on what is sealed.
const SEALED_PREFIX = '%%scriptor-sealed:'

/**
 * Returns `true` when `markdown` contains at least one sealed span.
 * Exposed so higher-level layers (e.g. draft-approval) can pre-check.
 */
export function containsSealedSpan(markdown: string): boolean {
  return markdown.includes(SEALED_PREFIX)
}

/**
 * Thrown by `createNoteDraft` when the proposed Markdown contains a sealed
 * span. The AI agent must never write ciphertext into a note body.
 */
export class SealedContentError extends Error {
  readonly path: string
  constructor(path: string) {
    super(`sealed content detected in ${path}: AI agents may not write sealed spans`)
    this.name = 'SealedContentError'
    this.path = path
  }
}

// ── Input / output types ──────────────────────────────────────────────────────

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

// ── Draft factories ───────────────────────────────────────────────────────────

/**
 * Build a create-note draft patch. Throws `SealedContentError` if `markdown`
 * contains a sealed span (I-3 interlock: agents may never write ciphertext).
 */
export function createNoteDraft(input: McpCreateNoteInput): DraftPatch {
  if (containsSealedSpan(input.markdown)) {
    throw new SealedContentError(input.path)
  }
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

// ── Self-tests ────────────────────────────────────────────────────────────────

export function runNoteWriteDraftTests(): string[] {
  const failures: string[] = []

  const create = createNoteDraft({ path: 'a.md', markdown: '# A', summary: 'create' })
  if (create.operation !== 'create') failures.push('createNoteDraft operation')

  const del = deleteNoteDraft({ path: 'b.md', summary: 'delete' })
  if (del.operation !== 'delete') failures.push('deleteNoteDraft operation')

  // I-3: creating a note with sealed content must throw.
  try {
    createNoteDraft({ path: 'c.md', markdown: `%%scriptor-sealed:x:y%%`, summary: 'bad' })
    failures.push('createNoteDraft should throw on sealed content')
  } catch (e) {
    if (!(e instanceof SealedContentError)) {
      failures.push(`createNoteDraft threw wrong error type: ${e}`)
    }
  }

  // containsSealedSpan must detect the sentinel and ignore clean text.
  if (!containsSealedSpan('hello %%scriptor-sealed:hint:cipher%%')) {
    failures.push('containsSealedSpan: false negative on sealed span')
  }
  if (containsSealedSpan('no secrets here')) {
    failures.push('containsSealedSpan: false positive on clean text')
  }

  return failures
}
