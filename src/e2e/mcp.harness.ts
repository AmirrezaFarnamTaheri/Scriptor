export async function runWriteApprovedMcpHarness(): Promise<{
  ok: boolean
  saved: { path: string; markdown: string } | null
  reason?: unknown
}> {
  const { McpRuntime } = await import('@scriptor/mcp')
  let saved: { path: string; markdown: string } | null = null
  const runtime = new McpRuntime('write-approved', {
    readNote: async () => ({
      metadata: { title: 'Note', content_hash: 'abc' },
      markdown: '# Hello\n',
    }),
    search: async () => [],
    backlinks: async () => [],
    brokenLinks: async () => [],
    saveNote: async (path, markdown) => {
      saved = { path, markdown }
      return { path, content_hash: 'next' }
    },
  })
  const patch = await runtime.invoke('mcp.proposePatch', {
    path: 'draft.md',
    proposedMarkdown: '# Hello\n\nPatched\n',
    baseContentHash: 'abc',
  })
  if (!patch.ok) return { ok: false, saved: null, reason: patch.error }
  const approved = await runtime.approveDraft((patch.output as { id: string }).id)
  return { ok: approved.ok, saved }
}

declare global {
  interface Window {
    __scriptorE2eMcpWriteApproved?: () => Promise<{
      ok: boolean
      saved: { path: string; markdown: string } | null
      reason?: unknown
    }>
  }
}

export function installE2eMcpHarness(): void {
  window.__scriptorE2eMcpWriteApproved = runWriteApprovedMcpHarness
}
