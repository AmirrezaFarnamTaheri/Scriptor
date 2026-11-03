/**
 * MAT-011/012: a read-only provenance review built on existing native
 * vault/indexer evidence. This grants no capture, publication or network access.
 */
export interface ResearchEvidenceTrace {
  readonly vaultId: string
  readonly sourceId: string
  readonly sourcePath: string
  readonly sourceRevision: string
  /** Offsets in UTF-16 code units of exactly the reviewed Markdown revision. */
  readonly passageStartUtf16: number
  readonly passageEndUtf16: number
  readonly quote: string
  readonly referenceKey: string
  readonly literatureNotePath: string
  readonly manuscriptPath: string
}
export interface ResearchReadContext {
  readonly vaultId: string
  readonly source: {
    readonly vaultId: string
    readonly sourceId: string
    readonly path: string
    readonly revision: string
    readonly markdown: string
  } | null
  readonly bibliographyKeys: readonly string[]
  readonly notePaths: readonly string[]
  /** Existing citation indexer owns extraction of manuscript citation keys. */
  readonly manuscriptCitationKeys: readonly string[]
}
export type TraceIssue = 'ready' | 'wrong-vault' | 'missing-source' |
  'moved-source' | 'stale-revision' | 'stale-passage' |
  'missing-reference' | 'missing-literature-note' |
  'missing-manuscript' | 'missing-manuscript-citation' | 'invalid-evidence'
export interface TraceReview {
  readonly status: TraceIssue
  readonly proposedSourcePath: string | null
  readonly requiresReview: boolean
}
// Evidence is read-only, but paths and identifiers still cross an index/IPC
// boundary; matching two malformed observations must never certify provenance.
const nonblank = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 500
// Native/indexed strings are runtime input even when the bridge has typed
// fields. Controls and bidirectional marks can make a different source appear
// to carry an already-reviewed citation or revision.
const provenanceIdentity = (value: unknown): value is string =>
  nonblank(value) && !/[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(value)
const vaultRelativePath = (value: unknown): value is string =>
  provenanceIdentity(value) && !value.startsWith('/') && !value.includes('\\') &&
  !value.includes(':') &&
  value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..' &&
    !/[. ]$/u.test(part) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(part))

export function reviewResearchEvidence(trace: ResearchEvidenceTrace, ctx: ResearchReadContext): TraceReview {
  const report = (status: TraceIssue, proposedSourcePath: string | null): TraceReview => ({
    status, proposedSourcePath, requiresReview: status !== 'ready',
  })
  if (!trace || !ctx || !nonblank(trace.vaultId) || !nonblank(ctx.vaultId) ||
      trace.vaultId !== ctx.vaultId || (ctx.source && ctx.source.vaultId !== ctx.vaultId)) {
    return report('wrong-vault', null)
  }
  if (!provenanceIdentity(trace.sourceId) || !vaultRelativePath(trace.sourcePath) ||
      !provenanceIdentity(trace.sourceRevision) || !provenanceIdentity(trace.referenceKey) ||
      !vaultRelativePath(trace.literatureNotePath) || !vaultRelativePath(trace.manuscriptPath)) {
    return report('invalid-evidence', null)
  }
  const source = ctx.source
  if (!source || source.sourceId !== trace.sourceId) return report('missing-source', null)
  if (!vaultRelativePath(source.path) || !provenanceIdentity(source.revision) ||
      typeof source.markdown !== 'string' ||
      !Array.isArray(ctx.bibliographyKeys) || !Array.isArray(ctx.notePaths) ||
      !Array.isArray(ctx.manuscriptCitationKeys)) {
    return report('invalid-evidence', null)
  }
  if (source.path !== trace.sourcePath) return report('moved-source', source.path)
  if (source.revision !== trace.sourceRevision) return report('stale-revision', source.path)
  const { passageStartUtf16: start, passageEndUtf16: end } = trace
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start ||
      end > source.markdown.length || !trace.quote || source.markdown.slice(start, end) !== trace.quote) {
    return report('stale-passage', source.path)
  }
  if (!ctx.bibliographyKeys.includes(trace.referenceKey)) return report('missing-reference', source.path)
  if (!ctx.notePaths.includes(trace.literatureNotePath)) return report('missing-literature-note', source.path)
  if (!ctx.notePaths.includes(trace.manuscriptPath)) return report('missing-manuscript', source.path)
  if (!ctx.manuscriptCitationKeys.includes(trace.referenceKey)) return report('missing-manuscript-citation', source.path)
  return report('ready', source.path)
}
export type ResearchNextStep = 'review-capture' | 'repair-evidence' | 'validate-export-profile' | 'request-publish-authorization'
export function researchWorkflowCheckpoint(input: {
  readonly captureReviewed: boolean
  readonly trace: TraceReview
  readonly exportProfileValidated: boolean
}): { readonly ready: boolean; readonly next: ResearchNextStep } {
  if (input.captureReviewed !== true) return { ready: false, next: 'review-capture' }
  if (!input.trace || input.trace.status !== 'ready' || input.trace.requiresReview !== false) {
    return { ready: false, next: 'repair-evidence' }
  }
  if (input.exportProfileValidated !== true) return { ready: false, next: 'validate-export-profile' }
  return { ready: true, next: 'request-publish-authorization' }
}
