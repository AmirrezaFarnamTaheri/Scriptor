import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyReviewedRevisionAsNewNote } from './revisionCopy.ts'

const request = {
  vaultId: 'vault-alpha',
  sourcePath: 'notes/research.md',
  revisionId: 'revision-17',
  targetPath: 'notes/research-recovered.md',
  reviewedMarkdown: '# Previously saved\n',
}

function harness(options: {
  read?: () => Promise<string>
  save?: () => Promise<unknown>
  current?: () => boolean
} = {}) {
  const calls: Array<{ operation: string; args: unknown[] }> = []
  return {
    calls,
    dependencies: {
      readRevision: async (source: string, revision: string, vault: string) => {
        calls.push({ operation: 'read', args: [source, revision, vault] })
        return options.read ? options.read() : request.reviewedMarkdown
      },
      createNote: async (destination: string, markdown: string, hash: string, vault: string) => {
        calls.push({ operation: 'create', args: [destination, markdown, hash, vault] })
        return options.save ? options.save() : undefined
      },
      isCurrent: options.current ?? (() => true),
    },
  }
}

test('MAT-004: creates a separate note with a native atomic absence precondition and originating vault', async () => {
  const h = harness()
  assert.equal(await copyReviewedRevisionAsNewNote(request, h.dependencies), request.targetPath)
  assert.deepEqual(h.calls, [
    { operation: 'read', args: [request.sourcePath, request.revisionId, request.vaultId] },
    { operation: 'create', args: [request.targetPath, request.reviewedMarkdown, '<missing>', request.vaultId] },
  ])
})

test('MAT-004: never copies a revision if source content changed since the review', async () => {
  const h = harness({ read: async () => '# Unexpectedly changed\n' })
  await assert.rejects(copyReviewedRevisionAsNewNote(request, h.dependencies), /revision changed|review again/i)
  assert.equal(h.calls.filter(c => c.operation === 'create').length, 0)
})

test('MAT-004: an active-vault switch during revision read cancels before native mutation', async () => {
  let current = true
  const h = harness({ read: async () => { current = false; return request.reviewedMarkdown }, current: () => current })
  await assert.rejects(copyReviewedRevisionAsNewNote(request, h.dependencies), /vault|source|changed/i)
  assert.equal(h.calls.filter(c => c.operation === 'create').length, 0)
})

test('MAT-004: rejects absent source, vault, revision, or target before reading anything', async () => {
  for (const field of ['vaultId', 'sourcePath', 'revisionId', 'targetPath'] as const) {
    const h = harness()
    await assert.rejects(copyReviewedRevisionAsNewNote({ ...request, [field]: '   ' }, h.dependencies))
    assert.equal(h.calls.length, 0, field + ' must block before source reads')
  }
})

test('MAT-004: rejects current-note destination and traversal, absolute or internal vault paths', async () => {
  for (const targetPath of [request.sourcePath, '../escape.md', '/absolute.md', 'C:\\notes\\escape.md', '.scriptor/private.md', 'notes/draft.txt']) {
    const h = harness()
    await assert.rejects(copyReviewedRevisionAsNewNote({ ...request, targetPath }, h.dependencies))
    assert.equal(h.calls.length, 0, targetPath + ' must be rejected before reading')
  }
})

test('MAT-004: native collision or vault mismatch propagates without retrying as overwrite', async () => {
  const nativeDenial = new Error('content hash mismatch: expected <missing>')
  const h = harness({ save: async () => { throw nativeDenial } })
  await assert.rejects(copyReviewedRevisionAsNewNote(request, h.dependencies), error => error === nativeDenial)
  assert.equal(h.calls.filter(c => c.operation === 'create').length, 1)
})

test('MAT-004: cancellation before source read never performs a native request', async () => {
  const h = harness({ current: () => false })
  await assert.rejects(copyReviewedRevisionAsNewNote(request, h.dependencies), /changed|vault/i)
  assert.equal(h.calls.length, 0)
})
