import type { DraftPatch } from './draft.ts'
import { McpRuntime, assertVaultRelativePath } from './runtime.ts'

export async function runRuntimeReadOnlyTests(): Promise<string[]> {
  const failures: string[] = []
  let saveCalled = false

  const runtime = new McpRuntime('read-only', {
    async search() {
      return [{ path: 'note.md' }]
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note\n\n## Section' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
    async listTags() {
      return [{ tag: 'draft', note_count: 1 }]
    },
    async notesForTag() {
      return [{ path: 'note.md', title: 'Note' }]
    },
    async exportGraph() {
      return { nodes: [], edges: [] }
    },
    async listOrphans() {
      return []
    },
    async listDeadEnds() {
      return []
    },
    async listUnresolvedTargets() {
      return []
    },
    async renderMarkdown(markdown: string) {
      return `<article>${markdown}</article>`
    },
    async saveNote() {
      saveCalled = true
      return {}
    },
  })

  const denied = await runtime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Hack',
    summary: 'bad',
  })
  if (denied.ok) failures.push('read-only should deny proposePatch invoke')

  const allowed = await runtime.invoke('mcp.search', { query: 'note' })
  if (!allowed.ok) failures.push('read-only should allow search')
  if (saveCalled) failures.push('read-only must not save')

  const outline = await runtime.invoke('mcp.inspectOutline', { path: 'note.md' })
  if (!outline.ok) failures.push('read-only should allow inspectOutline')

  const tags = await runtime.invoke('mcp.listTags', {})
  if (!tags.ok) failures.push('read-only should allow listTags')

  const graph = await runtime.invoke('mcp.exportGraph', { focusPath: 'note.md', depth: 1 })
  if (!graph.ok) failures.push('read-only should allow exportGraph')

  const rendered = await runtime.invoke('mcp.renderMarkdown', { markdown: '# Hello' })
  if (!rendered.ok) failures.push('read-only should allow renderMarkdown when handler is configured')

  const summary = await runtime.invoke('mcp.inspectGraphSummary', {})
  if (!summary.ok) failures.push('read-only should allow inspectGraphSummary')

  const draftRuntime = new McpRuntime('draft', {
    async search() {
      return []
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note\n\n#draft' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
  })
  const draftPatch = await draftRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Draft',
    summary: 'draft',
  })
  if (!draftPatch.ok) failures.push('draft should allow proposePatch')
  const tagPatch = await draftRuntime.invoke('mcp.proposeTagPatch', {
    path: 'note.md',
    add: ['research'],
    summary: 'Add research tag',
  })
  if (!tagPatch.ok) failures.push('draft should allow proposeTagPatch')
  const approve = await draftRuntime.approveDraft((draftPatch.ok && (draftPatch.output as DraftPatch).id) || '')
  if (approve.ok) failures.push('draft should not approve writes without write-approved')

  let writeApprovedSaved = false
  const writeRuntime = new McpRuntime('write-approved', {
    async search() {
      return []
    },
    async readNote() {
      return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' }
    },
    async backlinks() {
      return []
    },
    async brokenLinks() {
      return []
    },
    async saveNote() {
      writeApprovedSaved = true
      return { metadata: { title: 'Note', content_hash: 'def' } }
    },
  })
  const writeDraft = await writeRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Approved',
    summary: 'apply after review',
    baseContentHash: 'abc',
  })
  if (!writeDraft.ok) failures.push('write-approved should allow proposePatch invoke')
  const approvedWrite = await writeRuntime.approveDraft(
    (writeDraft.ok && (writeDraft.output as DraftPatch).id) || '',
  )
  if (!approvedWrite.ok) failures.push('write-approved should approve draft')
  if (!writeApprovedSaved) failures.push('write-approved approval should call save bridge')

  const traversal = await runtime.invoke('mcp.readNote', { path: '../outside.md' })
  if (traversal.ok) failures.push('readNote should reject ".." traversal paths')
  const absolute = await runtime.invoke('mcp.readNote', { path: '/etc/passwd' })
  if (absolute.ok) failures.push('readNote should reject absolute paths')
  for (const hostile of ['C:\\vault\\note.md', '\\\\server\\share\\note.md', 'a/../../b.md']) {
    try {
      assertVaultRelativePath(hostile)
      failures.push(`assertVaultRelativePath should reject ${hostile}`)
    } catch {
      // expected
    }
  }
  try {
    assertVaultRelativePath('notes/sub/note.md')
  } catch {
    failures.push('assertVaultRelativePath should accept nested relative paths')
  }

  const badLimit = await runtime.invoke('mcp.search', { query: 'note', limit: 0 })
  if (badLimit.ok) failures.push('search should reject out-of-range limit')
  const badDepth = await runtime.invoke('mcp.exportGraph', { focusPath: 'note.md', depth: 99 })
  if (badDepth.ok) failures.push('exportGraph should reject out-of-range depth')
  const fractionalDepth = await runtime.invoke('mcp.traverseGraph', { focusPath: 'note.md', depth: 1.5 })
  if (fractionalDepth.ok) failures.push('traverseGraph should reject non-integer depth')

  for (let index = 0; index < 120; index += 1) {
    await draftRuntime.invoke('mcp.proposePatch', {
      path: `flood-${index}.md`,
      proposedMarkdown: `# Flood ${index}`,
      summary: `flood ${index}`,
    })
  }
  if (draftRuntime.listDrafts().length > 100) {
    failures.push('draft accumulation should be capped at 100')
  }

  // Test tool not found
  const unknownTool = await runtime.invoke('mcp.nonExistentTool', {})
  if (unknownTool.ok) failures.push('invoke should fail on unknown tool')

  // Test mode off returns no tools
  const offRuntime = new McpRuntime('off', null)
  if (offRuntime.listTools().length !== 0) failures.push('off runtime should list zero tools')

  // Test draft reject
  const rejectTestRuntime = new McpRuntime('draft', {
    async search() { return [] },
    async readNote() { return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' } },
    async backlinks() { return [] },
    async brokenLinks() { return [] },
  })
  const toReject = await rejectTestRuntime.invoke('mcp.proposePatch', {
    path: 'reject-me.md',
    proposedMarkdown: '# Reject',
    summary: 'reject',
  })
  if (toReject.ok) {
    const draftId = (toReject.output as DraftPatch).id
    const rejected = rejectTestRuntime.rejectDraft(draftId)
    if (!rejected) failures.push('rejectDraft should succeed')
  } else {
    failures.push('draft proposePatch before reject should succeed')
  }

  return failures
}
