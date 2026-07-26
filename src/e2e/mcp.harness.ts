import type { McpMode } from '@scriptor/core/contracts/mcp'

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
    // `summary` is required by McpRuntime.dispatch — omitting it made every
    // harness call fail with `mcp.invoke_failed` and `saved` stay null.
    summary: 'E2E write-approved round trip',
    baseContentHash: 'abc',
  })
  if (!patch.ok) return { ok: false, saved: null, reason: patch.error }
  const approved = await runtime.approveDraft((patch.output as { id: string }).id)
  return { ok: approved.ok, saved }
}

export interface McpScenarioInput {
  mode: McpMode
  calls: Array<{ tool: string; input: unknown }>
  /** Attempt to approve the first pending draft after running `calls`. */
  approveFirstDraft?: boolean
}

export interface McpScenarioResult {
  outcomes: Array<{
    tool: string
    ok: boolean
    code: string | null
    message: string | null
    output: unknown
  }>
  listedTools: string[]
  pendingDrafts: Array<{ id: string; status: string; notePath: string }>
  approval: { attempted: boolean; ok: boolean; code: string | null }
  savedPaths: string[]
  renamedPaths: string[]
  deletedPaths: string[]
  audit: Array<{
    toolName: string
    mode: string
    commandId: string
    outcome: string
    hasRequestedAt: boolean
    hasApprovedAt: boolean
  }>
}

/**
 * Drive an `McpRuntime` in a given permission mode and report everything a test
 * needs to assert on: per-call outcomes, the exposed tool list, the draft queue,
 * whether any write bridge was actually reached, and the audit trail.
 *
 * This lives in the app bundle rather than in a `page.evaluate` that does
 * `await import('@scriptor/mcp')`, because bare module specifiers cannot be
 * resolved from an evaluated script in the browser (that is why the MCP specs
 * that inlined the import failed with "Failed to resolve module specifier").
 */
export async function runMcpScenario(input: McpScenarioInput): Promise<McpScenarioResult> {
  const { McpRuntime } = await import('@scriptor/mcp')

  const savedPaths: string[] = []
  const renamedPaths: string[] = []
  const deletedPaths: string[] = []

  const runtime = new McpRuntime(input.mode, {
    readNote: async (path: string) => ({
      metadata: { title: 'E2E Note', content_hash: 'hash-1' },
      markdown: `# E2E Note\n\nBody of ${path}\n`,
    }),
    search: async () => [],
    backlinks: async () => [],
    brokenLinks: async () => [],
    saveNote: async (path: string) => {
      savedPaths.push(path)
      return { path, content_hash: 'hash-2' }
    },
    renameNote: async (from: string, to: string) => {
      renamedPaths.push(`${from}->${to}`)
      return { from, to }
    },
    deleteNote: async (path: string) => {
      deletedPaths.push(path)
      return { path }
    },
  })

  const outcomes: McpScenarioResult['outcomes'] = []
  for (const call of input.calls) {
    const response = await runtime.invoke(call.tool, call.input)
    outcomes.push({
      tool: call.tool,
      ok: response.ok,
      code: response.ok ? null : response.error.code,
      message: response.ok ? null : response.error.message,
      output: response.ok ? response.output : null,
    })
  }

  const approval: McpScenarioResult['approval'] = { attempted: false, ok: false, code: null }
  if (input.approveFirstDraft) {
    approval.attempted = true
    const first = runtime.listDrafts()[0]
    const result = await runtime.approveDraft(first?.id ?? '')
    approval.ok = result.ok
    approval.code = result.ok ? null : result.error.code
  }

  return {
    outcomes,
    listedTools: runtime.listTools().map((tool) => tool.name),
    pendingDrafts: runtime.listDrafts().map((draft) => ({
      id: draft.id,
      status: draft.status,
      notePath: draft.notePath,
    })),
    approval,
    savedPaths,
    renamedPaths,
    deletedPaths,
    audit: runtime.listAudit(50).map((record) => ({
      toolName: record.toolName,
      mode: record.mode,
      commandId: record.commandId,
      outcome: record.outcome,
      hasRequestedAt: typeof record.requestedAt === 'string' && record.requestedAt.length > 0,
      hasApprovedAt: record.approvedAt !== undefined && record.approvedAt !== null,
    })),
  }
}

declare global {
  interface Window {
    __scriptorE2eMcpWriteApproved?: () => Promise<{
      ok: boolean
      saved: { path: string; markdown: string } | null
      reason?: unknown
    }>
    __scriptorE2eMcpScenario?: (input: McpScenarioInput) => Promise<McpScenarioResult>
  }
}

export function installE2eMcpHarness(): void {
  window.__scriptorE2eMcpWriteApproved = runWriteApprovedMcpHarness
  window.__scriptorE2eMcpScenario = runMcpScenario
}
