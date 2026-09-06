import type { DraftPatch } from './draft.ts'
import { McpRuntime, assertVaultRelativePath } from './runtime.ts'

export async function runRuntimeReadOnlyTests(): Promise<string[]> {
  const failures: string[] = []
  let saveCalled = false

  const runtime = new McpRuntime('read-only', {
    vaultId: 'vault-read',
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
    vaultId: 'vault-draft',
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
    vaultId: 'vault-write',
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
    vaultId: 'vault-reject',
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

  // A draft is only meaningful while it can be bound to a vault: without a
  // stable `vaultId` the runtime must refuse the proposal instead of queueing
  // a patch that no approval could ever apply.
  const contextlessRuntime = new McpRuntime('write-approved', {
    async search() { return [] },
    async readNote() { return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' } },
    async backlinks() { return [] },
    async brokenLinks() { return [] },
    async saveNote() { return { metadata: { title: 'Note', content_hash: 'def' } } },
  })
  const contextlessDraft = await contextlessRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Approved',
    summary: 'no vault identity',
    baseContentHash: 'abc',
  })
  if (contextlessDraft.ok) {
    failures.push('proposePatch must require a stable vault identity')
  } else if (!contextlessDraft.error.message.includes('vault identity')) {
    failures.push('a missing vault id should surface the stable-identity error')
  }

  // Tools whose bridge is absent must not be advertised, otherwise a client
  // sees a write tool that can only ever fail.
  const noWriteBridge = new McpRuntime('write-approved', {
    async search() { return [] },
    async readNote() { return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' } },
    async backlinks() { return [] },
    async brokenLinks() { return [] },
  })
  const advertised = noWriteBridge.listTools().map((tool) => tool.name)
  if (advertised.includes('mcp.proposePatch')) {
    failures.push('a runtime without a save bridge must not advertise mcp.proposePatch')
  }

  // Approval is single-use: the draft is claimed before the async write, so a
  // second approval attempt is reported instead of applying the patch twice.
  const secondApproval = await writeRuntime.invoke('mcp.proposePatch', {
    path: 'once.md',
    proposedMarkdown: '# Once',
    summary: 'approve once',
    baseContentHash: 'abc',
  })
  if (!secondApproval.ok) {
    failures.push('write-approved should queue a draft for single-use approval')
  } else {
    const onceId = (secondApproval.output as DraftPatch).id
    const first = await writeRuntime.approveDraft(onceId)
    if (!first.ok) failures.push('the first approval of a draft should succeed')
    const repeated = await writeRuntime.approveDraft(onceId)
    if (repeated.ok) {
      failures.push('a draft must not be approvable twice')
    } else if (repeated.error.code !== 'mcp.draft_resolved') {
      failures.push(`repeated approval should report mcp.draft_resolved, got ${repeated.error.code}`)
    }
  }

  // A draft reviewed for one vault must not be applied after the runtime has
  // been rebound to another vault.
  const mismatchRuntime = new McpRuntime('write-approved', {
    vaultId: 'vault-a',
    async search() { return [] },
    async readNote() { return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' } },
    async backlinks() { return [] },
    async brokenLinks() { return [] },
    async saveNote() { return { metadata: { title: 'Note', content_hash: 'def' } } },
  })
  const mismatchDraft = await mismatchRuntime.invoke('mcp.proposePatch', {
    path: 'note.md',
    proposedMarkdown: '# Moved elsewhere',
    summary: 'vault switch mid-review',
    baseContentHash: 'abc',
  })
  if (!mismatchDraft.ok) {
    failures.push('a draft should be queued while the vault id is stable')
  } else {
    mismatchRuntime.setContext({
      vaultId: 'vault-b',
      async search() { return [] },
      async readNote() { return { metadata: { title: 'Note', content_hash: 'abc' }, markdown: '# Note' } },
      async backlinks() { return [] },
      async brokenLinks() { return [] },
      async saveNote() { return { metadata: { title: 'Note', content_hash: 'def' } } },
    })
    const wrongVault = await mismatchRuntime.approveDraft((mismatchDraft.output as DraftPatch).id)
    if (wrongVault.ok) {
      failures.push('a draft must not be approved against a different vault')
    } else if (wrongVault.error.code !== 'mcp.vault_mismatch') {
      failures.push(`cross-vault approval should report mcp.vault_mismatch, got ${wrongVault.error.code}`)
    }
  }

  return failures
}
