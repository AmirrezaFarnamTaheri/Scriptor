import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reviewResearchEvidence as review, researchWorkflowCheckpoint as checkpoint } from './researchEvidenceTrace.ts'
const trace = {
  vaultId: 'v-a', sourceId: 'source-1', sourcePath: 'sources/a.md', sourceRevision: 'hash-1',
  passageStartUtf16: 2, passageEndUtf16: 7, quote: 'claim',
  referenceKey: 'cite2026', literatureNotePath: 'literature/a.md', manuscriptPath: 'draft.md',
}
const ctx = {
  vaultId: 'v-a',
  source: { vaultId: 'v-a', sourceId: 'source-1', path: 'sources/a.md', revision: 'hash-1', markdown: '# claim\n' },
  bibliographyKeys: ['cite2026'], notePaths: ['literature/a.md', 'draft.md'], manuscriptCitationKeys: ['cite2026'],
}
test('evidence is ready only when all owners agree on source, key and citation', () => {
  assert.equal(review(trace, ctx).status, 'ready')
  assert.deepEqual(checkpoint({ captureReviewed: true, trace: review(trace, ctx), exportProfileValidated: true }),
    { ready: true, next: 'request-publish-authorization' })
})
test('moving source demands review, not a silent path rewrite', () => {
  assert.deepEqual(review(trace, { ...ctx, source: { ...ctx.source, path: 'moved/a.md' } }),
    { status: 'moved-source', proposedSourcePath: 'moved/a.md', requiresReview: true })
})
test('source mutation invalidates passage and old revision', () => {
  assert.equal(review(trace, { ...ctx, source: { ...ctx.source, revision: 'new-hash' } }).status, 'stale-revision')
  assert.equal(review(trace, { ...ctx, source: { ...ctx.source, markdown: '# other\n' } }).status, 'stale-passage')
})
test('wrong-vault source never passes validation', () => {
  assert.equal(review(trace, { ...ctx, vaultId: 'v-b' }).status, 'wrong-vault')
})
test('missing bibliography or manuscript citation blocks publication', () => {
  assert.equal(review(trace, { ...ctx, bibliographyKeys: [] }).status, 'missing-reference')
  assert.equal(review(trace, { ...ctx, manuscriptCitationKeys: [] }).status, 'missing-manuscript-citation')
})
test('export readiness never skips missing capture or export-profile checks', () => {
  const verified = review(trace, ctx)
  assert.equal(checkpoint({ captureReviewed: false, trace: verified, exportProfileValidated: true }).next, 'review-capture')
  assert.equal(checkpoint({ captureReviewed: true, trace: verified, exportProfileValidated: false }).next, 'validate-export-profile')
  assert.equal(checkpoint({ captureReviewed: true, trace: review(trace, { ...ctx, bibliographyKeys: [] }), exportProfileValidated: true }).next, 'repair-evidence')
})
