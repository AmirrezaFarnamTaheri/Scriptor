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
  'missing-manuscript' | 'missing-manuscript-citation'
export interface TraceReview {
  readonly status: TraceIssue
  readonly proposedSourcePath: string | null
  readonly requiresReview: boolean
}
export function reviewResearchEvidence(trace: ResearchEvidenceTrace, ctx: ResearchReadContext): TraceReview {
  const report = (status: TraceIssue, proposedSourcePath: string | null): TraceReview => ({
    status, proposedSourcePath, requiresReview: status !== 'ready',
  })
  if (!trace.vaultId || trace.vaultId !== ctx.vaultId || (ctx.source && ctx.source.vaultId !== ctx.vaultId)) return report('wrong-vault', null)
  const source = ctx.source
  if (!source || !trace.sourceId || source.sourceId !== trace.sourceId) return report('missing-source', null)
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
  if (!input.captureReviewed) return { ready: false, next: 'review-capture' }
  if (input.trace.status !== 'ready') return { ready: false, next: 'repair-evidence' }
  if (!input.exportProfileValidated) return { ready: false, next: 'validate-export-profile' }
  return { ready: true, next: 'request-publish-authorization' }
}
