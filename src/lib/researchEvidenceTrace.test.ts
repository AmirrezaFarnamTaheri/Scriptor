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

test('MAT-011: empty reference and ownership paths cannot appear ready even when indexes contain matching blanks', () => {
  for (const corrupted of [
    { ...trace, referenceKey: '' },
    { ...trace, literatureNotePath: '' },
    { ...trace, manuscriptPath: '' },
  ]) {
    const result = review(corrupted, {
      ...ctx, bibliographyKeys: ['', 'cite2026'],
      notePaths: ['', 'literature/a.md', 'draft.md'],
      manuscriptCitationKeys: ['', 'cite2026'],
    })
    assert.notEqual(result.status, 'ready', 'empty identity must not match a malformed index')
    assert.equal(result.requiresReview, true)
  }
})

test('MAT-011: traversal paths and missing source revision cannot certify a current-vault trace', () => {
  const bad = [
    { ...trace, sourcePath: '../outside.md' },
    { ...trace, literatureNotePath: 'literature/../../outside.md' },
    { ...trace, manuscriptPath: '/external/draft.md' },
    { ...trace, sourceRevision: '' },
  ]
  for (const item of bad) {
    const result = review(item, {
      ...ctx,
      source: { ...ctx.source!, path: item.sourcePath, revision: item.sourceRevision },
      notePaths: ['literature/a.md', 'draft.md', item.literatureNotePath, item.manuscriptPath],
    })
    assert.equal(result.status, 'invalid-evidence', JSON.stringify(item))
    assert.equal(result.requiresReview, true)
    assert.equal(result.proposedSourcePath, null)
  }
})

test('MAT-012: contradictory or absent review outcomes cannot authorize publication', () => {
  const ready = review(trace, ctx)
  const contradictory = { ...ready, requiresReview: true }
  assert.deepEqual(checkpoint({ captureReviewed: true, trace: contradictory, exportProfileValidated: true }),
    { ready: false, next: 'repair-evidence' })
  const missing = checkpoint({ captureReviewed: true,
    trace: null as unknown as Parameters<typeof checkpoint>[0]['trace'], exportProfileValidated: true })
  assert.deepEqual(missing, { ready: false, next: 'repair-evidence' })
})

test('MAT-012: truthy invalid approvals cannot bypass capture or export-profile validation', () => {
  const ready = review(trace, ctx)
  assert.deepEqual(checkpoint({
    captureReviewed: 'yes' as unknown as boolean, trace: ready, exportProfileValidated: true,
  }), { ready: false, next: 'review-capture' })
  assert.deepEqual(checkpoint({
    captureReviewed: true, trace: ready, exportProfileValidated: 'yes' as unknown as boolean,
  }), { ready: false, next: 'validate-export-profile' })
})
